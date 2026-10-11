from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

Placement = Literal["full_bleed", "split", "hero", "background", "framed"]


class VisualSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    search_enabled: bool = False
    generation_enabled: bool = False
    preferred_strategy: Literal["auto", "search", "generate"] = "auto"
    max_visuals_per_deck: int = Field(default=6, ge=0, le=20)
    default_image_style: str = Field(
        default="editorial, restrained, presentation-ready", max_length=200
    )
    search_provider: Literal["none", "pixabay"] = "none"
    generation_provider: Literal["none", "stability"] = "none"


class MediaReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: UUID
    url: str = Field(pattern=r"^/[a-zA-Z0-9/_-]+/media/[0-9a-f-]{36}/file$")
    alt_text: str = Field(max_length=300)
    placement: Placement = "split"
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    attribution: str | None = Field(default=None, max_length=500)
    source_url: HttpUrl | None = None
