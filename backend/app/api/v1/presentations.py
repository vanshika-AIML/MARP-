from fastapi import APIRouter, Response

from app.api.v1.dependencies import ContentRoute, Pagination, ResourceID, Service, changes
from app.models import Presentation
from app.schemas.content import (
    PresentationCreate,
    PresentationListItem,
    PresentationRead,
    PresentationUpdate,
    SlideCreate,
    SlideRead,
    SlideReorderRequest,
    SlideUpdate,
    Status,
)

router = APIRouter(tags=["presentations"], route_class=ContentRoute)


@router.get("/presentations", response_model=list[PresentationListItem])
async def list_presentations(service: Service, page: Pagination, status: Status | None = None):
    return await service.list(Presentation, **page, status=status)


@router.post("/presentations", response_model=PresentationRead, status_code=201)
async def create_presentation(payload: PresentationCreate, service: Service):
    return await service.create_presentation(payload.model_dump())


@router.get("/presentations/{id}", response_model=PresentationRead)
async def get_presentation(id: ResourceID, service: Service):
    return await service.require(Presentation, id)


@router.patch("/presentations/{id}", response_model=PresentationRead)
async def update_presentation(id: ResourceID, payload: PresentationUpdate, service: Service):
    return await service.update_presentation(id, changes(payload))


@router.delete("/presentations/{id}", status_code=204)
async def delete_presentation(id: ResourceID, service: Service):
    await service.delete_presentation(id)
    return Response(status_code=204)


@router.get("/presentations/{id}/slides", response_model=list[SlideRead])
async def list_slides(id: ResourceID, service: Service, page: Pagination):
    return await service.slides(id, **page)


@router.post("/presentations/{id}/slides", response_model=SlideRead, status_code=201)
async def create_slide(id: ResourceID, payload: SlideCreate, service: Service):
    return await service.create_slide(id, payload.model_dump())


@router.patch("/slides/{id}", response_model=SlideRead)
async def update_slide(id: ResourceID, payload: SlideUpdate, service: Service):
    return await service.update_slide(id, changes(payload))


@router.delete("/slides/{id}", status_code=204)
async def delete_slide(id: ResourceID, service: Service):
    await service.delete_slide(id)
    return Response(status_code=204)


@router.post("/presentations/{id}/slides/reorder", response_model=list[SlideRead])
async def reorder_slides(id: ResourceID, payload: SlideReorderRequest, service: Service):
    return await service.reorder(id, payload.slide_ids)
