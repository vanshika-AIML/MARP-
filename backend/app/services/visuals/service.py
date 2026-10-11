"""Resolve visual plans outside deck transactions; durable cache and text-only fallback."""

import asyncio
import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert

from app.models import AppConfig
from app.models.media import MediaAsset, MediaCache
from app.schemas.visuals import MediaReference, VisualSettings
from app.services.jobs import JobCancelled
from app.services.visuals.interfaces import VisualError
from app.services.visuals.network import SafeHTTP, validate_url
from app.services.visuals.providers import ProviderRegistry
from app.services.visuals.selection import VisualSelectionService, rank_results
from app.services.visuals.storage import LocalMediaStorageProvider, validate_image

logger = logging.getLogger("marp.visuals")


async def load_visual_settings(session):
    rows = await session.scalars(select(AppConfig).where(AppConfig.namespace == "visuals"))
    try:
        return VisualSettings.model_validate({row.key: row.value for row in rows})
    except ValidationError:
        raise HTTPException(400, "Invalid visual configuration") from None


class VisualService:
    def __init__(self, sessions, settings, *, registry=None, storage=None, http=None):
        self.sessions, self.settings = sessions, settings
        self.registry = registry or ProviderRegistry(settings)
        self.storage = storage or LocalMediaStorageProvider(settings)
        self.http = http or SafeHTTP()
        self.selector = VisualSelectionService()

    async def resolve(self, plan, config, alt):
        provider = self.registry.get(plan.mode, config)
        identity = {
            "version": 1,
            "mode": plan.mode,
            "query": plan.query.casefold(),
            "provider": provider.name,
            "provider_version": provider.version,
            "safe_search": True,
            "validation_version": 1,
            "max_media_mb": self.settings.max_media_mb,
            "vision": [self.registry.vision.name, self.registry.vision.version]
            if self.registry.vision
            else None,
            "aspect_ratio": plan.aspect_ratio,
            "style": plan.style,
            "context": plan.context if plan.mode == "generate" else "",
        }
        key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
        # Advisory lock covers cache miss + provider call across concurrent workers.
        async with self.sessions() as session:
            engine = session.bind
        async with engine.connect() as connection:
            locked = False
            try:
                await connection.execute(
                    text("SELECT pg_advisory_lock(hashtextextended(:key, 0))"),
                    {"key": "media:" + key},
                )
                await connection.commit()
                locked = True
                async with self.sessions() as session:
                    cached = await session.get(MediaCache, key)
                    if cached and cached.expires_at > datetime.now(UTC):
                        if cached.asset_id is None:
                            raise VisualError("visual_cached_unavailable")
                        asset = await session.get(MediaAsset, cached.asset_id)
                        if asset and self.storage.path(asset.stored_path).is_file():
                            return asset
                try:
                    asset = await self._create(plan, provider, alt)
                except VisualError:
                    await self._cache(key, None, minutes=5)
                    raise
                await self._cache(key, asset.id, minutes=1440)
                return asset
            finally:
                try:
                    if locked:
                        await connection.execute(
                            text("SELECT pg_advisory_unlock(hashtextextended(:key, 0))"),
                            {"key": "media:" + key},
                        )
                        await connection.commit()
                    else:
                        # Cancellation while acquiring must never leak a session-level lock.
                        await connection.invalidate()
                except BaseException:
                    await connection.invalidate()
                    raise

    async def _cache(self, key, asset_id, *, minutes):
        async with self.sessions() as session:
            values = {
                "key": key,
                "asset_id": asset_id,
                "expires_at": datetime.now(UTC) + timedelta(minutes=minutes),
            }
            await session.execute(
                insert(MediaCache)
                .values(**values)
                .on_conflict_do_update(
                    index_elements=["key"],
                    set_=values,
                )
            )
            await session.commit()

    async def _create(self, plan, provider, alt):
        limit = self.settings.max_media_mb * 1024 * 1024
        source_url, attribution = None, None
        if plan.mode == "search":
            candidates = rank_results(
                await provider.search(plan.query, safe_search=True),
                plan.aspect_ratio,
            )
            validated = None
            for candidate in candidates[:5]:
                try:
                    validate_url(candidate.source_url)
                    body, mime = await self.http.download(candidate.url, limit)
                    validated = await asyncio.to_thread(validate_image, body, mime, limit)
                    if validated[1] < 800 or validated[2] < 450:
                        raise VisualError("low_resolution_visual")
                    if self.registry.vision and not await self.registry.vision.suitable(
                        body,
                        slide_context=plan.context,
                    ):
                        continue
                    source_url, attribution = candidate.source_url, candidate.attribution
                    alt = alt or candidate.alt_text
                    break
                except VisualError:
                    continue
            else:
                raise VisualError("no_suitable_visual")
        else:
            image = await provider.generate(
                plan.query,
                aspect_ratio=plan.aspect_ratio,
                style=plan.style,
                slide_context=plan.context,
            )
            validated = await asyncio.to_thread(
                validate_image, image.content, image.mime_type, limit
            )
            if self.registry.vision and not await self.registry.vision.suitable(
                image.content,
                slide_context=plan.context,
            ):
                raise VisualError("visual_rejected")
        content, width, height, digest = validated
        async with self.sessions() as session:
            existing = await session.scalar(select(MediaAsset).where(MediaAsset.digest == digest))
            if existing:
                if not self.storage.path(existing.stored_path).is_file():
                    try:
                        await self.storage.save(existing.stored_path, content)
                    except FileExistsError:
                        pass
                return existing
        asset_id = uuid4()
        key = asset_id.hex + ".jpg"
        await self.storage.save(key, content)
        try:
            async with self.sessions() as session:
                await session.execute(
                    insert(MediaAsset)
                    .values(
                        id=asset_id,
                        type=plan.mode,
                        provider=provider.name,
                        source_url=source_url,
                        stored_path=key,
                        mime_type="image/jpeg",
                        width=width,
                        height=height,
                        alt_text=(alt or "Presentation visual")[:300],
                        attribution=attribution,
                        prompt_query=plan.query,
                        digest=digest,
                        asset_metadata={
                            "aspect_ratio": plan.aspect_ratio,
                            "style": plan.style,
                            "provider_version": provider.version,
                        },
                    )
                    .on_conflict_do_nothing(index_elements=["digest"])
                )
                await session.commit()
                asset = await session.scalar(select(MediaAsset).where(MediaAsset.digest == digest))
            if asset.id != asset_id:
                await self.storage.delete(key)
            return asset
        except BaseException:
            await self.storage.delete(key)
            raise

    async def apply(self, deck, config, *, progress, required=False, existing_ids=None):
        used = set(existing_ids or ())
        existing_count = len(used)
        attempted, placed = 0, 0
        deadline = asyncio.get_running_loop().time() + self.settings.visual_budget_seconds
        for index, slide in enumerate(deck.slides, 1):
            # Never accept model-supplied asset IDs/paths. Only this service resolves assets.
            slide.media = None
            slide.visual_intent.source_attribution = None
            plan = self.selector.choose(slide, deck.theme, config)
            if plan is None or placed + existing_count >= config.max_visuals_per_deck:
                continue
            attempted += 1
            await progress("visual.planning", 72, {"slide": index, "mode": plan.mode})
            try:
                remaining = deadline - asyncio.get_running_loop().time()
                if remaining <= 0:
                    raise VisualError("visual_budget_exhausted")
                await progress(
                    "visual.searching" if plan.mode == "search" else "visual.generating",
                    74,
                    {"slide": index},
                )
                async with asyncio.timeout(remaining):
                    asset = await self.resolve(plan, config, slide.visual_intent.alt_text)
                if asset.id in used and not slide.visual_intent.allow_repeat:
                    raise VisualError("duplicate_visual_skipped")
                slide.media = MediaReference(
                    asset_id=asset.id,
                    url=f"{self.settings.api_v1_prefix}/media/{asset.id}/file",
                    alt_text=slide.visual_intent.alt_text or asset.alt_text,
                    placement=plan.placement,
                    width=asset.width,
                    height=asset.height,
                    attribution=(asset.attribution or {}).get("credit"),
                    source_url=asset.source_url,
                )
                used.add(asset.id)
                slide.visual_intent.source_attribution = (asset.attribution or {}).get("credit")
                placed += 1
                await progress("visual.ready", 78, {"slide": index, "asset_id": str(asset.id)})
            except JobCancelled:
                raise
            except Exception as exc:
                slide.media = None
                code = exc.code if isinstance(exc, VisualError) else "visual_unavailable"
                logger.warning("Visual fallback (%s)", type(exc).__name__)
                await progress("visual.failed", 78, {"slide": index, "code": code})
                if required:
                    raise HTTPException(502, "A required visual could not be prepared") from None
        if required and (not attempted or not placed):
            raise HTTPException(502, "No required visual could be prepared")
        return deck
