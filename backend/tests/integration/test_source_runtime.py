"""Real HTTP, Redis, ARQ and WebSocket source-to-deck integration; mock only NVIDIA."""

import asyncio
import json
import signal
import socket
from types import SimpleNamespace

import httpx
import uvicorn
from arq.worker import Worker
from pydantic import SecretStr
from websockets.asyncio.client import connect

from app.api.v1.jobs import get_job_queue, get_job_sessions
from app.api.v1.uploads import get_source_storage
from app.core.database import get_db_session
from app.core.job_queue import QUEUE_NAME, JobQueue
from app.services.ai.nvidia_nim import NvidiaNIMClient
from app.services.storage import LocalStorageProvider
from app.workers.generation import generate_job
from app.workers.ingestion import ingest_source
from tests.integration.test_job_runtime import isolated_redis_url as isolated_redis_url
from tests.source_fixtures import source_bytes


async def test_http_arq_sources_to_grounded_deck(
    app_factory,
    sessions,
    settings,
    isolated_redis_url,
    tmp_path,
):
    queue = JobQueue(settings.model_copy(update={"redis_url": SecretStr(isolated_redis_url)}))
    await queue.redis.flushdb()
    calls = []

    async def provider(request):
        calls.append(json.loads(request.content))
        deck = {
            "title": "Source facts",
            "slides": [
                {
                    "title": "Revenue",
                    "content": ["Revenue grew 12 percent in 2025 [S1:C0]."],
                }
            ],
        }
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(deck)}}]})

    nim = NvidiaNIMClient(
        settings.model_copy(update={"nvidia_api_key": SecretStr("mock-only")}),
        transport=httpx.MockTransport(provider),
    )
    storage = LocalStorageProvider(tmp_path)
    app = app_factory[0]()

    async def db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db_session] = db
    app.dependency_overrides[get_job_sessions] = lambda: sessions
    app.dependency_overrides[get_job_queue] = lambda: queue
    app.dependency_overrides[get_source_storage] = lambda: storage
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
    serving = asyncio.create_task(server.serve(sockets=[sock]))
    worker = Worker(
        [generate_job, ingest_source],
        redis_pool=queue.redis,
        queue_name=QUEUE_NAME,
        ctx={
            "database": SimpleNamespace(engine=sessions.kw["bind"]),
            "sessions": sessions,
            "nvidia": nim,
            "settings": settings,
            "storage": storage,
        },
        poll_delay=0.05,
        keep_result=0,
        log_results=False,
    )
    working = None
    try:
        async with asyncio.timeout(10):
            while not server.started:
                if serving.done():
                    serving.result()
                await asyncio.sleep(0.02)
        async with httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{port}/api/v1", timeout=10
        ) as client:
            source_ids = []
            for extension in ("pdf", "md"):
                response = await client.post(
                    "/uploads",
                    files={
                        "file": (
                            "facts." + extension,
                            source_bytes(extension),
                            "application/octet-stream",
                        ),
                    },
                )
                assert response.status_code == 202
                source_id = response.json()["source_id"]
                source_ids.append(source_id)
                async with connect(f"ws://127.0.0.1:{port}/api/v1/ws/sources/{source_id}") as ws:
                    initial = json.loads(await ws.recv())
                    if working is None:
                        assert initial["event"] == "source.uploaded"
                        working = asyncio.create_task(worker.async_run())
                    events = [initial["event"]]
                    async with asyncio.timeout(20):
                        while events[-1] not in {"source.ready", "source.failed"}:
                            events.append(json.loads(await ws.recv())["event"])
                    assert events[-1] == "source.ready"
                source = (await client.get("/uploads/" + source_id)).json()
                assert "Revenue grew 12 percent" in source["extracted_text"]
            response = await client.post(
                "/ai/jobs",
                json={
                    "action": "generate_full_deck",
                    "prompt": "Use the sources",
                    "source_ids": source_ids,
                    "options": {"slide_count": 1},
                },
            )
            assert response.status_code == 202
            job_id = response.json()["job_id"]
            async with connect(f"ws://127.0.0.1:{port}/api/v1/ws/jobs/{job_id}") as ws:
                async with asyncio.timeout(20):
                    while True:
                        event = json.loads(await ws.recv())
                        if event["event"] in {"job.completed", "job.failed"}:
                            break
                assert event["event"] == "job.completed"
            saved = (await client.get("/ai/jobs/" + job_id)).json()
            assert saved["result"]["source_ids"] == source_ids
            deck = (await client.get("/presentations/" + saved["presentation_id"])).json()
            assert "S1:C0" in deck["markdown"]
            assert "[S1:C0]" in saved["result"]["presentation"]["slides"][0]["content"][0]
            assert "S2:C0" in calls[0]["messages"][1]["content"]
            for source_id in source_ids:
                assert (await client.delete("/uploads/" + source_id)).status_code == 204
            assert not list(tmp_path.iterdir())
    finally:
        if working:
            worker.handle_sig(signal.SIGTERM)
            await asyncio.gather(working, return_exceptions=True)
            await worker.close()
        server.should_exit = True
        await asyncio.wait_for(serving, 10)
        sock.close()
        await nim.close()
        await queue.close()
