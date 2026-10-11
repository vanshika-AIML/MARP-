import json
import re
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Presentation, Slide, Template, Theme
from app.repositories.content import ContentRepository
from app.services.marp import MAX_SLIDES, compile_markdown, split_markdown, validate_slide


@asynccontextmanager
async def transaction(session: AsyncSession):
    try:
        yield
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "Conflicting data or invalid resource reference") from exc
    except BaseException:
        await session.rollback()
        raise


def safe_json(value, *, key=""):
    """Public configuration is not a secret store. Reject credential-shaped keys."""
    forbidden = re.compile(
        r"apikey|secret|password|accesstoken|refreshtoken|authorization|credential|privatekey"
    )

    def visit(item, name, depth=0):
        if forbidden.search(re.sub(r"[^a-z]", "", name.lower())):
            raise HTTPException(400, "Credentials must be stored in server environment settings")
        if depth > 20:
            raise HTTPException(400, "JSON nesting exceeds 20 levels")
        if isinstance(item, dict):
            for child_key, child in item.items():
                visit(child, child_key, depth + 1)
        elif isinstance(item, list):
            for child in item:
                visit(child, "", depth + 1)

    visit(value, key)
    try:
        size = len(json.dumps(value, allow_nan=False).encode())
    except ValueError as exc:
        raise HTTPException(400, "JSON numbers must be finite") from exc
    if size > 100_000:
        raise HTTPException(400, "JSON value exceeds 100 KB")


class ContentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ContentRepository(session)

    async def require(self, model, resource_id: UUID, *, lock=False):
        resource = await self.repo.get(model, resource_id, lock=lock)
        if resource is None:
            raise HTTPException(404, "Resource not found")
        return resource

    async def list(self, model, **filters):
        return await self.repo.list(model, **filters)

    async def check_theme(self, theme_id):
        if theme_id is not None:
            await self.require(Theme, theme_id)

    def parse(self, markdown):
        try:
            return split_markdown(markdown)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    async def sync_from_markdown(self, presentation):
        document = self.parse(presentation.markdown)
        existing = await self.repo.slides(presentation.id)
        # Whole-document edits reuse IDs by ordinal. Changed raw content invalidates
        # supplemental structured data; unchanged slides keep their metadata.
        for position, raw in enumerate(document.slides):
            if position < len(existing):
                slide = existing[position]
                if slide.raw_markdown != raw:
                    slide.type = slide.title = slide.structured_content = None
                    slide.speaker_notes = slide.visual_config = None
                slide.position, slide.raw_markdown = position, raw
            else:
                self.session.add(
                    Slide(presentation_id=presentation.id, position=position, raw_markdown=raw)
                )
        for slide in existing[len(document.slides) :]:
            await self.session.delete(slide)

    async def create_presentation(self, data):
        async with transaction(self.session):
            await self.check_theme(data.get("theme_id"))
            presentation = Presentation(**data)
            self.session.add(presentation)
            await self.session.flush()
            await self.sync_from_markdown(presentation)
        await self.session.refresh(presentation)
        return presentation

    async def update_presentation(self, resource_id, data):
        async with transaction(self.session):
            presentation = await self.require(Presentation, resource_id, lock=True)
            await self.check_theme(data.get("theme_id"))
            for key, value in data.items():
                setattr(presentation, key, value)
            if "markdown" in data:
                await self.sync_from_markdown(presentation)
        await self.session.refresh(presentation)
        return presentation

    async def delete_presentation(self, resource_id):
        async with transaction(self.session):
            presentation = await self.require(Presentation, resource_id, lock=True)
            await self.session.delete(presentation)

    async def slides(self, presentation_id, *, limit=50, offset=0, search=None):
        await self.require(Presentation, presentation_id)
        return await self.repo.list_slides(
            presentation_id, limit=limit, offset=offset, search=search
        )

    async def compile(self, presentation):
        await self.session.flush()
        slides = await self.repo.slides(presentation.id)
        frontmatter = self.parse(presentation.markdown).frontmatter
        presentation.markdown = compile_markdown(frontmatter, [s.raw_markdown for s in slides])
        if len(presentation.markdown) > 2_000_000:
            raise HTTPException(400, "Compiled presentation exceeds 2 MB")
        presentation.updated_at = func.now()

    def validate_slide_data(self, data):
        if "raw_markdown" in data:
            try:
                validate_slide(data["raw_markdown"])
            except ValueError as exc:
                raise HTTPException(400, str(exc)) from exc
        for key in ("structured_content", "visual_config"):
            if key in data:
                safe_json(data[key])

    async def create_slide(self, presentation_id, data):
        self.validate_slide_data(data)
        async with transaction(self.session):
            presentation = await self.require(Presentation, presentation_id, lock=True)
            slides = await self.repo.slides(presentation_id)
            if len(slides) >= MAX_SLIDES:
                raise HTTPException(400, "Maximum slide count reached")
            position = data.pop("position", None)
            if position is None:
                position = max((slide.position for slide in slides), default=-1) + 1
            if any(slide.position == position for slide in slides):
                raise HTTPException(
                    409, "Slide position is already occupied; use reorder to move slides"
                )
            slide = Slide(presentation_id=presentation_id, position=position, **data)
            self.session.add(slide)
            await self.compile(presentation)
        await self.session.refresh(slide)
        return slide

    async def locked_slide(self, slide_id):
        slide = await self.require(Slide, slide_id)
        presentation = await self.require(Presentation, slide.presentation_id, lock=True)
        # Another request may have removed/changed the slide while the parent lock waited.
        return presentation, await self.require(Slide, slide_id)

    async def update_slide(self, slide_id, data):
        self.validate_slide_data(data)
        async with transaction(self.session):
            presentation, slide = await self.locked_slide(slide_id)
            if "position" in data:
                if any(
                    s.id != slide.id and s.position == data["position"]
                    for s in await self.repo.slides(presentation.id)
                ):
                    raise HTTPException(409, "Slide position is already occupied")
            for key, value in data.items():
                setattr(slide, key, value)
            await self.compile(presentation)
        await self.session.refresh(slide)
        return slide

    async def delete_slide(self, slide_id):
        async with transaction(self.session):
            presentation, slide = await self.locked_slide(slide_id)
            await self.session.delete(slide)
            await self.compile(presentation)

    async def reorder(self, presentation_id, slide_ids):
        async with transaction(self.session):
            presentation = await self.require(Presentation, presentation_id, lock=True)
            slides = await self.repo.slides(presentation_id)
            if len(slide_ids) != len(set(slide_ids)) or set(slide_ids) != {s.id for s in slides}:
                raise HTTPException(
                    400, "Provide every slide ID exactly once, from this presentation"
                )
            by_id = {s.id: s for s in slides}
            for position, slide_id in enumerate(slide_ids):
                by_id[slide_id].position = position
            await self.compile(presentation)
        return await self.repo.slides(presentation_id)

    async def create_template(self, data):
        self.parse(data.get("starter_markdown", ""))
        async with transaction(self.session):
            await self.check_theme(data.get("theme_id"))
            template = Template(**data)
            self.session.add(template)
        await self.session.refresh(template)
        return template

    async def update_template(self, resource_id, data):
        if "starter_markdown" in data:
            self.parse(data["starter_markdown"])
        async with transaction(self.session):
            template = await self.require(Template, resource_id, lock=True)
            await self.check_theme(data.get("theme_id"))
            for key, value in data.items():
                setattr(template, key, value)
        await self.session.refresh(template)
        return template

    async def delete_template(self, resource_id):
        async with transaction(self.session):
            await self.session.delete(await self.require(Template, resource_id, lock=True))

    async def duplicate_template(self, resource_id):
        template = await self.require(Template, resource_id)
        fields = (
            "description",
            "category",
            "thumbnail_url",
            "tags",
            "theme_id",
            "starter_markdown",
            "is_active",
            "sort_order",
        )
        return await self.create_template(
            {
                **{field: getattr(template, field) for field in fields},
                "name": template.name[:193] + " (copy)",
                "is_featured": False,
            }
        )

    async def from_template(self, resource_id):
        template = await self.require(Template, resource_id)
        return await self.create_presentation(
            {
                "title": template.name,
                "description": template.description,
                "theme_id": template.theme_id,
                "markdown": template.starter_markdown,
                "status": "draft",
            }
        )

    async def create_theme(self, data):
        safe_json(data.get("config", {}))
        async with transaction(self.session):
            await self.repo.lock_themes()
            if data.get("is_default"):
                if not data.get("is_active", True):
                    raise HTTPException(400, "A default theme must be active")
                await self.repo.clear_default()
            theme = Theme(**data)
            self.session.add(theme)
        await self.session.refresh(theme)
        return theme

    async def update_theme(self, resource_id, data):
        if "config" in data:
            safe_json(data["config"])
        async with transaction(self.session):
            await self.repo.lock_themes()
            theme = await self.require(Theme, resource_id, lock=True)
            if theme.is_default and (
                data.get("is_active") is False or data.get("is_default") is False
            ):
                raise HTTPException(409, "Set another default theme before clearing this default")
            if data.get("is_default"):
                if not data.get("is_active", theme.is_active):
                    raise HTTPException(400, "A default theme must be active")
                await self.repo.clear_default()
            for key, value in data.items():
                setattr(theme, key, value)
        await self.session.refresh(theme)
        return theme

    async def delete_theme(self, resource_id):
        async with transaction(self.session):
            await self.repo.lock_themes()
            theme = await self.require(Theme, resource_id, lock=True)
            if theme.is_default:
                raise HTTPException(409, "Set another default theme before deleting this theme")
            await self.session.delete(theme)

    async def duplicate_theme(self, resource_id):
        theme = await self.require(Theme, resource_id)
        return await self.create_theme(
            {
                "name": theme.name[:193] + " (copy)",
                "slug": f"{theme.slug[:57]}-copy-{uuid4().hex}",
                "description": theme.description,
                "config": theme.config,
                "css": theme.css,
                "is_active": theme.is_active,
                "is_default": False,
                "sort_order": theme.sort_order,
            }
        )

    async def put_config(self, namespace, key, data):
        safe_json(data["value"], key=f"{namespace}.{key}")
        if namespace == "visuals":
            from app.schemas.visuals import VisualSettings

            try:
                VisualSettings.model_validate({key: data["value"]})
            except ValidationError:
                raise HTTPException(400, "Invalid visual configuration key or value") from None
        async with transaction(self.session):
            item = await self.repo.upsert_config(namespace, key, data)
        return item

    async def put_flag(self, key, data):
        safe_json(data.get("config"), key=key)
        async with transaction(self.session):
            item = await self.repo.upsert_flag(key, data)
        return item
