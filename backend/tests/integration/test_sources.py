import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.api.v1.jobs import get_job_queue
from app.api.v1.uploads import get_source_storage
from app.models import PresentationSource, SourceChunk, UploadedSource
from app.services.source_context import SourceContextService
from app.services.storage import LocalStorageProvider
from app.workers.ingestion import ingest_source
from tests.integration.test_ai_generation import deck, generate
from tests.integration.test_ai_generation import provider as provider
from tests.source_fixtures import source_bytes


@pytest.fixture
def source_env(client, sessions, settings, tmp_path):
    storage = LocalStorageProvider(tmp_path)
    queue = SimpleNamespace(
        redis=SimpleNamespace(publish=AsyncMock()),
        enqueue_source=AsyncMock(),
        enqueue=AsyncMock(),
    )
    app = client._transport.app
    app.dependency_overrides[get_source_storage] = lambda: storage
    app.dependency_overrides[get_job_queue] = lambda: queue
    # Middleware settings are bound on first request.
    app.state.settings.max_upload_mb = 1
    ctx = {
        "settings": settings,
        "sessions": sessions,
        "redis": queue.redis,
        "database": SimpleNamespace(engine=sessions.kw["bind"]),
        "storage": storage,
    }
    return ctx, queue, storage


async def upload(client, source_env, extension="pdf"):
    ctx, queue, _ = source_env
    response = await client.post(
        "/uploads",
        files={
            "file": ("source." + extension, source_bytes(extension), "application/octet-stream"),
        },
    )
    assert response.status_code == 202, response.text
    source_id = response.json()["source_id"]
    queue.enqueue_source.assert_awaited_with(UUID(source_id))
    assert (await client.get("/uploads/" + source_id)).json()["status"] == "uploaded"
    await ingest_source(ctx, source_id)
    response = await client.get("/uploads/" + source_id)
    assert response.json()["status"] == "ready", response.text
    return source_id


async def test_upload_worker_events_duplicate_and_delete(client, source_env, sessions):
    ctx, queue, storage = source_env
    source_id = await upload(client, source_env)
    response = (await client.get("/uploads/" + source_id)).json()
    assert "Revenue grew 12 percent" in response["extracted_text"]
    assert "storage_path" not in response and "stored_filename" not in response
    assert response["metadata"]["pages"] == 1
    events = [json.loads(call.args[1]) for call in queue.redis.publish.await_args_list]
    assert [event["event"] for event in events] == [
        "source.processing",
        "source.extracting",
        "source.chunking",
        "source.ready",
    ]
    assert [event["progress"] for event in events] == [5, 10, 70, 100]
    await ingest_source(ctx, source_id)
    assert queue.redis.publish.await_count == 4
    assert len(list(storage.root.iterdir())) == 1
    assert (await client.delete("/uploads/" + source_id)).status_code == 204
    assert (await client.get("/uploads/" + source_id)).status_code == 404
    assert not list(storage.root.iterdir())
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(SourceChunk)) == 0


@pytest.mark.parametrize(
    "name,mime,body,status",
    [
        ("x.exe", "application/octet-stream", b"MZpayload", 415),
        ("x.pdf", "image/png", b"%PDF-1.7", 415),
        ("x.txt", "text/plain", b"", 400),
        ("x.txt", "text/plain", b"x" * (1024 * 1024 + 1), 413),
    ],
    ids=["extension", "mime", "empty", "oversized"],
)
async def test_rejected_uploads(client, source_env, name, mime, body, status):
    response = await client.post("/uploads", files={"file": (name, body, mime)})
    assert response.status_code == status, response.text
    assert not list(source_env[2].root.iterdir())


async def test_safe_names_and_failed_extraction(client, source_env):
    ctx, queue, storage = source_env
    response = await client.post(
        "/uploads",
        files={
            "file": ("../../unsafe.pdf", b"%PDF-1.7 corrupt", "application/pdf"),
        },
    )
    assert response.status_code == 202
    source_id = response.json()["source_id"]
    saved = (await client.get("/uploads/" + source_id)).json()
    assert saved["original_filename"] == "unsafe.pdf"
    assert list(storage.root.iterdir())[0].name == UUID(source_id).hex + ".pdf"
    await ingest_source(ctx, source_id)
    failed = (await client.get("/uploads/" + source_id)).json()
    assert failed["status"] == "failed" and failed["error"]["code"] == "extraction_failed"
    assert json.loads(queue.redis.publish.await_args.args[1])["event"] == "source.failed"


async def test_multi_source_context_and_grounded_generation(
    client, source_env, sessions, settings, provider
):
    ids = [await upload(client, source_env, ext) for ext in ("pdf", "md")]
    async with sessions() as session:
        context = await SourceContextService(session, settings).build([UUID(id) for id in ids])
        assert len(context) <= settings.source_context_chars
        data = json.loads(context)
        assert len(data) == 2 and data[0]["chunks"][0]["reference"] == {"page": 1}
    result = await generate(
        client,
        provider,
        "generate_full_deck",
        deck("Source facts"),
        source_ids=ids,
        options={"slide_count": 1},
    )
    assert result["source_ids"] == ids and result["persisted"]
    messages = provider["calls"][-1]["messages"]
    assert "untrusted reference data" in messages[0]["content"]
    assert "Revenue grew 12 percent" in messages[1]["content"]
    assert "S1:C0" in messages[1]["content"] and "S2:C0" in messages[1]["content"]
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(PresentationSource)) == 2
    for action in ("generate_outline", "rewrite_slide"):
        targets = {"slide_id": result["slide_ids"][0]} if action == "rewrite_slide" else {}
        response = await generate(
            client,
            provider,
            action,
            deck("Grounded"),
            source_ids=ids,
            options={"slide_count": 1},
            **targets,
        )
        assert response["source_ids"] == ids
    assert (await client.delete("/uploads/" + ids[0])).status_code == 204
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(PresentationSource)) == 1


async def test_source_readiness_and_image_only_generation(client, source_env, provider):
    source_id = await upload(client, source_env, "png")
    response = await client.post(
        "/ai/generate",
        json={
            "action": "generate_full_deck",
            "prompt": "Describe facts",
            "source_ids": [source_id],
        },
    )
    assert response.status_code == 400 and not provider["calls"]
    response = await client.post(
        "/ai/jobs",
        json={
            "action": "generate_full_deck",
            "prompt": "Test",
            "source_ids": [str(uuid4())],
        },
    )
    assert response.status_code == 404
    queued = await client.post("/uploads", files={"file": ("test.txt", b"Facts", "text/plain")})
    response = await client.post(
        "/ai/jobs",
        json={
            "action": "generate_full_deck",
            "prompt": "Test",
            "source_ids": [queued.json()["source_id"]],
        },
    )
    assert response.status_code == 409


async def test_context_bounded_and_job_request_preserved(client, source_env, sessions, settings):
    source_id = await upload(client, source_env, "md")
    async with sessions() as session:
        session.add_all(
            SourceChunk(
                source_id=UUID(source_id),
                index=index,
                text="Evidence " * 200,
                chunk_metadata={"priority": 1, "reference": {"page": index}},
            )
            for index in range(1, 50)
        )
        await session.commit()
        context = await SourceContextService(
            session, settings.model_copy(update={"source_context_chars": 2000})
        ).build([UUID(source_id)])
        assert len(context) <= 2000
    response = await client.post(
        "/ai/jobs",
        json={
            "action": "generate_full_deck",
            "prompt": "Evidence",
            "source_ids": [source_id],
        },
    )
    assert response.status_code == 202


async def test_deleted_source_during_generation_does_not_persist(
    client, source_env, provider, sessions
):
    source_id = await upload(client, source_env, "txt")

    async def remove():
        assert (await client.delete("/uploads/" + source_id)).status_code == 204

    provider["callback"] = remove
    provider["responses"].append(deck("Stale"))
    response = await client.post(
        "/ai/generate",
        json={
            "action": "generate_full_deck",
            "prompt": "Test",
            "source_ids": [source_id],
            "options": {"slide_count": 1},
        },
    )
    assert response.status_code == 404
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(PresentationSource)) == 0


async def test_deleted_before_worker_is_not_resurrected(client, source_env, sessions):
    source_id = await upload(client, source_env, "txt")
    await client.delete("/uploads/" + source_id)
    await ingest_source(source_env[0], source_id)
    async with sessions() as session:
        assert await session.get(UploadedSource, UUID(source_id)) is None
        with pytest.raises(HTTPException):
            await SourceContextService(session, source_env[0]["settings"]).build([UUID(source_id)])
