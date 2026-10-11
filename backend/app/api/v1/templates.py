from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.v1.dependencies import Active, ContentRoute, Pagination, ResourceID, Service, changes
from app.models import Template
from app.schemas.content import PresentationRead, TemplateCreate, TemplateRead, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"], route_class=ContentRoute)


@router.get("", response_model=list[TemplateRead])
async def list_templates(
    service: Service,
    page: Pagination,
    active: Active,
    category: Annotated[str | None, Query(max_length=100)] = None,
    featured: bool | None = None,
):
    return await service.list(
        Template, **page, is_active=active, category=category, is_featured=featured
    )


@router.post("", response_model=TemplateRead, status_code=201)
async def create_template(payload: TemplateCreate, service: Service):
    return await service.create_template(changes(payload))


@router.get("/{id}", response_model=TemplateRead)
async def get_template(id: ResourceID, service: Service):
    return await service.require(Template, id)


@router.patch("/{id}", response_model=TemplateRead)
async def update_template(id: ResourceID, payload: TemplateUpdate, service: Service):
    return await service.update_template(id, changes(payload))


@router.delete("/{id}", status_code=204)
async def delete_template(id: ResourceID, service: Service):
    await service.delete_template(id)
    return Response(status_code=204)


@router.post("/{id}/duplicate", response_model=TemplateRead, status_code=201)
async def duplicate_template(id: ResourceID, service: Service):
    return await service.duplicate_template(id)


@router.post("/{id}/create-presentation", response_model=PresentationRead, status_code=201)
async def create_from_template(id: ResourceID, service: Service):
    return await service.from_template(id)
