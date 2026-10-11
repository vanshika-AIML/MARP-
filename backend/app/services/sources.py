import asyncio
import logging
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select

from app.models import UploadedSource
from app.schemas.sources import SourceEvent
from app.services.ingestion.validation import validate_upload

logger = logging.getLogger("marp.sources")
MESSAGES = {
    "source.uploaded": "Your source is queued for processing.",
    "source.processing": "Reading your files...",
    "source.extracting": "Understanding the content...",
    "source.chunking": "Organising the important sections...",
    "source.ready": "Your source material is ready.",
    "source.failed": "We couldn't read this source.",
    "source.deleted": "Source deleted.",
}


def source_channel(source_id):
    return f"marp:sources:{source_id}:events"


def source_event(source, *, deleted=False):
    info = (source.source_metadata or {}).get("ingestion", {})
    stage = "source.deleted" if deleted else info.get("step", "source." + source.status)
    return SourceEvent(
        event=stage,
        source_id=source.id,
        progress=info.get("progress", 0),
        data={"status": "deleted" if deleted else source.status, "error": source.error},
        message=MESSAGES[stage],
        updated_at=source.updated_at,
    )


async def publish_source(redis, event):
    try:
        async with asyncio.timeout(3):
            await redis.publish(source_channel(event.source_id), event.model_dump_json())
    except Exception as exc:
        logger.warning("Source event delivery unavailable (%s)", type(exc).__name__)


async def require_source(session, source_id, *, lock=False):
    query = select(UploadedSource).where(UploadedSource.id == source_id)
    if lock:
        query = query.with_for_update()
    row = await session.scalar(query.execution_options(populate_existing=True))
    if row is None:
        raise HTTPException(404, "Source not found")
    return row


async def create_source(session, queue, storage, upload, settings):
    try:
        head = await upload.read(8192)
        name, extension, mime = validate_upload(upload.filename, upload.content_type, head)
        await upload.seek(0)
        source_id = uuid4()
        key = f"{source_id.hex}.{extension}"
        size = await storage.save(upload, key, settings.max_upload_mb * 1024 * 1024)
    finally:
        await upload.close()
    source = UploadedSource(
        id=source_id,
        original_filename=name,
        stored_filename=key,
        storage_path=key,
        mime_type=mime,
        extension=extension,
        size_bytes=size,
        status="uploaded",
        source_metadata={"ingestion": {"step": "source.uploaded", "progress": 0}},
    )
    try:
        session.add(source)
        await session.commit()
    except BaseException:
        await session.rollback()
        await storage.delete(key)
        raise
    try:
        async with asyncio.timeout(5):
            await queue.enqueue_source(source_id)
    except Exception as exc:
        logger.warning("Source enqueue failed (%s)", type(exc).__name__)
        source = await require_source(session, source_id, lock=True)
        if source.status == "uploaded":
            source.status = "failed"
            source.error = {
                "code": "queue_unavailable",
                "message": "Source processing queue unavailable",
            }
            source.source_metadata = {"ingestion": {"step": "source.failed", "progress": 0}}
            source.updated_at = datetime.now(UTC)
            await session.commit()
            await publish_source(queue.redis, source_event(source))
        else:
            await session.rollback()
        # Retain the durable ID so the failed upload remains inspectable/deletable.
    return source_id


async def delete_source(session, storage, redis, source_id):
    source = await require_source(session, source_id, lock=True)
    try:
        await storage.delete(source.storage_path)
    except OSError:
        await session.rollback()
        raise HTTPException(409, "Source file is busy; retry deletion after processing") from None
    source.updated_at = datetime.now(UTC)
    event = source_event(source, deleted=True)
    await session.delete(source)
    await session.commit()
    await publish_source(redis, event)
