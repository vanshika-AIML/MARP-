from fastapi import APIRouter, Request, Response

from app.core.health import dependency_statuses
from app.schemas.health import ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get(
    "/ready", response_model=ReadinessResponse, responses={503: {"model": ReadinessResponse}}
)
async def readiness(request: Request, response: Response) -> ReadinessResponse:
    statuses = await dependency_statuses(
        request.app.state.database,
        request.app.state.redis,
        request.app.state.settings.dependency_timeout_seconds,
    )
    ready = all(status == "connected" for status in statuses.values())
    response.status_code = 200 if ready else 503
    response.headers["Cache-Control"] = "no-store"
    return ReadinessResponse(status="ok" if ready else "unavailable", **statuses)
