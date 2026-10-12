"""Real ARQ queue + Redis pub/sub + HTTP/WebSocket; NVIDIA HTTP is mocked."""

import asyncio
import json
import signal
import socket
import time
from types import SimpleNamespace

import httpx
import pytest
import uvicorn
from arq.worker import Worker
from pydantic import SecretStr
from websockets.asyncio.client import connect

from app.api.v1.jobs import get_job_queue, get_job_sessions
from app.core.database import get_db_session
from app.core.job_queue import QUEUE_NAME, JobQueue
from app.services.ai.nvidia_nim import NvidiaNIMClient
from app.services.jobs import channel
from app.workers.generation import generate_job
from tests.integration.conftest import docker


@pytest.fixture(scope="session")
def isolated_redis_url():
    container = docker(
        "run",
        "--rm",
        "-d",
        "-p",
        "127.0.0.1::6379",
        "redis:7-alpine",
    ).stdout.strip()
    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if "PONG" in docker("exec", container, "redis-cli", "ping").stdout:
                break
            time.sleep(0.1)
        else:
            pytest.fail("Isolated Redis did not start")
        port = docker("port", container, "6379/tcp").stdout.strip().rsplit(":", 1)[1]
        yield f"redis://127.0.0.1:{port}/0"
    finally:
        docker("stop", "--time", "2", container)


@pytest.mark.parametrize("outcome", ["completed", "failed", "cancelled"])
async def test_real_queue_worker_http_and_websocket(
    app_factory,
    sessions,
    settings,
    isolated_redis_url,
    outcome,
    monkeypatch,
):
    queue = JobQueue(settings.model_copy(update={"redis_url": SecretStr(isolated_redis_url)}))
    # Only this fixture owns this disposable Redis database.
    await queue.redis.flushdb()
    entered, release = asyncio.Event(), asyncio.Event()
    subscription_closed = asyncio.Event()
    original_pubsub = queue.redis.pubsub

    def tracked_pubsub():
        subscription = original_pubsub()
        original_close = subscription.aclose

        async def close():
            await original_close()
            subscription_closed.set()

        subscription.aclose = close
        return subscription

    monkeypatch.setattr(queue.redis, "pubsub", tracked_pubsub)
    calls = []

    async def nim_response(request):
        calls.append(request)
        entered.set()
        await release.wait()
        if outcome == "failed":
            return httpx.Response(401, text="private provider details")
        data = {"title": "Runtime", "slides": [{"title": "Done", "content": ["A clear point"]}]}
        content = json.dumps(data)
        events = [
            "data: "
            + json.dumps({"choices": [{"delta": {"content": content[start : start + 128]}}]})
            + "\n\n"
            for start in range(0, len(content), 128)
        ]
        return httpx.Response(200, text="".join(events) + "data: [DONE]\n\n")

    nim = NvidiaNIMClient(
        settings.model_copy(update={"nvidia_api_key": SecretStr("mock-only"), "ai_max_retries": 0}),
        transport=httpx.MockTransport(nim_response),
    )
    app = app_factory[0]()

    async def session_override():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db_session] = session_override
    app.dependency_overrides[get_job_sessions] = lambda: sessions
    app.dependency_overrides[get_job_queue] = lambda: queue
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
    serving = asyncio.create_task(server.serve(sockets=[sock]))
    worker = Worker(
        [generate_job],
        redis_pool=queue.redis,
        queue_name=QUEUE_NAME,
        ctx={
            "database": SimpleNamespace(engine=sessions.kw["bind"]),
            "sessions": sessions,
            "nvidia": nim,
            "settings": settings,
        },
        poll_delay=0.05,
        max_tries=3,
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
        async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}", timeout=5) as client:
            response = await client.post(
                "/api/v1/ai/jobs",
                json={
                    "action": "generate_full_deck",
                    "prompt": "Create",
                    "options": {"slide_count": 1},
                },
            )
            assert response.status_code == 202
            assert not calls  # HTTP returned without waiting for inference or starting a worker.
            job_id = response.json()["job_id"]
            async with connect(f"ws://127.0.0.1:{port}/api/v1/ws/jobs/{job_id}") as ws:
                initial = json.loads(await asyncio.wait_for(ws.recv(), 5))
                assert initial["event"] == "job.queued"
                working = asyncio.create_task(worker.async_run())
                await asyncio.wait_for(entered.wait(), 5)
                if outcome == "cancelled":
                    cancelled = await client.post(f"/api/v1/ai/jobs/{job_id}/cancel")
                    assert cancelled.json()["status"] == "cancelled"
                release.set()
                events = []
                async with asyncio.timeout(10):
                    while True:
                        event = json.loads(await ws.recv())
                        events.append(event)
                        if event["event"] in {"job.completed", "job.failed", "job.cancelled"}:
                            break
                assert events[-1]["event"] == f"job.{outcome}"
                assert "private" not in json.dumps(events)
            saved = (await client.get(f"/api/v1/ai/jobs/{job_id}")).json()
            assert saved["status"] == outcome
            if outcome == "completed":
                parent = (
                    await client.get(f"/api/v1/presentations/{saved['presentation_id']}")
                ).json()
                assert parent["markdown"] == saved["result"]["markdown"]
            else:
                assert saved["result"] is None
            # Pub/sub cleanup should complete promptly after terminal delivery.
            await asyncio.wait_for(subscription_closed.wait(), 5)
            assert (await queue.redis.pubsub_numsub(channel(job_id)))[0][1] == 0
    finally:
        release.set()
        if working:
            worker.handle_sig(signal.SIGTERM)
            await asyncio.gather(working, return_exceptions=True)
            await worker.close()
        server.should_exit = True
        await asyncio.wait_for(serving, 10)
        sock.close()
        await nim.close()
        await queue.close()
