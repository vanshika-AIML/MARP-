"""Source files, bounded text chunks, and presentation provenance."""

from typing import Any
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.content import Identity, Timestamps


class UploadedSource(Identity, Timestamps, Base):
    __tablename__ = "uploaded_sources"
    __table_args__ = (
        CheckConstraint(
            "status IN ('uploaded','processing','ready','failed')", name="valid_status"
        ),
        CheckConstraint("size_bytes > 0", name="positive_size"),
        Index("ix_uploaded_sources_status_updated", "status", "updated_at"),
    )
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(100), unique=True)
    mime_type: Mapped[str] = mapped_column(String(150))
    extension: Mapped[str] = mapped_column(String(10))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    storage_path: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="uploaded", index=True)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    source_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
    error: Mapped[dict[str, str] | None] = mapped_column(JSONB)


class SourceChunk(Base):
    __tablename__ = "source_chunks"
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("uploaded_sources.id", ondelete="CASCADE"),
        primary_key=True,
    )
    index: Mapped[int] = mapped_column(Integer, primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    chunk_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)


class PresentationSource(Base):
    __tablename__ = "presentation_sources"
    presentation_id: Mapped[UUID] = mapped_column(
        ForeignKey("presentations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("uploaded_sources.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
