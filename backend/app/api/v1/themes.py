from fastapi import APIRouter, Response

from app.api.v1.dependencies import Active, ContentRoute, Pagination, ResourceID, Service, changes
from app.models import Theme
from app.schemas.content import ThemeCreate, ThemeRead, ThemeUpdate

router = APIRouter(prefix="/themes", tags=["themes"], route_class=ContentRoute)


@router.get("", response_model=list[ThemeRead])
async def list_themes(service: Service, page: Pagination, active: Active):
    return await service.list(Theme, **page, is_active=active)


@router.post("", response_model=ThemeRead, status_code=201)
async def create_theme(payload: ThemeCreate, service: Service):
    return await service.create_theme(payload.model_dump())


@router.get("/{id}", response_model=ThemeRead)
async def get_theme(id: ResourceID, service: Service):
    return await service.require(Theme, id)


@router.patch("/{id}", response_model=ThemeRead)
async def update_theme(id: ResourceID, payload: ThemeUpdate, service: Service):
    return await service.update_theme(id, changes(payload))


@router.delete("/{id}", status_code=204)
async def delete_theme(id: ResourceID, service: Service):
    await service.delete_theme(id)
    return Response(status_code=204)


@router.post("/{id}/duplicate", response_model=ThemeRead, status_code=201)
async def duplicate_theme(id: ResourceID, service: Service):
    return await service.duplicate_theme(id)


@router.post("/{id}/set-default", response_model=ThemeRead)
async def set_default(id: ResourceID, service: Service):
    return await service.update_theme(id, {"is_default": True})
