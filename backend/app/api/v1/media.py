from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.media import MediaAsset
from app.services.visuals.storage import LocalMediaStorageProvider

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{asset_id}")
async def media_metadata(asset_id: UUID, session: Annotated[AsyncSession, Depends(get_db_session)]):
    asset = await session.get(MediaAsset, asset_id)
    if asset is None:
        raise HTTPException(404, "Media not found")
    return {
        "id": asset.id,
        "type": asset.type,
        "provider": asset.provider,
        "mime_type": asset.mime_type,
        "width": asset.width,
        "height": asset.height,
        "alt_text": asset.alt_text,
        "source_url": asset.source_url,
        "attribution": asset.attribution,
        "created_at": asset.created_at,
    }


@router.get("/{asset_id}/file")
async def media_file(
    asset_id: UUID, request: Request, session: Annotated[AsyncSession, Depends(get_db_session)]
):
    asset = await session.get(MediaAsset, asset_id)
    if asset is None:
        raise HTTPException(404, "Media not found")
    path = LocalMediaStorageProvider(request.app.state.settings).path(asset.stored_path)
    if not path.is_file():
        raise HTTPException(404, "Media file unavailable")
    return FileResponse(
        path,
        media_type=asset.mime_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
            "Cache-Control": "private, max-age=86400",
        },
    )
