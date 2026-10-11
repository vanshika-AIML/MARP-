from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.ai import GenerationResponse

JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]
EventName = Literal[
    "job.queued",
    "job.started",
    "prompt.analysis",
    "outline.started",
    "outline.completed",
    "slide.started",
    "slide.delta",
    "slide.completed",
    "visual.planned",
    "visual.planning",
    "visual.searching",
    "visual.generating",
    "visual.ready",
    "visual.failed",
    "theme.applying",
    "finalizing",
    "job.completed",
    "job.failed",
    "job.cancelled",
]


class JobAccepted(BaseModel):
    job_id: UUID
    status: JobStatus


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    action: str
    presentation_id: UUID | None
    status: JobStatus
    progress: int
    current_step: str | None
    result: GenerationResponse | None
    error: dict[str, str] | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    updated_at: datetime


class JobEvent(BaseModel):
    event: EventName
    job_id: UUID
    progress: int = Field(ge=0, le=100)
    data: dict[str, Any] = Field(default_factory=dict)
    message: str
    updated_at: datetime
