import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from app.api.v1.source_websocket import source_socket
from app.services.sources import source_event
from tests.test_job_websocket import PubSub, Session, Socket


async def test_source_initial_event_delivery_and_cleanup(settings):
    source = SimpleNamespace(
        id=uuid4(), status="uploaded", source_metadata={}, error=None, updated_at=datetime.now(UTC)
    )
    pubsub, socket = PubSub(), Socket(settings)
    queue = SimpleNamespace(redis=SimpleNamespace(pubsub=lambda: pubsub))
    task = asyncio.create_task(source_socket(socket, source.id, queue, lambda: Session(source)))
    try:
        initial = await asyncio.wait_for(socket.sent.get(), 2)
        assert initial["event"] == "source.uploaded"
        source.status = "processing"
        source.source_metadata = {"ingestion": {"step": "source.extracting", "progress": 10}}
        source.updated_at += timedelta(seconds=1)
        await pubsub.messages.put(
            {"type": "message", "data": source_event(source).model_dump_json()}
        )
        assert (await asyncio.wait_for(socket.sent.get(), 2))["event"] == "source.extracting"
        await socket.input.put({"type": "websocket.disconnect"})
        await asyncio.wait_for(task, 2)
        assert pubsub.closed and not pubsub.subscribed
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


async def test_source_terminal_and_missing(settings):
    source = SimpleNamespace(
        id=uuid4(), status="ready", source_metadata={}, error=None, updated_at=datetime.now(UTC)
    )
    pubsub, socket = PubSub(), Socket(settings)
    queue = SimpleNamespace(redis=SimpleNamespace(pubsub=lambda: pubsub))
    await source_socket(socket, source.id, queue, lambda: Session(source))
    assert (await socket.sent.get())["event"] == "source.ready"
    assert socket.close_code == 1000 and pubsub.closed
    await source_socket(socket, source.id, queue, lambda: Session(None))
    assert socket.close_code == 4404
