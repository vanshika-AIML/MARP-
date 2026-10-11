from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.content import Identity


class MediaAsset(Identity, Base):
    __tablename__ = "media_assets"
    __table_args__ = (Index("ix_media_assets_provider_created", "provider", "created_at"),)
    type: Mapped[str] = mapped_column(String(20))
    provider: Mapped[str] = mapped_column(String(100))
    source_url: Mapped[str | None] = mapped_column(Text)
    stored_path: Mapped[str] = mapped_column(String(100), unique=True)
    mime_type: Mapped[str] = mapped_column(String(50))
    width: Mapped[int]
    height: Mapped[int]
    alt_text: Mapped[str] = mapped_column(String(300))
    attribution: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    prompt_query: Mapped[str] = mapped_column(Text)
    asset_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
    digest: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MediaCache(Base):
    __tablename__ = "media_cache"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    asset_id: Mapped[UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
