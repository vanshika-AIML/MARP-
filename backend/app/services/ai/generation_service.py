"""Generate outside database transactions, then apply validated changes atomically."""

import json
from contextlib import nullcontext
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.models import AppConfig, Presentation, Slide, Theme
from app.prompts.builder import build_messages
from app.schemas.ai import (
    AIParameters,
    GenerationRequest,
    GenerationResponse,
    NotesResult,
    ReorderResult,
    StructuredPresentation,
    StructuredSlide,
    VisualResult,
)
from app.services.ai.actions import ACTIONS
from app.services.ai.json_output import parse_json
from app.services.ai.nvidia_nim import AIProviderError, NvidiaNIMClient
from app.services.content import transaction
from app.services.marp import compile_markdown, split_markdown
from app.services.presentations.marp_compiler import (
    compile_slide,
    frontmatter,
    media_header,
    update_notes,
    update_visual,
)
from app.services.presentations.marp_parser import parse_markdown, parse_slide
from app.services.source_context import SourceContextService
from app.services.visuals.service import VisualService, load_visual_settings


@dataclass
class SlidePlan:
    id: UUID | None
    data: StructuredSlide
    raw: str
    changed: bool = False


@dataclass
class Snapshot:
    id: UUID
    title: str
    markdown: str
    theme_id: UUID | None
    signature: str
    rows: list[SlidePlan]
    deck: StructuredPresentation


class GenerationService:
    def __init__(
        self,
        session: AsyncSession,
        client: NvidiaNIMClient,
        settings: Settings,
        *,
        observer=None,
        visual_service=None,
    ):
        self.session, self.client, self.settings = session, client, settings
        self.observer = observer
        self.visual_service = visual_service

    async def _progress(self, name, progress, data=None):
        if self.observer:
            await self.observer.progress(name, progress, data)

    async def _parameters(self, request):
        values = {
            "temperature": self.settings.ai_temperature,
            "max_tokens": self.settings.ai_max_tokens,
            "timeout_seconds": self.settings.ai_timeout_seconds,
            "default_slide_count": self.settings.ai_default_slide_count,
            "default_tone": self.settings.ai_default_tone,
        }
        rows = await self.session.scalars(select(AppConfig).where(AppConfig.namespace == "ai"))
        for row in rows:
            if row.key in AIParameters.model_fields:
                values[row.key] = row.value
        try:
            parameters = AIParameters.model_validate(values)
        except ValidationError as exc:
            raise HTTPException(400, "Invalid AI admin configuration") from exc
        changes = request.options.model_dump(exclude_none=True)
        values = parameters.model_dump()
        for name in ("temperature", "max_tokens"):
            if name in changes:
                values[name] = changes[name]
        values["default_slide_count"] = changes.get("slide_count", values["default_slide_count"])
        values["default_tone"] = changes.get("tone", values["default_tone"])
        return AIParameters.model_validate(values)

    @staticmethod
    def _signature(parent, rows):
        # Detect Phase 2 edits, including supplemental-only changes, during model inference.
        parent_data = {c.name: getattr(parent, c.name) for c in Presentation.__table__.columns}
        row_data = [{c.name: getattr(row, c.name) for c in Slide.__table__.columns} for row in rows]
        return json.dumps([parent_data, row_data], default=str, sort_keys=True)

    async def _load(self, presentation_id, *, lock=False):
        query = select(Presentation).where(Presentation.id == presentation_id)
        if lock:
            query = query.with_for_update()
        parent = await self.session.scalar(query.execution_options(populate_existing=True))
        if parent is None:
            raise HTTPException(404, "Presentation not found")
        rows = list(
            await self.session.scalars(
                select(Slide)
                .where(Slide.presentation_id == parent.id)
                .order_by(Slide.position, Slide.id)
                .execution_options(populate_existing=True)
            )
        )
        return parent, rows

    async def _snapshot(self, request):
        presentation_id = request.presentation_id
        if request.slide_id:
            target = await self.session.get(Slide, request.slide_id)
            if target is None or (presentation_id and target.presentation_id != presentation_id):
                raise HTTPException(404, "Slide not found in presentation")
            presentation_id = target.presentation_id
        if presentation_id is None:
            return None
        parent, rows = await self._load(presentation_id)
        if len(rows) > 40:
            raise HTTPException(400, "AI actions currently support decks with at most 40 slides")
        if set(request.options.slide_ids) - {row.id for row in rows}:
            raise HTTPException(404, "Merge slide not found in presentation")
        plans = []
        try:
            for row in rows:
                data = None
                if row.structured_content:
                    try:
                        candidate = StructuredSlide.model_validate(row.structured_content)
                        if compile_slide(candidate) == row.raw_markdown:
                            data = candidate
                    except ValidationError:
                        pass
                data = data or parse_slide(row.raw_markdown, fallback_title=row.title or "Untitled")
                data.speaker_notes = (
                    row.speaker_notes if row.speaker_notes is not None else data.speaker_notes
                )
                plans.append(SlidePlan(row.id, data, row.raw_markdown))
            deck = parse_markdown(parent.markdown, fallback_title=parent.title)
            deck.title = parent.title
            if plans:
                deck.slides = [plan.data for plan in plans]
        except (ValueError, ValidationError) as exc:
            raise HTTPException(
                400, "Existing deck exceeds the structured AI context limits"
            ) from exc
        return Snapshot(
            parent.id,
            parent.title,
            parent.markdown,
            parent.theme_id,
            self._signature(parent, rows),
            plans,
            deck,
        )

    @staticmethod
    def _validate_result(result, request, snapshot, parameters):
        mode = ACTIONS[request.action].mode
        if mode == "reorder":
            ids = result.slide_ids
            if len(ids) != len(set(ids)) or set(ids) != {row.id for row in snapshot.rows}:
                raise ValueError("Reorder must include every existing slide ID exactly once")
        elif isinstance(result, StructuredPresentation):
            count = len(result.slides)
            if mode in {"append", "replace", "merge"} and count != 1:
                raise ValueError("Action must return exactly one slide")
            if mode == "split" and not 2 <= count <= 5:
                raise ValueError("Split must return 2 to 5 slides")
            if mode == "deck":
                expected = (
                    len(snapshot.rows)
                    if request.action == "improve_entire_deck"
                    else parameters.default_slide_count
                )
                if count != expected:
                    raise ValueError("Generated slide count does not match the requested count")

    async def _generate_output(self, request, snapshot, parameters, theme, source_context=None):
        mode = ACTIONS[request.action].mode
        schema = {"notes": NotesResult, "visuals": VisualResult, "reorder": ReorderResult}.get(
            mode, StructuredPresentation
        )
        context = {
            "presentation": snapshot.deck.model_dump(mode="json") if snapshot else None,
            "slides": [
                {"id": str(row.id), "slide": row.data.model_dump(mode="json")}
                for row in snapshot.rows
            ]
            if snapshot
            else [],
            "selected_slide_id": str(request.slide_id) if request.slide_id else None,
            "merge_slide_ids": [str(id) for id in request.options.slide_ids],
        }
        if source_context:
            context["sources"] = json.loads(source_context)
        context_json = json.dumps(context, ensure_ascii=False)
        if len(context_json) > 160_000:
            raise HTTPException(400, "Deck exceeds the AI context limit; shorten the deck first")
        count = (
            len(snapshot.rows)
            if request.action == "improve_entire_deck"
            else parameters.default_slide_count
        )
        messages = build_messages(
            request.action,
            request.prompt,
            slide_count=count,
            tone=parameters.default_tone,
            theme=theme,
            context=context_json,
            schema=schema.model_json_schema(),
            suffix=parameters.prompt_suffix,
            grounded=bool(source_context),
        )
        for attempt in range(2):
            await self._progress(
                "outline.started" if request.action == "generate_outline" else "prompt.analysis",
                20,
            )
            raw = await self.client.complete(
                messages,
                temperature=parameters.temperature if attempt == 0 else 0,
                max_tokens=parameters.max_tokens,
                timeout_seconds=parameters.timeout_seconds,
            )
            try:
                result = schema.model_validate(parse_json(raw))
                self._validate_result(result, request, snapshot, parameters)
                if isinstance(result, StructuredPresentation):
                    for slide in result.slides:
                        slide.media = None
                        slide.visual_intent.source_attribution = None
                return result
            except (ValueError, TypeError, RecursionError):
                if attempt:
                    raise AIProviderError(
                        502, "ai_invalid_structured_output", "AI returned invalid structured output"
                    ) from None
                # Alternate user/assistant roles per NIM contract. Do not log raw model content.
                messages += [
                    {"role": "assistant", "content": raw[:100_000]},
                    {
                        "role": "user",
                        "content": "The output did not match the schema or action rules. "
                        "Return a corrected JSON object, including the requested slide count. "
                        "Do not invent missing facts or return prose.",
                    },
                ]
        raise AssertionError("unreachable")

    def _plan(self, request, snapshot, output, theme):
        mode = ACTIONS[request.action].mode
        plans = deepcopy(snapshot.rows) if snapshot else []
        deck = deepcopy(snapshot.deck) if snapshot else None
        header = split_markdown(snapshot.markdown).frontmatter if snapshot else None
        if isinstance(output, StructuredPresentation):
            output.theme = theme
            new = [SlidePlan(None, slide, compile_slide(slide), True) for slide in output.slides]
            if mode == "deck":
                if request.action == "improve_entire_deck":
                    for old, row in zip(plans, new, strict=True):
                        row.id = old.id
                plans, deck = new, output
            elif mode == "append":
                if request.action == "generate_agenda":
                    position = 1 if plans and plans[0].data.type == "title" else 0
                    plans[position:position] = new
                else:
                    plans.extend(new)
                deck = deck or output
            elif mode in {"replace", "split"}:
                position = next(i for i, row in enumerate(plans) if row.id == request.slide_id)
                new[0].id = plans[position].id
                plans[position : position + 1] = new
            elif mode == "merge":
                selected = set(request.options.slide_ids)
                position = next(i for i, row in enumerate(plans) if row.id in selected)
                new[0].id = plans[position].id
                plans = [row for row in plans if row.id not in selected]
                plans[position:position] = new
        elif mode in {"notes", "visuals"}:
            row = next(row for row in plans if row.id == request.slide_id)
            if mode == "notes":
                row.data.speaker_notes = output.speaker_notes
                row.raw = update_notes(row.raw, output.speaker_notes)
            else:
                row.data.visual_intent = output.visual_intent
                row.raw = update_visual(row.raw, output.visual_intent)
            row.changed = True
        elif mode == "reorder":
            # Recommendations never mutate or silently recompile the user's deck.
            return deck, plans, snapshot.markdown
        if not 1 <= len(plans) <= 40:
            raise HTTPException(400, "The resulting AI deck must contain 1 to 40 slides")
        deck.theme, deck.slides = theme, [row.data for row in plans]
        if header is None:
            header = frontmatter(deck)
        elif request.options.theme:
            import re

            if re.search(r"(?m)^theme\s*:", header):
                header = re.sub(r"(?m)^theme\s*:.*$", f"theme: {theme}", header)
            elif header:
                header = header.replace("---\n", f"---\ntheme: {theme}\n", 1)
            else:
                header = frontmatter(deck)
        header = media_header(header, deck)
        markdown = compile_markdown(header, [row.raw for row in plans])
        if len(markdown) > 2_000_000:
            raise HTTPException(400, "Generated Markdown exceeds the presentation limit")
        return deck, plans, markdown

    async def _persist(self, snapshot, deck, plans, markdown, request, *, commit=True):
        async with transaction(self.session) if commit else nullcontext():
            if snapshot:
                parent, rows = await self._load(snapshot.id, lock=True)
                if self._signature(parent, rows) != snapshot.signature:
                    raise HTTPException(
                        409, "Presentation changed during generation; retry the action"
                    )
            else:
                parent, rows = Presentation(title=deck.title, markdown=markdown), []
                self.session.add(parent)
                await self.session.flush()
            parent.title, parent.markdown = deck.title, markdown
            parent.updated_at = datetime.now(UTC)
            if not snapshot or request.options.theme or ACTIONS[request.action].mode == "deck":
                parent.theme_id = await self.session.scalar(
                    select(Theme.id).where(Theme.slug == deck.theme)
                )
            existing = {row.id: row for row in rows}
            retained = {plan.id for plan in plans if plan.id}
            for row in rows:
                if row.id not in retained:
                    await self.session.delete(row)
            saved = []
            for position, plan in enumerate(plans):
                row = existing.get(plan.id)
                if row is None:
                    row = Slide(presentation_id=parent.id, position=position)
                    self.session.add(row)
                row.position = position
                if plan.changed:
                    mode = ACTIONS[request.action].mode
                    if mode not in {"notes", "visuals"}:
                        row.type, row.title = plan.data.type, plan.data.title
                    row.raw_markdown = plan.raw
                    row.structured_content = plan.data.model_dump(mode="json")
                    if mode != "visuals":
                        row.speaker_notes = plan.data.speaker_notes
                    if mode != "notes":
                        row.visual_config = {
                            **(row.visual_config or {}),
                            "visual_intent": plan.data.visual_intent.model_dump(),
                            "media": plan.data.media.model_dump(mode="json")
                            if plan.data.media
                            else None,
                        }
                saved.append(row)
            await self.session.flush()
            result = (parent.id, [row.id for row in saved])
        return result

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        self.client.ensure_configured()
        await self._progress("prompt.analysis", 10)
        try:
            parameters = await self._parameters(request)
            visual_config = await load_visual_settings(self.session)
            snapshot = await self._snapshot(request)
            source_context = await SourceContextService(self.session, self.settings).build(
                request.source_ids
            )
        finally:
            # No connection, transaction, or row lock is held during network inference.
            await self.session.rollback()
        if snapshot and not snapshot.rows and ACTIONS[request.action].target in {"deck", "merge"}:
            raise HTTPException(400, "This action requires a nonempty presentation")
        theme = request.options.theme or (snapshot.deck.theme if snapshot else "minimal")
        output = await self._generate_output(request, snapshot, parameters, theme, source_context)
        if request.action == "generate_outline":
            await self._progress("outline.completed", 70)
        elif isinstance(output, StructuredPresentation):
            # The provider returns one validated response, not per-slide token streams.
            for index, slide in enumerate(output.slides, start=1):
                await self._progress(
                    "slide.completed",
                    70,
                    {"slide": index, "total_slides": len(output.slides)},
                )
                if slide.visual_intent.type != "none":
                    await self._progress("visual.planned", 70, {"slide": index})
        elif isinstance(output, VisualResult):
            await self._progress("visual.planned", 70)
        if isinstance(output, StructuredPresentation):
            if request.action != "generate_outline":
                output.theme = theme
                visual_service = self.visual_service or VisualService(
                    async_sessionmaker(self.session.bind, expire_on_commit=False),
                    self.settings,
                )
                excluded = {request.slide_id, *request.options.slide_ids}
                existing_ids = (
                    {
                        row.data.media.asset_id
                        for row in snapshot.rows
                        if row.data.media and row.id not in excluded
                    }
                    if snapshot and ACTIONS[request.action].mode != "deck"
                    else set()
                )
                await visual_service.apply(
                    output,
                    visual_config,
                    progress=self._progress,
                    required=request.options.visuals_required,
                    existing_ids=existing_ids,
                )
            await self._progress("theme.applying", 80)
        deck, plans, markdown = self._plan(request, snapshot, output, theme)
        await self._progress("finalizing", 90)
        persist = (
            request.options.persist
            and not ACTIONS[request.action].preview_only
            and (snapshot is not None or request.action == "generate_full_deck")
        )
        presentation_id = snapshot.id if snapshot else None
        slide_ids = [plan.id for plan in plans if plan.id]
        async with transaction(self.session):
            if self.observer:
                await self.observer.guard(self.session)
            sources = SourceContextService(self.session, self.settings)
            await sources.validate(request.source_ids, lock=True)
            if persist:
                presentation_id, slide_ids = await self._persist(
                    snapshot,
                    deck,
                    plans,
                    markdown,
                    request,
                    commit=False,
                )
                await sources.attach(presentation_id, request.source_ids)
            response = GenerationResponse(
                action=request.action,
                source_ids=request.source_ids,
                presentation=deck,
                markdown=markdown,
                presentation_id=presentation_id,
                slide_ids=slide_ids,
                persisted=persist,
                reorder_suggestions=output if isinstance(output, ReorderResult) else None,
            )
            if self.observer:
                await self.observer.complete(self.session, response)
        return response
