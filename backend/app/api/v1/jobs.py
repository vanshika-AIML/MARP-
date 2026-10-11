from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import HTTPConnection

from app.core.database import get_db_session
from app.core.job_queue import JobQueue
from app.core.rate_limit import ai_rate_limit
from app.schemas.ai import GenerationRequest
from app.schemas.jobs import JobAccepted, JobRead
from app.services.jobs import cancel_job, create_job, require_job

router = APIRouter(prefix="/ai/jobs", tags=["ai jobs"])


def get_job_queue(connection: HTTPConnection):
    return connection.app.state.job_queue


def get_job_sessions(connection: HTTPConnection):
    return connection.app.state.database.session_factory


@router.post("", response_model=JobAccepted, status_code=202)
async def submit(
    payload: GenerationRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    queue: Annotated[JobQueue, Depends(get_job_queue)],
    _rate_limit: Annotated[None, Depends(ai_rate_limit)],
):
    job_id = await create_job(session, queue, payload)
    return JobAccepted(job_id=job_id, status="queued")


@router.get("/{job_id}", response_model=JobRead)
async def lookup(job_id: UUID, session: Annotated[AsyncSession, Depends(get_db_session)]):
    return await require_job(session, job_id)


@router.post("/{job_id}/cancel", response_model=JobRead)
async def cancel(
    job_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    queue: Annotated[JobQueue, Depends(get_job_queue)],
    _rate_limit: Annotated[None, Depends(ai_rate_limit)],
):
    return await cancel_job(session, queue.redis, job_id)
