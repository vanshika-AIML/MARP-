"""Durable state transitions and safe, advisory Redis notifications."""

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select

from app.models import GenerationJob, Presentation, Slide
from app.schemas.jobs import JobEvent
from app.services.source_context import SourceContextService

logger = logging.getLogger("marp.jobs")
TERMINAL = {"completed", "failed", "cancelled"}
MESSAGES = {
    "job.queued": "Your presentation is queued.",
    "job.started": "Starting your presentation...",
    "prompt.analysis": "Understanding your idea...",
    "outline.started": "Planning the story...",
    "outline.completed": "The outline is ready.",
    "slide.started": "Shaping the content...",
    "slide.delta": "Shaping the content...",
    "slide.completed": "The slide content is ready.",
    "visual.planned": "The visual direction is ready.",
    "visual.planning": "Planning the finishing visuals...",
    "visual.searching": "Finding the right visual...",
    "visual.generating": "Creating a visual for this slide...",
    "visual.ready": "Placing the finishing visuals...",
    "visual.failed": "Continuing with a clean text-only slide.",
    "theme.applying": "Giving everything a consistent look...",
    "finalizing": "Adding the finishing touches...",
    "job.completed": "Your presentation is ready.",
    "job.failed": "We couldn't finish this request.",
    "job.cancelled": "Generation cancelled.",
}


class JobCancelled(Exception):
    pass


def channel(job_id):
    return f"marp:jobs:{job_id}:events"


def event_for(job, *, data=None):
    name = (
        job.current_step
        or {
            "queued": "job.queued",
            "running": "job.started",
            "completed": "job.completed",
            "failed": "job.failed",
            "cancelled": "job.cancelled",
        }[job.status]
    )
    return JobEvent(
        event=name,
        job_id=job.id,
        progress=job.progress,
        data={
            "status": job.status,
            "presentation_id": str(job.presentation_id) if job.presentation_id else None,
            "error": job.error,
            "result_available": job.result is not None,
            **(data or {}),
        },
        message=MESSAGES[name],
        updated_at=job.updated_at,
    )


async def publish(redis, event):
    try:
        async with asyncio.timeout(3):
            await redis.publish(channel(event.job_id), event.model_dump_json())
    except Exception as exc:
        # DB state was already committed. Reconnecting clients read the durable snapshot.
        logger.warning("Job event delivery unavailable (%s)", type(exc).__name__)


async def require_job(session, job_id, *, lock=False):
    query = select(GenerationJob).where(GenerationJob.id == job_id)
    if lock:
        query = query.with_for_update()
    job = await session.scalar(query.execution_options(populate_existing=True))
    if job is None:
        raise HTTPException(404, "Generation job not found")
    return job


async def create_job(session, queue, payload):
    await SourceContextService(session, None).validate(payload.source_ids)
    parent_id = payload.presentation_id
    if payload.slide_id:
        slide = await session.get(Slide, payload.slide_id)
        if slide is None or (parent_id and parent_id != slide.presentation_id):
            raise HTTPException(404, "Slide not found in presentation")
        parent_id = slide.presentation_id
    if parent_id and await session.get(Presentation, parent_id) is None:
        raise HTTPException(404, "Presentation not found")
    if payload.options.slide_ids:
        found = set(
            await session.scalars(
                select(Slide.id).where(
                    Slide.presentation_id == parent_id, Slide.id.in_(payload.options.slide_ids)
                )
            )
        )
        if found != set(payload.options.slide_ids):
            raise HTTPException(404, "Merge slide not found in presentation")
    job = GenerationJob(
        action=payload.action,
        presentation_id=parent_id,
        status="queued",
        progress=0,
        current_step="job.queued",
        request=payload.model_dump(mode="json"),
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    queued = event_for(job)
    await session.rollback()
    await publish(queue.redis, queued)
    try:
        async with asyncio.timeout(5):
            await queue.enqueue(queued.job_id)
    except Exception as exc:
        logger.warning("Job enqueue failed (%s)", type(exc).__name__)
        job = await require_job(session, queued.job_id, lock=True)
        # A timeout can occur after Redis accepted the job; never overwrite a worker's state.
        if job.status == "queued":
            job.status, job.current_step = "failed", "job.failed"
            job.error = {"code": "queue_unavailable", "message": "Job queue is unavailable"}
            job.completed_at = job.updated_at = datetime.now(UTC)
            await session.commit()
            await publish(queue.redis, event_for(job))
        else:
            await session.rollback()
        raise HTTPException(503, "Job queue is unavailable") from None
    return queued.job_id


async def cancel_job(session, redis, job_id):
    job = await require_job(session, job_id, lock=True)
    if job.status not in TERMINAL:
        job.status, job.current_step = "cancelled", "job.cancelled"
        job.completed_at = job.updated_at = datetime.now(UTC)
        job.result = None
    await session.commit()
    event = event_for(job)
    if job.status == "cancelled":
        await publish(redis, event)
    return job


class JobObserver:
    def __init__(self, job_id: UUID, sessions, redis):
        self.job_id, self.sessions, self.redis = job_id, sessions, redis
        self.completion_event = None

    async def progress(self, name, progress, data=None):
        async with self.sessions() as session:
            job = await require_job(session, self.job_id, lock=True)
            if job.status in TERMINAL:
                raise JobCancelled()
            job.progress = max(job.progress, progress)
            job.current_step, job.updated_at = name, datetime.now(UTC)
            await session.commit()
            event = event_for(job, data=data)
        await publish(self.redis, event)

    async def guard(self, session):
        # Held until BOTH the generated presentation and completed job are committed.
        job = await require_job(session, self.job_id, lock=True)
        if job.status != "running":
            raise JobCancelled()

    async def complete(self, session, response):
        job = await require_job(session, self.job_id, lock=True)
        if job.status != "running":
            raise JobCancelled()
        job.status, job.progress, job.current_step = "completed", 100, "job.completed"
        job.result = response.model_dump(mode="json")
        job.presentation_id = response.presentation_id
        job.completed_at = job.updated_at = datetime.now(UTC)
        await session.flush()
        self.completion_event = event_for(job)
