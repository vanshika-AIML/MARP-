"""Bounded request and provider-output contracts for Phase 3."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from app.schemas.visuals import MediaReference, Placement

Action = Literal[
    "generate_full_deck",
    "generate_outline",
    "generate_single_slide",
    "rewrite_slide",
    "shorten_slide",
    "expand_slide",
    "simplify_slide",
    "change_tone",
    "make_professional",
    "make_creative",
    "make_technical",
    "improve_storytelling",
    "generate_agenda",
    "generate_conclusion",
    "generate_speaker_notes",
    "reorder_suggestions",
    "split_slide",
    "merge_slides",
    "improve_entire_deck",
    "suggest_visuals",
]
SlideType = Literal["title", "content", "image_text", "quote", "stats", "code", "table", "section"]
ShortText = Annotated[str, Field(max_length=2000)]
Title = Annotated[str, Field(min_length=1, max_length=200, pattern=r"\S")]
ThemeSlug = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")]


class AIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class VisualIntent(AIModel):
    type: Literal["image", "diagram", "none"] = "none"
    query: str | None = Field(default=None, max_length=300)
    mode: Literal["search", "generate", "none"] = "none"
    prompt: str | None = Field(default=None, max_length=1500)
    placement: Placement = "split"
    aspect_ratio: Literal["16:9", "3:2", "1:1", "9:16"] = "16:9"
    style: str | None = Field(default=None, max_length=200)
    alt_text: str | None = Field(default=None, max_length=300)
    source_attribution: str | None = Field(default=None, max_length=500)
    allow_repeat: bool = False

    @model_validator(mode="before")
    @classmethod
    def legacy_intent(cls, value):
        if isinstance(value, dict):
            value = dict(value)
            if "mode" not in value:
                value["mode"] = {"image": "search", "diagram": "generate"}.get(
                    value.get("type"), "none"
                )
            value["type"] = (
                "none"
                if value["mode"] == "none"
                else ("diagram" if value.get("type") == "diagram" else "image")
            )
        return value

    @model_validator(mode="after")
    def needs_query(self):
        if self.mode != "none" and not (self.query or self.prompt or "").strip():
            raise ValueError("A visual suggestion needs a query")
        return self


class StructuredBlock(AIModel):
    kind: Literal["paragraph", "bullets", "code", "table", "quote", "stat", "image"]
    text: str | None = Field(default=None, max_length=20_000)
    items: list[ShortText] | None = Field(default=None, max_length=30)
    language: str | None = Field(default=None, max_length=40, pattern=r"^[a-zA-Z0-9_+.-]*$")
    headers: list[ShortText] | None = Field(default=None, max_length=20)
    rows: list[Annotated[list[ShortText], Field(max_length=20)]] | None = Field(
        default=None, max_length=50
    )
    label: str | None = Field(default=None, max_length=200)
    value: str | None = Field(default=None, max_length=200)
    url: Annotated[HttpUrl, Field(max_length=2048)] | None = None
    alt: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def block_fields(self):
        required = {
            "paragraph": ["text"],
            "bullets": ["items"],
            "code": ["text"],
            "quote": ["text"],
            "stat": ["value", "label"],
            "table": ["headers", "rows"],
            "image": ["alt"],
        }[self.kind]
        if any(getattr(self, field) is None for field in required):
            raise ValueError("Missing required block fields")
        if self.kind == "table" and (
            not self.headers or any(len(row) != len(self.headers) for row in self.rows)
        ):
            raise ValueError("Table rows must match the nonempty headers")
        return self


class StructuredSlide(AIModel):
    type: SlideType = "content"
    title: Title
    content: list[ShortText | StructuredBlock] = Field(default_factory=list, max_length=40)
    speaker_notes: str | None = Field(default=None, max_length=10_000)
    visual_intent: VisualIntent = Field(default_factory=VisualIntent)
    media: MediaReference | None = None


class StructuredPresentation(AIModel):
    title: Title
    subtitle: str | None = Field(default=None, max_length=500)
    theme: ThemeSlug = "minimal"
    slides: list[StructuredSlide] = Field(min_length=1, max_length=40)


class NotesResult(AIModel):
    speaker_notes: str = Field(min_length=1, max_length=10_000)


class VisualResult(AIModel):
    visual_intent: VisualIntent


class ReorderResult(AIModel):
    slide_ids: list[UUID] = Field(min_length=1, max_length=40)
    rationale: str = Field(default="", max_length=2000)


class AIParameters(AIModel):
    temperature: float = Field(default=0.5, ge=0, le=1)
    max_tokens: int = Field(default=8192, ge=256, le=32768)
    timeout_seconds: float = Field(default=90, gt=0, le=300)
    default_slide_count: int = Field(default=10, strict=True, ge=1, le=40)
    default_tone: str = Field(default="professional", min_length=1, max_length=50)
    prompt_suffix: str = Field(default="", max_length=5000)


class GenerationOptions(AIModel):
    slide_count: int | None = Field(default=None, strict=True, ge=1, le=40)
    tone: str | None = Field(default=None, min_length=1, max_length=50)
    theme: ThemeSlug | None = None
    temperature: float | None = Field(default=None, ge=0, le=1)
    max_tokens: int | None = Field(default=None, ge=256, le=32768)
    persist: bool = True
    visuals_required: bool = False
    slide_ids: list[UUID] = Field(default_factory=list, max_length=40)


class GenerationRequest(AIModel):
    action: Action
    source_ids: list[UUID] = Field(default_factory=list, max_length=10)
    prompt: str = Field(min_length=1, max_length=20_000, pattern=r"\S")
    presentation_id: UUID | None = None
    slide_id: UUID | None = None
    options: GenerationOptions = Field(default_factory=GenerationOptions)

    @model_validator(mode="after")
    def targets(self):
        from app.services.ai.actions import ACTIONS

        if len(self.source_ids) != len(set(self.source_ids)):
            raise ValueError("source_ids must be unique")
        spec = ACTIONS[self.action]
        if spec.target == "slide" and self.slide_id is None:
            raise ValueError("This action needs slide_id")
        if spec.target != "slide" and self.slide_id is not None:
            raise ValueError("This action does not accept slide_id")
        if spec.target in {"deck", "merge"} and self.presentation_id is None:
            raise ValueError("This action needs presentation_id")
        ids = self.options.slide_ids
        if spec.target == "merge":
            if len(ids) < 2 or len(ids) != len(set(ids)):
                raise ValueError("merge_slides needs at least two distinct slide_ids")
        elif ids:
            raise ValueError("slide_ids are only accepted for merge_slides")
        return self


class GenerationResponse(AIModel):
    action: Action
    source_ids: list[UUID] = Field(default_factory=list)
    presentation: StructuredPresentation
    markdown: str
    presentation_id: UUID | None = None
    slide_ids: list[UUID] = Field(default_factory=list)
    persisted: bool = False
    reorder_suggestions: ReorderResult | None = None
