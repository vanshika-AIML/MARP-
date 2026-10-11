from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import HTTPConnection

from app.api.v1.jobs import get_job_queue
from app.core.database import get_db_session
from app.core.job_queue import JobQueue
from app.core.rate_limit import upload_rate_limit
from app.schemas.sources import SourceRead, UploadAccepted
from app.services.sources import create_source, delete_source, require_source
from app.services.storage import StorageProvider, get_storage

router = APIRouter(prefix="/uploads", tags=["sources"])


def get_source_storage(connection: HTTPConnection):
    return get_storage(connection.app.state.settings)


@router.post("", response_model=UploadAccepted, status_code=202)
async def upload_source(
    request: Request,
    file: Annotated[UploadFile, File()],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    queue: Annotated[JobQueue, Depends(get_job_queue)],
    storage: Annotated[StorageProvider, Depends(get_source_storage)],
    _rate_limit: Annotated[None, Depends(upload_rate_limit)],
):
    source_id = await create_source(session, queue, storage, file, request.app.state.settings)
    source = await require_source(session, source_id)
    return UploadAccepted(source_id=source_id, status=source.status)


@router.get("/{source_id}", response_model=SourceRead)
async def read_source(source_id: UUID, session: Annotated[AsyncSession, Depends(get_db_session)]):
    return await require_source(session, source_id)


@router.delete("/{source_id}", status_code=204)
async def remove_source(
    source_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    queue: Annotated[JobQueue, Depends(get_job_queue)],
    storage: Annotated[StorageProvider, Depends(get_source_storage)],
    _rate_limit: Annotated[None, Depends(upload_rate_limit)],
):
    await delete_source(session, storage, queue.redis, source_id)
    return Response(status_code=204)
