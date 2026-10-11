import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.v1.job_websocket import job_socket
from app.services.jobs import event_for


class PubSub:
    def __init__(self):
        self.messages = asyncio.Queue()
        self.subscribed = False
        self.closed = False

    async def subscribe(self, topic):
        self.subscribed = True

    async def get_message(self, **kwargs):
        return {"type": "subscribe"}

    async def unsubscribe(self, topic):
        self.subscribed = False

    async def aclose(self):
        self.closed = True

    async def listen(self):
        while True:
            yield await self.messages.get()


class Session:
    def __init__(self, job):
        self.job = job

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def scalar(self, query):
        return self.job


class Socket:
    def __init__(self, settings):
        self.headers = {}
        self.app = SimpleNamespace(state=SimpleNamespace(settings=settings))
        self.sent = asyncio.Queue()
        self.input = asyncio.Queue()
        self.accepted = False
        self.close_code = None

    async def accept(self):
        self.accepted = True

    async def send_json(self, value):
        await self.sent.put(value)

    async def receive(self):
        return await self.input.get()

    async def close(self, code=1000, reason=""):
        self.close_code = code


@pytest.fixture
def connection(settings):
    job = SimpleNamespace(
        id=uuid4(),
        status="queued",
        progress=0,
        current_step="job.queued",
        presentation_id=None,
        result=None,
        error=None,
        updated_at=datetime.now(UTC),
    )
    pubsub, socket = PubSub(), Socket(settings)
    queue = SimpleNamespace(redis=SimpleNamespace(pubsub=lambda: pubsub))
    return job, pubsub, socket, queue


async def test_initial_state_events_and_disconnect_cleanup(connection):
    job, pubsub, socket, queue = connection
    task = asyncio.create_task(job_socket(socket, job.id, queue, lambda: Session(job)))
    try:
        initial = await asyncio.wait_for(socket.sent.get(), 2)
        assert socket.accepted and initial["event"] == "job.queued"
        job.status, job.current_step, job.progress = "running", "prompt.analysis", 20
        job.updated_at += timedelta(seconds=1)
        await pubsub.messages.put({"type": "message", "data": event_for(job).model_dump_json()})
        update = await asyncio.wait_for(socket.sent.get(), 2)
        assert update["event"] == "prompt.analysis" and update["progress"] == 20
        await socket.input.put({"type": "websocket.disconnect"})
        await asyncio.wait_for(task, 2)
        assert not pubsub.subscribed and pubsub.closed
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


async def test_terminal_snapshot_and_unknown_job(connection):
    job, pubsub, socket, queue = connection
    job.status, job.current_step = "cancelled", "job.cancelled"
    await job_socket(socket, job.id, queue, lambda: Session(job))
    assert (await socket.sent.get())["event"] == "job.cancelled"
    assert socket.close_code == 1000 and pubsub.closed
    socket.accepted = False
    await job_socket(socket, job.id, queue, lambda: Session(None))
    assert socket.close_code == 4404 and not socket.accepted


async def test_terminal_delivery_and_old_event_dropped(connection):
    job, pubsub, socket, queue = connection
    task = asyncio.create_task(job_socket(socket, job.id, queue, lambda: Session(job)))
    try:
        await asyncio.wait_for(socket.sent.get(), 2)
        await pubsub.messages.put({"type": "message", "data": event_for(job).model_dump_json()})
        job.status, job.current_step = "failed", "job.failed"
        job.error = {"code": "ai_timeout", "message": "AI provider timed out"}
        job.updated_at += timedelta(seconds=1)
        await pubsub.messages.put({"type": "message", "data": event_for(job).model_dump_json()})
        assert (await asyncio.wait_for(socket.sent.get(), 2))["event"] == "job.failed"
        await asyncio.wait_for(task, 2)
        assert pubsub.closed and socket.close_code == 1000
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
