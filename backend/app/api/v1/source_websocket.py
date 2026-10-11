"""Subscribe before reading the durable snapshot, then block on pub/sub or disconnect."""

import asyncio
import logging
from contextlib import suppress
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app.api.v1.jobs import get_job_queue, get_job_sessions
from app.schemas.sources import SourceEvent
from app.services.sources import require_source, source_channel, source_event

TERMINAL = {"ready", "failed", "deleted"}

router = APIRouter()
logger = logging.getLogger("marp.sources.websocket")


@router.websocket("/ws/sources/{source_id}")
async def source_socket(
    websocket: WebSocket,
    source_id: UUID,
    queue: Annotated[Any, Depends(get_job_queue)],
    sessions: Annotated[Any, Depends(get_job_sessions)],
):
    origin = websocket.headers.get("origin")
    if origin and origin not in websocket.app.state.settings.frontend_origins:
        await websocket.close(code=4403, reason="Origin not allowed")
        return
    tasks = []
    pubsub = queue.redis.pubsub()
    topic = source_channel(source_id)
    try:
        async with sessions() as session:
            await require_source(session, source_id)
        async with asyncio.timeout(5):
            await pubsub.subscribe(topic)
            # Wait for Redis acknowledgement before taking the DB snapshot.
            await pubsub.get_message(ignore_subscribe_messages=False, timeout=None)
        async with sessions() as session:
            job = await require_source(session, source_id)
            initial = source_event(job)
        await websocket.accept()
        await websocket.send_json(initial.model_dump(mode="json"))
        if initial.data["status"] in TERMINAL:
            await websocket.close(code=1000)
            return

        async def forward():
            latest = initial.updated_at
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                event = SourceEvent.model_validate_json(message["data"])
                if event.source_id != source_id or event.updated_at <= latest:
                    continue
                latest = event.updated_at
                await websocket.send_json(event.model_dump(mode="json"))
                if event.data.get("status") in TERMINAL:
                    await websocket.close(code=1000)
                    return

        async def disconnected():
            while True:
                if (await websocket.receive())["type"] == "websocket.disconnect":
                    return

        tasks = [asyncio.create_task(forward()), asyncio.create_task(disconnected())]
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    except HTTPException:
        await websocket.close(code=4404, reason="Source not found")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("Source socket unavailable (%s)", type(exc).__name__)
        with suppress(RuntimeError, WebSocketDisconnect):
            await websocket.close(code=1013, reason="Source updates unavailable; reconnect")
    finally:
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        with suppress(Exception):
            async with asyncio.timeout(3):
                await pubsub.unsubscribe(topic)
        await pubsub.aclose()
