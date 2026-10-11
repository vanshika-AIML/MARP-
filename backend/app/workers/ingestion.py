"""Expensive parsers run in a killable child process, outside database transactions."""

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from arq import Retry
from sqlalchemy import delete, text

from app.models import SourceChunk, UploadedSource
from app.services.ingestion.chunking import chunk_document
from app.services.ingestion.process import extract_isolated
from app.services.sources import publish_source, source_event
from app.services.storage import get_storage
from app.workers.generation import safe_error

logger = logging.getLogger("marp.ingestion")


async def transition(ctx, source_id, stage, progress):
    async with ctx["sessions"]() as session:
        source = await session.get(UploadedSource, source_id, with_for_update=True)
        if source is None or source.status in {"ready", "failed"}:
            return None
        source.status = "processing"
        source.source_metadata = {
            **(source.source_metadata or {}),
            "ingestion": {"step": stage, "progress": progress},
        }
        source.updated_at = datetime.now(UTC)
        await session.commit()
        event = source_event(source)
        snapshot = (source.storage_path, source.extension, source.original_filename)
    await publish_source(ctx["redis"], event)
    return snapshot


async def ingest_source(ctx, source_id: str):
    source_uuid = UUID(source_id)
    storage = ctx.get("storage") or get_storage(ctx["settings"])
    try:
        async with ctx["database"].engine.connect() as connection:
            params = {"key": "source:" + source_id}
            locked = await connection.scalar(
                text("SELECT pg_try_advisory_lock(hashtextextended(:key, 0))"),
                params,
            )
            await connection.commit()
            if not locked:
                return
            try:
                snapshot = await transition(ctx, source_uuid, "source.processing", 5)
                if snapshot is None:
                    return
                key, extension, name = snapshot
                if not await transition(ctx, source_uuid, "source.extracting", 10):
                    return
                async with storage.local_copy(key) as path:
                    result = await extract_isolated(
                        path,
                        extension,
                        name,
                        deadline=ctx["settings"].ingestion_timeout_seconds,
                    )
                if not await transition(ctx, source_uuid, "source.chunking", 70):
                    return
                chunks = chunk_document(source_uuid, result)
                async with ctx["sessions"]() as session:
                    source = await session.get(UploadedSource, source_uuid, with_for_update=True)
                    if source is None:
                        return  # Deleted sources must never be resurrected.
                    await session.execute(
                        delete(SourceChunk).where(SourceChunk.source_id == source_uuid)
                    )
                    session.add_all(SourceChunk(**chunk) for chunk in chunks)
                    source.extracted_text = result.text
                    source.source_metadata = {
                        **result.metadata,
                        "title": result.title,
                        "sections": [
                            section.model_dump(exclude={"text"}) for section in result.sections
                        ],
                        "chunks": len(chunks),
                        "ingestion": {"step": "source.ready", "progress": 100},
                    }
                    source.status, source.error = "ready", None
                    source.updated_at = datetime.now(UTC)
                    await session.commit()
                    event = source_event(source)
                await publish_source(ctx["redis"], event)
            finally:
                try:
                    await connection.execute(
                        text("SELECT pg_advisory_unlock(hashtextextended(:key, 0))"),
                        params,
                    )
                    await connection.commit()
                except BaseException:
                    await connection.invalidate()
                    raise
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.warning("Source ingestion failed (%s)", type(exc).__name__)
        _, transient = safe_error(exc)
        if transient and ctx.get("job_try", 1) < 3:
            raise Retry(defer=5 * ctx.get("job_try", 1)) from None
        async with ctx["sessions"]() as session:
            source = await session.get(UploadedSource, source_uuid, with_for_update=True)
            if source is None or source.status == "ready":
                return
            progress = (source.source_metadata or {}).get("ingestion", {}).get("progress", 0)
            source.status = "failed"
            source.error = {
                "code": "extraction_failed",
                "message": "Source is corrupt, protected, or exceeds extraction limits",
            }
            source.source_metadata = {"ingestion": {"step": "source.failed", "progress": progress}}
            source.updated_at = datetime.now(UTC)
            await session.commit()
            event = source_event(source)
        await publish_source(ctx["redis"], event)
