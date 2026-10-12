from datetime import datetime
from typing import Annotated, ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, JsonValue, model_validator

Name = Annotated[str, Field(min_length=1, max_length=200, pattern=r"\S")]
Description = Annotated[str, Field(max_length=10000)]
Markdown = Annotated[str, Field(max_length=2_000_000)]
Key = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_-]*$")]
Slug = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
Position = Annotated[int, Field(strict=True, ge=0, le=100_000)]
SortOrder = Annotated[int, Field(strict=True, ge=-100_000, le=100_000)]
Status = Literal["draft", "ready", "archived"]
JSONObject = dict[str, JsonValue]
ThumbnailURL = Annotated[HttpUrl, Field(max_length=2048)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Patch(Input):
    nullable_fields: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="before")
    @classmethod
    def reject_null_for_nonnullable_fields(cls, data):
        # An omitted patch field is different from an explicit null.
        if isinstance(data, dict) and any(
            value is None and key not in cls.nullable_fields for key, value in data.items()
        ):
            raise ValueError("This field does not accept null")
        return data


class Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class TimedRead(Read):
    created_at: datetime
    updated_at: datetime


class PresentationCreate(Input):
    title: Name = "Untitled presentation"
    description: Description | None = None
    theme_id: UUID | None = None
    markdown: Markdown = ""
    status: Status = "draft"


class PresentationUpdate(Patch):
    nullable_fields = frozenset({"description", "theme_id"})
    title: Name | None = None
    description: Description | None = None
    theme_id: UUID | None = None
    markdown: Markdown | None = None
    status: Status | None = None


class PresentationListItem(TimedRead):
    title: str
    description: str | None
    theme_id: UUID | None
    status: Status


class PresentationRead(PresentationListItem):
    markdown: str


class PresentationExport(Input):
    title: Name | None = None
    markdown: Markdown | None = None


class SlideCreate(Input):
    position: Position | None = None
    type: Annotated[str, Field(max_length=100)] | None = None
    title: Name | None = None
    raw_markdown: Markdown = ""
    structured_content: JSONObject | None = None
    speaker_notes: Description | None = None
    visual_config: JSONObject | None = None


class SlideUpdate(Patch):
    nullable_fields = frozenset(
        {
            "type",
            "title",
            "structured_content",
            "speaker_notes",
            "visual_config",
        }
    )
    position: Position | None = None
    type: Annotated[str, Field(max_length=100)] | None = None
    title: Name | None = None
    raw_markdown: Markdown | None = None
    structured_content: JSONObject | None = None
    speaker_notes: Description | None = None
    visual_config: JSONObject | None = None


class SlideRead(TimedRead):
    presentation_id: UUID
    position: int
    type: str | None
    title: str | None
    raw_markdown: str
    structured_content: JSONObject | None
    speaker_notes: str | None
    visual_config: JSONObject | None


class SlideReorderRequest(Input):
    slide_ids: list[UUID] = Field(max_length=1000)


class TemplateCreate(Input):
    name: Name
    description: Description = ""
    category: Key = "general"
    thumbnail_url: ThumbnailURL | None = None
    tags: list[Annotated[str, Field(min_length=1, max_length=80)]] = Field(
        default_factory=list, max_length=50
    )
    theme_id: UUID | None = None
    starter_markdown: Markdown = ""
    is_active: bool = True
    is_featured: bool = False
    sort_order: SortOrder = 0


class TemplateUpdate(Patch):
    nullable_fields = frozenset({"thumbnail_url", "theme_id"})
    name: Name | None = None
    description: Description | None = None
    category: Key | None = None
    thumbnail_url: ThumbnailURL | None = None
    tags: list[Annotated[str, Field(min_length=1, max_length=80)]] | None = Field(
        default=None, max_length=50
    )
    theme_id: UUID | None = None
    starter_markdown: Markdown | None = None
    is_active: bool | None = None
    is_featured: bool | None = None
    sort_order: SortOrder | None = None


class TemplateRead(TimedRead):
    name: str
    description: str
    category: str
    thumbnail_url: str | None
    tags: list[str]
    theme_id: UUID | None
    starter_markdown: str
    is_active: bool
    is_featured: bool
    sort_order: int


class ThemeCreate(Input):
    name: Name
    slug: Slug
    description: Description | None = None
    config: JSONObject = Field(default_factory=dict)
    css: Annotated[str, Field(max_length=500_000)] | None = None
    is_active: bool = True
    is_default: bool = False
    sort_order: SortOrder = 0


class ThemeUpdate(Patch):
    nullable_fields = frozenset({"description", "css"})
    name: Name | None = None
    slug: Slug | None = None
    description: Description | None = None
    config: JSONObject | None = None
    css: Annotated[str, Field(max_length=500_000)] | None = None
    is_active: bool | None = None
    is_default: bool | None = None
    sort_order: SortOrder | None = None


class ThemeRead(TimedRead):
    name: str
    slug: str
    description: str | None
    config: JSONObject
    css: str | None
    is_active: bool
    is_default: bool
    sort_order: int


class AppConfigUpdate(Input):
    value: JsonValue
    description: Description | None = None


class AppConfigRead(Read):
    namespace: str
    key: str
    value: JsonValue
    description: str | None
    updated_at: datetime


class FeatureFlagUpdate(Input):
    enabled: bool
    config: JSONObject | None = None


class FeatureFlagRead(Read):
    key: str
    enabled: bool
    config: JSONObject | None
    updated_at: datetime
