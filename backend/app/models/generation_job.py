"""Durable generation lifecycle and results."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.content import Identity, Timestamps


class GenerationJob(Identity, Timestamps, Base):
    __tablename__ = "generation_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed', 'cancelled')",
            name="valid_status",
        ),
        CheckConstraint("progress BETWEEN 0 AND 100", name="valid_progress"),
        Index("ix_generation_jobs_status_updated", "status", "updated_at"),
    )
    action: Mapped[str] = mapped_column(String(100))
    presentation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("presentations.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[str | None] = mapped_column(String(100))
    request: Mapped[dict[str, Any]] = mapped_column(JSONB)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error: Mapped[dict[str, str] | None] = mapped_column(JSONB)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
