from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import ConfigKey, ContentRoute, Pagination, Service
from app.core.database import get_db_session
from app.models import AppConfig, FeatureFlag
from app.schemas.content import (
    AppConfigRead,
    AppConfigUpdate,
    FeatureFlagRead,
    FeatureFlagUpdate,
)
from app.schemas.visuals import VisualSettings

router = APIRouter(tags=["configuration"], route_class=ContentRoute)


@router.get("/admin/visuals", response_model=VisualSettings)
async def visual_defaults(session: Annotated[AsyncSession, Depends(get_db_session)]):
    from app.services.visuals.service import load_visual_settings

    return await load_visual_settings(session)


@router.put('/admin/visuals', response_model=VisualSettings)
async def update_visual_defaults(payload: VisualSettings, service: Service):
    values = payload.model_dump()
    for key, value in values.items():
        await service.put_config('visuals', key, {'value': value})
    return payload


@router.get("/admin/config", response_model=list[AppConfigRead])
async def list_config(service: Service, page: Pagination):
    return await service.list(AppConfig, **page)


@router.get("/admin/config/{namespace}", response_model=list[AppConfigRead])
async def namespace_config(namespace: ConfigKey, service: Service, page: Pagination):
    return await service.list(AppConfig, **page, namespace=namespace)


@router.put("/admin/config/{namespace}/{key}", response_model=AppConfigRead)
async def put_config(
    namespace: ConfigKey, key: ConfigKey, payload: AppConfigUpdate, service: Service
):
    return await service.put_config(namespace, key, payload.model_dump())


@router.get("/feature-flags", response_model=list[FeatureFlagRead])
async def list_flags(service: Service, page: Pagination):
    return await service.list(FeatureFlag, **page)


@router.put("/admin/feature-flags/{key}", response_model=FeatureFlagRead)
async def put_flag(key: ConfigKey, payload: FeatureFlagUpdate, service: Service):
    return await service.put_flag(key, payload.model_dump())
