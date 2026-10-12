import asyncio
import json
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest
from arq import Retry
from pydantic import SecretStr
from sqlalchemy import func, select

from app.api.v1.jobs import get_job_queue
from app.models import GenerationJob, Presentation, Slide
from app.services.ai.nvidia_nim import NvidiaNIMClient
from app.workers.generation import generate_job


class FakeQueue:
    def __init__(self):
        self.redis = self
        self.enqueued = []
        self.events = []
        self.unavailable = False

    async def enqueue(self, job_id):
        if self.unavailable:
            raise ConnectionError("private queue credentials")
        self.enqueued.append(str(job_id))

    async def publish(self, channel, payload):
        self.events.append(json.loads(payload))


def streaming_response(content):
    chunks = [content[start : start + 128] for start in range(0, len(content), 128)]
    events = [
        "data: " + json.dumps({"choices": [{"delta": {"content": chunk}}]}) + "\n\n"
        for chunk in chunks
    ]
    return httpx.Response(200, text="".join(events) + "data: [DONE]\n\n")


@pytest.fixture
async def jobs(client, sessions, settings):
    queue = FakeQueue()
    client._transport.app.dependency_overrides[get_job_queue] = lambda: queue
    state = {"calls": 0, "failure": None, "callback": None}

    async def handler(request):
        state["calls"] += 1
        if state["callback"]:
            await state["callback"]()
        if state["failure"]:
            return httpx.Response(state["failure"], text="private NVIDIA error")
        if state.get("malformed"):
            content = "invalid JSON"
            if json.loads(request.content).get("stream"):
                return streaming_response(content)
            return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
        content = {
            "title": "Worker deck",
            "theme": "minimal",
            "slides": [{"title": "First", "content": ["Real generated content"]}],
        }
        response_content = json.dumps(content)
        if json.loads(request.content).get("stream"):
            return streaming_response(response_content)
        return httpx.Response(
            200, json={"choices": [{"message": {"content": response_content}}]}
        )

    nim = NvidiaNIMClient(
        settings.model_copy(update={"nvidia_api_key": SecretStr("fake-key"), "ai_max_retries": 0}),
        transport=httpx.MockTransport(handler),
    )
    ctx = {
        "database": SimpleNamespace(engine=sessions.kw["bind"]),
        "sessions": sessions,
        "redis": queue,
        "nvidia": nim,
        "settings": settings,
        "job_try": 1,
    }
    try:
        yield queue, ctx, state
    finally:
        await nim.close()


async def submit(client, **extra):
    response = await client.post(
        "/ai/jobs",
        json={
            "action": "generate_full_deck",
            "prompt": "Create a concise slide",
            "options": {"slide_count": 1},
            **extra,
        },
    )
    assert response.status_code == 202, response.text
    assert response.json()["status"] == "queued"
    return response.json()["job_id"]


async def test_job_create_lookup_worker_persistence_and_duplicate(client, sessions, jobs):
    queue, ctx, state = jobs
    job_id = await submit(client)
    assert queue.enqueued == [job_id] and state["calls"] == 0
    queued = (await client.get(f"/ai/jobs/{job_id}")).json()
    assert queued["status"] == "queued" and queued["result"] is None
    await generate_job(ctx, job_id)
    result = (await client.get(f"/ai/jobs/{job_id}")).json()
    assert result["status"] == "completed" and result["progress"] == 100
    assert result["result"]["persisted"]
    async with sessions() as session:
        parent = await session.get(Presentation, UUID(result["presentation_id"]))
        assert parent.markdown == result["result"]["markdown"]
        assert await session.scalar(select(func.count()).select_from(Slide)) == 1
    await generate_job(ctx, job_id)
    assert state["calls"] == 1
    events = [event["event"] for event in queue.events]
    assert events[0] == "job.queued" and events[-1] == "job.completed"
    assert "job.started" in events and "slide.completed" in events
    assert any(
        event["event"] == "prompt.analysis"
        and event["progress"] == 20
        and event["data"].get("received_characters", 0) > 0
        for event in queue.events
    )
    assert "slide.delta" not in events and "slide.started" not in events
    assert (await client.post(f"/ai/jobs/{job_id}/cancel")).json()["status"] == "completed"


@pytest.mark.parametrize("while_running", [False, True])
async def test_cancellation_never_persists_generated_results(client, sessions, jobs, while_running):
    queue, ctx, state = jobs
    job_id = await submit(client)

    async def cancel():
        response = await client.post(f"/ai/jobs/{job_id}/cancel")
        assert response.status_code == 200 and response.json()["status"] == "cancelled"

    if while_running:
        state["callback"] = cancel
    else:
        await cancel()
    await generate_job(ctx, job_id)
    result = (await client.get(f"/ai/jobs/{job_id}")).json()
    assert result["status"] == "cancelled" and result["result"] is None
    assert state["calls"] == int(while_running)
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Presentation)) == 0
    assert queue.events[-1]["event"] == "job.cancelled"


async def test_cancel_at_commit_guard_preserves_existing_deck(client, jobs, monkeypatch):
    from app.services.jobs import JobObserver

    _, ctx, _ = jobs
    parent = (
        await client.post(
            "/presentations", json={"title": "Manual original", "markdown": "# Original"}
        )
    ).json()
    job_id = await submit(client, presentation_id=parent["id"])
    original = JobObserver.guard

    async def cancel_before_lock(self, session):
        await client.post(f"/ai/jobs/{job_id}/cancel")
        await original(self, session)

    monkeypatch.setattr(JobObserver, "guard", cancel_before_lock)
    await generate_job(ctx, job_id)
    assert (await client.get(f"/presentations/{parent['id']}")).json()["markdown"] == "# Original"
    assert (await client.get(f"/ai/jobs/{job_id}")).json()["status"] == "cancelled"


async def test_job_failure_is_sanitized_and_permanent(client, jobs):
    queue, ctx, state = jobs
    state["failure"] = 401
    job_id = await submit(client)
    await generate_job(ctx, job_id)
    result = (await client.get(f"/ai/jobs/{job_id}")).json()
    assert result["status"] == "failed"
    assert result["error"]["code"] == "ai_authentication_failed"
    assert "private" not in json.dumps(result) + json.dumps(queue.events)
    assert queue.events[-1]["event"] == "job.failed"
    await generate_job(ctx, job_id)
    assert state["calls"] == 1


async def test_transient_failure_has_bounded_retry(client, jobs):
    queue, ctx, state = jobs
    state["failure"] = 503
    job_id = await submit(client)
    with pytest.raises(Retry):
        await generate_job(ctx, job_id)
    assert (await client.get(f"/ai/jobs/{job_id}")).json()["status"] == "queued"
    ctx["job_try"] = 3
    await generate_job(ctx, job_id)
    assert (await client.get(f"/ai/jobs/{job_id}")).json()["status"] == "failed"
    assert queue.events[-1]["event"] == "job.failed"


async def test_concurrent_workers_only_call_nvidia_once(client, jobs):
    _, ctx, state = jobs
    entered, release = asyncio.Event(), asyncio.Event()

    async def wait():
        entered.set()
        await release.wait()

    state["callback"] = wait
    job_id = await submit(client)
    first = asyncio.create_task(generate_job(ctx, job_id))
    try:
        await asyncio.wait_for(entered.wait(), 5)
        await generate_job(ctx, job_id)
        assert state["calls"] == 1
    finally:
        release.set()
        await first
    assert (await client.get(f"/ai/jobs/{job_id}")).json()["status"] == "completed"


async def test_queue_failure_and_unknown_job(client, sessions, jobs):
    queue, _, state = jobs
    queue.unavailable = True
    response = await client.post(
        "/ai/jobs",
        json={
            "action": "generate_full_deck",
            "prompt": "Create",
        },
    )
    assert response.status_code == 503 and state["calls"] == 0
    async with sessions() as session:
        job = await session.scalar(select(GenerationJob))
        assert job.status == "failed" and job.error["code"] == "queue_unavailable"
    assert (await client.get(f"/ai/jobs/{uuid4()}")).status_code == 404
    assert (await client.post(f"/ai/jobs/{uuid4()}/cancel")).status_code == 404


async def test_invalid_ai_json_is_a_permanent_job_failure(client, jobs):
    _, ctx, state = jobs
    state["malformed"] = True
    job_id = await submit(client)
    await generate_job(ctx, job_id)
    saved = (await client.get(f"/ai/jobs/{job_id}")).json()
    assert saved["status"] == "failed"
    assert saved["error"]["code"] == "ai_invalid_structured_output"
    assert state["calls"] == 2  # Existing one correction attempt, no worker retry.


async def test_job_result_and_presentation_roll_back_together(client, sessions, jobs, monkeypatch):
    from app.services.jobs import JobObserver

    _, ctx, _ = jobs
    original = JobObserver.complete

    async def fail_before_commit(self, session, response):
        await original(self, session, response)
        raise RuntimeError("private failure before transaction commit")

    monkeypatch.setattr(JobObserver, "complete", fail_before_commit)
    job_id = await submit(client)
    await generate_job(ctx, job_id)
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Presentation)) == 0
        job = await session.get(GenerationJob, UUID(job_id))
        assert job.status == "failed" and job.result is None
