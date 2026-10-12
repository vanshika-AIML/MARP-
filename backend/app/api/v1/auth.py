from fastapi import APIRouter, Request

from app.core.auth import Principal

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/me")
async def current_session(request: Request):
    principal: Principal = request.state.principal
    settings = request.app.state.settings
    return {
        "subject": principal.subject,
        "roles": sorted(principal.roles),
        "is_admin": settings.auth_admin_role in principal.roles,
        "is_editor": settings.auth_editor_role in principal.roles,
    }
