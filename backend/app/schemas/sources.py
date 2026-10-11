from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

SourceStatus = Literal["uploaded", "processing", "ready", "failed"]


class Section(BaseModel):
    title: str = Field(default="", max_length=500)
    text: str = Field(max_length=200_000)
    reference: dict[str, str | int] = Field(default_factory=dict)
    kind: str = "section"


class ExtractionResult(BaseModel):
    title: str = Field(max_length=500)
    text: str = Field(max_length=200_000)
    sections: list[Section] = Field(default_factory=list, max_length=500)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    original_filename: str
    mime_type: str
    extension: str
    size_bytes: int
    status: SourceStatus
    extracted_text: str | None
    metadata: dict[str, Any] = Field(validation_alias="source_metadata")
    error: dict[str, str] | None
    created_at: datetime
    updated_at: datetime


class UploadAccepted(BaseModel):
    source_id: UUID
    status: SourceStatus


class SourceEvent(BaseModel):
    event: Literal[
        "source.uploaded",
        "source.processing",
        "source.extracting",
        "source.chunking",
        "source.ready",
        "source.failed",
        "source.deleted",
    ]
    source_id: UUID
    progress: int = Field(ge=0, le=100)
    data: dict[str, Any] = Field(default_factory=dict)
    message: str
    updated_at: datetime
