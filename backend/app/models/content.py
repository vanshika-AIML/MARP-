"""Phase 2 persistence. Relationships are enforced by PostgreSQL, not lazy loading."""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Identity:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)


class Updated:
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Timestamps(Updated):
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Theme(Identity, Timestamps, Base):
    __tablename__ = "themes"
    __table_args__ = (
        Index(
            "uq_themes_one_default", "is_default", unique=True, postgresql_where=text("is_default")
        ),
        CheckConstraint("NOT is_default OR is_active", name="default_is_active"),
        Index("ix_themes_active_sort", "is_active", "sort_order"),
    )
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default=text("'{}'"))
    css: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Presentation(Identity, Timestamps, Base):
    __tablename__ = "presentations"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'ready', 'archived')", name="valid_status"),
        Index("ix_presentations_status_updated", "status", "updated_at"),
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    theme_id: Mapped[UUID | None] = mapped_column(ForeignKey("themes.id", ondelete="SET NULL"))
    markdown: Mapped[str] = mapped_column(Text, default="", server_default="")
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")


class Slide(Identity, Timestamps, Base):
    __tablename__ = "slides"
    __table_args__ = (
        UniqueConstraint(
            "presentation_id",
            "position",
            name="uq_slides_presentation_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint("position >= 0", name="nonnegative_position"),
    )
    presentation_id: Mapped[UUID] = mapped_column(
        ForeignKey("presentations.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    type: Mapped[str | None] = mapped_column(String(100))
    title: Mapped[str | None] = mapped_column(String(200))
    raw_markdown: Mapped[str] = mapped_column(Text, default="", server_default="")
    structured_content: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    speaker_notes: Mapped[str | None] = mapped_column(Text)
    visual_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)


class Template(Identity, Timestamps, Base):
    __tablename__ = "templates"
    __table_args__ = (Index("ix_templates_active_sort", "is_active", "sort_order"),)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    category: Mapped[str] = mapped_column(String(100), default="general", server_default="general")
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048))
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default=text("'[]'"))
    theme_id: Mapped[UUID | None] = mapped_column(ForeignKey("themes.id", ondelete="SET NULL"))
    starter_markdown: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class AppConfig(Identity, Updated, Base):
    __tablename__ = "app_configs"
    __table_args__ = (UniqueConstraint("namespace", "key"),)
    namespace: Mapped[str] = mapped_column(String(100))
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[Any] = mapped_column(JSONB(none_as_null=False), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class FeatureFlag(Identity, Updated, Base):
    __tablename__ = "feature_flags"
    key: Mapped[str] = mapped_column(String(100), unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
