from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Path, Query
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BeforeValidator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.content import ContentService


class ContentRoute(APIRoute):
    """Phase 2 uses 400 for input errors; preserve Phase 1's existing 422 contract."""

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def validated(request):
            try:
                return await handler(request)
            except RequestValidationError as exc:
                raise HTTPException(400, "Request validation failed") from exc

        return validated


def resource_id(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError) as exc:
        raise HTTPException(404, "Resource not found") from exc


ResourceID = Annotated[UUID, BeforeValidator(resource_id)]
ConfigKey = Annotated[str, Path(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_-]*$")]


def service(session: Annotated[AsyncSession, Depends(get_db_session)]) -> ContentService:
    return ContentService(session)


Service = Annotated[ContentService, Depends(service)]


def pagination(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    search: Annotated[str | None, Query(max_length=200)] = None,
):
    return {"limit": limit, "offset": offset, "search": search}


Pagination = Annotated[dict, Depends(pagination)]


def catalog_filter(
    active: bool | None = None,
    include_all: Annotated[bool, Query(alias="all")] = False,
):
    return active if active is not None else (None if include_all else True)


Active = Annotated[bool | None, Depends(catalog_filter)]


def changes(payload):
    data = payload.model_dump(exclude_unset=True)
    if data.get("thumbnail_url") is not None:
        data["thumbnail_url"] = str(data["thumbnail_url"])
    return data
