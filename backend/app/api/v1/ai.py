from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.rate_limit import ai_rate_limit
from app.schemas.ai import GenerationRequest, GenerationResponse
from app.services.ai.generation_service import GenerationService

router = APIRouter(prefix="/ai", tags=["ai"])


def get_generation_service(
    request: Request, session: Annotated[AsyncSession, Depends(get_db_session)]
) -> GenerationService:
    return GenerationService(session, request.app.state.nvidia, request.app.state.settings)


@router.post("/generate", response_model=GenerationResponse)
async def generate(
    payload: GenerationRequest,
    service: Annotated[GenerationService, Depends(get_generation_service)],
    _rate_limit: Annotated[None, Depends(ai_rate_limit)],
):
    return await service.generate(payload)
