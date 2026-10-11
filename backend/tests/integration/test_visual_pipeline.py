"""Visual pipeline integration using real PostgreSQL and mocked providers."""

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, select

from app.api.v1.ai import get_generation_service
from app.api.v1.jobs import get_job_queue
from app.models.media import MediaAsset, MediaCache
from app.schemas.ai import StructuredPresentation, StructuredSlide, VisualIntent
from app.schemas.visuals import VisualSettings
from app.services.ai.generation_service import GenerationService
from app.services.jobs import JobCancelled
from app.services.visuals.interfaces import GeneratedImage, SearchResult, VisualError
from app.services.visuals.providers import ProviderRegistry
from app.services.visuals.service import VisualService
from app.workers.generation import generate_job
from tests.integration.test_ai_generation import provider as provider
from tests.visual_fixtures import image_bytes


@pytest.fixture
def visual_env(sessions, settings, tmp_path):
    settings = settings.model_copy(update={"media_dir": str(tmp_path)})
    search = SimpleNamespace(
        name="mock-search",
        version="v1",
        search=AsyncMock(
            return_value=[
                SearchResult(
                    "https://images.example.com/a.png",
                    "https://example.com/artist",
                    1200,
                    675,
                    "Landscape",
                    {"credit": "Artist / Example", "licence": "Test licence"},
                ),
            ]
        ),
    )
    generator = SimpleNamespace(
        name="mock-generation",
        version="v1",
        generate=AsyncMock(
            return_value=GeneratedImage(image_bytes("blue"), "image/png"),
        ),
    )
    http = SimpleNamespace(download=AsyncMock(return_value=(image_bytes("red"), "image/png")))
    registry = ProviderRegistry(
        settings, searches={"pixabay": search}, generators={"stability": generator}
    )
    service = VisualService(sessions, settings, registry=registry, http=http)
    config = VisualSettings(
        search_enabled=True,
        generation_enabled=True,
        search_provider="pixabay",
        generation_provider="stability",
    )
    return service, config, search, generator, http


def slides(*modes):
    return StructuredPresentation(
        title="Visual deck",
        slides=[
            StructuredSlide(
                title=f"Slide {index}",
                type="image_text",
                content=["Useful content"],
                visual_intent=VisualIntent(mode=mode, query="Shared subject", alt_text="Visual"),
            )
            for index, mode in enumerate(modes)
        ],
    )


async def test_search_generate_persistence_attribution_cache_and_dedup(visual_env, sessions):
    service, config, search, generator, _ = visual_env
    plan = service.selector.choose(slides("search").slides[0], "minimal", config)
    await service.resolve(plan, config, "Visual")
    deck = slides("search", "search", "generate", "none")
    progress = AsyncMock()
    await service.apply(deck, config, progress=progress)
    assert deck.slides[0].media and not deck.slides[1].media
    assert deck.slides[2].media and not deck.slides[3].media
    assert deck.slides[0].media.attribution == "Artist / Example"
    assert deck.slides[0].media.asset_id != deck.slides[2].media.asset_id
    search.search.assert_awaited_once()
    generator.generate.assert_awaited_once()
    assert "visual.failed" in [call.args[0] for call in progress.await_args_list]
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(MediaAsset)) == 2
        assert await session.scalar(select(func.count()).select_from(MediaCache)) == 2
    repeated = slides("search")
    await service.apply(repeated, config, progress=AsyncMock())
    assert repeated.slides[0].media.asset_id == deck.slides[0].media.asset_id
    search.search.assert_awaited_once()


async def test_concurrent_cache_miss_calls_provider_once(visual_env):
    service, config, search, _, _ = visual_env
    first, second = slides("search"), slides("search")
    await asyncio.gather(
        service.apply(first, config, progress=AsyncMock()),
        service.apply(second, config, progress=AsyncMock()),
    )
    search.search.assert_awaited_once()
    assert first.slides[0].media.asset_id == second.slides[0].media.asset_id


@pytest.mark.parametrize("mode", ["search", "generate"])
async def test_provider_failure_fallback_and_required(visual_env, mode):
    service, config, search, generator, _ = visual_env
    search.search.side_effect = VisualError("provider_failed")
    generator.generate.side_effect = VisualError("provider_failed")
    deck = slides(mode)
    progress = AsyncMock()
    await service.apply(deck, config, progress=progress)
    assert deck.slides[0].media is None
    assert progress.await_args.args[0] == "visual.failed"
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await service.apply(slides(mode), config, progress=AsyncMock(), required=True)


async def test_intentional_repeat_respects_deck_limit(visual_env):
    service, config, search, _, _ = visual_env
    deck = slides("search", "search", "search")
    for slide in deck.slides:
        slide.visual_intent.allow_repeat = True
    await service.apply(
        deck, config.model_copy(update={"max_visuals_per_deck": 2}), progress=AsyncMock()
    )
    assert [bool(slide.media) for slide in deck.slides] == [True, True, False]
    search.search.assert_awaited_once()


async def test_cancellation_propagates_without_provider_call(visual_env):
    service, config, search, _, _ = visual_env
    with pytest.raises(JobCancelled):
        await service.apply(
            slides("search"), config, progress=AsyncMock(side_effect=JobCancelled())
        )
    search.search.assert_not_awaited()


async def test_admin_defaults_validation_and_no_secrets(client):
    response = await client.get("/admin/visuals")
    assert response.status_code == 200 and not response.json()["search_enabled"]
    for key, value in [
        ("search_enabled", True),
        ("search_provider", "pixabay"),
        ("max_visuals_per_deck", 3),
        ("preferred_strategy", "auto"),
    ]:
        response = await client.put("/admin/config/visuals/" + key, json={"value": value})
        assert response.status_code == 200
    for key, value in [
        ("api_key", "private"),
        ("search_enabled", "true"),
        ("max_visuals_per_deck", 100),
        ("search_provider", "unknown"),
        ("provider_url", "http://localhost"),
    ]:
        response = await client.put("/admin/config/visuals/" + key, json={"value": value})
        assert response.status_code == 400
    assert "api_key" not in (await client.get("/admin/visuals")).text


async def configure(client, visual_env):
    service, config, *_ = visual_env
    app = client._transport.app
    app.state.settings.media_dir = str(service.storage.root)
    for key, value in config.model_dump().items():
        assert (
            await client.put("/admin/config/visuals/" + key, json={"value": value})
        ).status_code == 200
    return app


async def test_generation_compiler_media_serving_and_failure(
    client, visual_env, provider, sessions
):
    app = await configure(client, visual_env)
    service = visual_env[0]

    def generation_override():
        # Dependency lifetime belongs to the fixture; the service uses the fixture session below.
        return generation

    async with sessions() as session:
        generation = GenerationService(
            session, app.state.nvidia, app.state.settings, visual_service=service
        )
        app.dependency_overrides[get_generation_service] = generation_override
        output = slides("search", "generate", "none")
        output.slides[2].type = "code"
        provider["responses"].append(output.model_dump(mode="json"))
        response = await client.post(
            "/ai/generate",
            json={
                "action": "generate_full_deck",
                "prompt": "Mixed deck",
                "options": {"slide_count": 3},
            },
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["persisted"] and "visual-split" in data["markdown"]
    assert len([slide for slide in data["presentation"]["slides"] if slide["media"]]) == 2
    media = data["presentation"]["slides"][0]["media"]
    fetched = await client.get("http://test" + media["url"])
    assert fetched.status_code == 200 and fetched.headers["content-type"] == "image/jpeg"
    assert fetched.headers["x-content-type-options"] == "nosniff"
    meta = (await client.get("/media/" + media["asset_id"])).json()
    assert meta["attribution"]["licence"] == "Test licence"
    assert "stored_path" not in meta
    # Preserve media through an existing notes-only edit.
    provider["responses"].append({"speaker_notes": "Updated notes"})
    async with sessions() as session:
        generation = GenerationService(
            session, app.state.nvidia, app.state.settings, visual_service=service
        )
        response = await client.post(
            "/ai/generate",
            json={
                "action": "generate_speaker_notes",
                "prompt": "Add notes",
                "slide_id": data["slide_ids"][0],
            },
        )
    assert response.status_code == 200
    assert response.json()["presentation"]["slides"][0]["media"]["asset_id"] == media["asset_id"]


@pytest.mark.parametrize("failure", [False, True])
async def test_worker_visual_events_and_text_only_fallback(
    client, visual_env, provider, sessions, failure
):
    app = await configure(client, visual_env)
    service, _, search, *_ = visual_env
    if failure:
        search.search.side_effect = VisualError("provider_unavailable")
    redis = SimpleNamespace(publish=AsyncMock())
    queue = SimpleNamespace(redis=redis, enqueue=AsyncMock())
    app.dependency_overrides[get_job_queue] = lambda: queue
    provider["responses"].append(slides("search").model_dump(mode="json"))
    response = await client.post(
        "/ai/jobs",
        json={
            "action": "generate_full_deck",
            "prompt": "Visual deck",
            "options": {"slide_count": 1},
        },
    )
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    await generate_job(
        {
            "sessions": sessions,
            "database": SimpleNamespace(engine=sessions.kw["bind"]),
            "redis": redis,
            "nvidia": app.state.nvidia,
            "settings": app.state.settings,
            "visuals": service,
        },
        job_id,
    )
    saved = (await client.get("/ai/jobs/" + job_id)).json()
    assert saved["status"] == "completed", saved
    events = [json.loads(call.args[1])["event"] for call in redis.publish.await_args_list]
    assert "visual.planning" in events and "visual.searching" in events
    assert ("visual.failed" if failure else "visual.ready") in events
    assert events[-1] == "job.completed"
    assert bool(saved["result"]["presentation"]["slides"][0]["media"]) is not failure
