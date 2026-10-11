"""At-most-one active inference per job, with atomic result/presentation commits."""

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from arq import Retry
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as DatabaseTimeout

from app.schemas.ai import GenerationRequest
from app.services.ai.generation_service import GenerationService
from app.services.ai.nvidia_nim import AIProviderError
from app.services.jobs import (
    TERMINAL,
    JobCancelled,
    JobObserver,
    event_for,
    publish,
    require_job,
)

logger = logging.getLogger("marp.worker")


def safe_error(exc):
    if isinstance(exc, AIProviderError):
        return {"code": exc.code, "message": exc.message}, exc.retryable
    if isinstance(exc, TimeoutError):
        return {"code": "job_timeout", "message": "Generation timed out"}, True
    if isinstance(exc, SQLAlchemyError):
        retryable = isinstance(exc, DatabaseTimeout)
        if isinstance(exc, DBAPIError):
            code = getattr(exc.orig, "sqlstate", None) or getattr(exc.orig, "pgcode", "")
            retryable = (
                exc.connection_invalidated
                or str(code).startswith("08")
                or code
                in {
                    "40001",
                    "40P01",
                    "53300",
                    "57P01",
                    "57P02",
                    "57P03",
                }
            )
        return {"code": "database_unavailable", "message": "Could not save generation"}, retryable
    if isinstance(exc, ConnectionError):
        return {"code": "database_unavailable", "message": "Database connection unavailable"}, True
    if isinstance(exc, HTTPException):
        messages = {
            400: "The request or stored AI configuration is invalid",
            404: "The requested presentation or slide is unavailable",
            409: "The presentation changed during generation; retry the request",
        }
        return {
            "code": f"http_{exc.status_code}",
            "message": messages.get(exc.status_code, "Generation request failed"),
        }, False
    return {"code": "generation_failed", "message": "Generation could not be completed"}, False


async def record_failure(ctx, job_id, exc):
    error, transient = safe_error(exc)
    retry = transient and ctx.get("job_try", 1) < 3
    async with ctx["sessions"]() as session:
        job = await require_job(session, job_id, lock=True)
        if job.status in TERMINAL:
            return False
        job.status = "queued" if retry else "failed"
        job.current_step = "job.queued" if retry else "job.failed"
        job.error = None if retry else error
        job.updated_at = datetime.now(UTC)
        if not retry:
            job.completed_at = job.updated_at
        await session.commit()
        event = event_for(job, data={"retrying": retry})
    await publish(ctx["redis"], event)
    return retry


async def _execute(ctx, job_id):
    observer = JobObserver(job_id, ctx["sessions"], ctx["redis"])
    async with ctx["sessions"]() as session:
        job = await require_job(session, job_id, lock=True)
        if job.status in TERMINAL:
            return
        job.status, job.current_step = "running", "job.started"
        job.started_at = job.started_at or datetime.now(UTC)
        job.updated_at = datetime.now(UTC)
        job.progress = max(job.progress, 5)
        payload = GenerationRequest.model_validate(job.request)
        await session.commit()
        event = event_for(job)
    await publish(ctx["redis"], event)
    async with asyncio.timeout(660):  # Above two maximum configured 300s model attempts.
        async with ctx["sessions"]() as session:
            service = GenerationService(
                session,
                ctx["nvidia"],
                ctx["settings"],
                observer=observer,
                visual_service=ctx.get("visuals"),
            )
            await service.generate(payload)
    if observer.completion_event:
        await publish(ctx["redis"], observer.completion_event)


async def generate_job(ctx, job_id: str):
    job_uuid = UUID(job_id)
    # Connection-scoped PostgreSQL lock survives commits and releases on process death.
    # A second worker cannot run inference or persistence for the same job concurrently.
    lock_id = job_uuid.int % (2**63 - 1)
    try:
        async with ctx["database"].engine.connect() as connection:
            acquired = await connection.scalar(
                text("SELECT pg_try_advisory_lock(:id)"),
                {"id": lock_id},
            )
            await connection.commit()
            if not acquired:
                return
            try:
                await _execute(ctx, job_uuid)
            finally:
                try:
                    await connection.execute(
                        text("SELECT pg_advisory_unlock(:id)"),
                        {"id": lock_id},
                    )
                    await connection.commit()
                except BaseException:
                    # Never return a session-level lock to the connection pool.
                    await connection.invalidate()
                    raise
    except JobCancelled:
        return
    except asyncio.CancelledError:
        # ARQ requeues interrupted work; the durable running row can be reclaimed.
        raise
    except Exception as exc:
        logger.warning("Generation attempt failed (%s)", type(exc).__name__)
        try:
            retry = await record_failure(ctx, job_uuid, exc)
        except Exception as failure:
            logger.error("Job failure state unavailable (%s)", type(failure).__name__)
            # Recovery reconciles stale durable state after PostgreSQL becomes available.
            retry = ctx.get("job_try", 1) < 3
        if retry:
            raise Retry(defer=5 * ctx.get("job_try", 1)) from None
