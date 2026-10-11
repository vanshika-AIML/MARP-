"""Subscribe before reading the durable snapshot, then block on pub/sub or disconnect."""

import asyncio
import logging
from contextlib import suppress
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app.api.v1.jobs import get_job_queue, get_job_sessions
from app.schemas.jobs import JobEvent
from app.services.jobs import TERMINAL, channel, event_for, require_job

router = APIRouter()
logger = logging.getLogger("marp.jobs.websocket")


@router.websocket("/ws/jobs/{job_id}")
async def job_socket(
    websocket: WebSocket,
    job_id: UUID,
    queue: Annotated[Any, Depends(get_job_queue)],
    sessions: Annotated[Any, Depends(get_job_sessions)],
):
    origin = websocket.headers.get("origin")
    if origin and origin not in websocket.app.state.settings.frontend_origins:
        await websocket.close(code=4403, reason="Origin not allowed")
        return
    tasks = []
    pubsub = queue.redis.pubsub()
    topic = channel(job_id)
    try:
        async with sessions() as session:
            await require_job(session, job_id)
        async with asyncio.timeout(5):
            await pubsub.subscribe(topic)
            # Wait for Redis acknowledgement before taking the DB snapshot.
            await pubsub.get_message(ignore_subscribe_messages=False, timeout=None)
        async with sessions() as session:
            job = await require_job(session, job_id)
            initial = event_for(job)
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
                event = JobEvent.model_validate_json(message["data"])
                if event.job_id != job_id or event.updated_at <= latest:
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
        await websocket.close(code=4404, reason="Generation job not found")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("Job socket unavailable (%s)", type(exc).__name__)
        with suppress(RuntimeError, WebSocketDisconnect):
            await websocket.close(code=1013, reason="Job updates unavailable; reconnect")
    finally:
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        with suppress(Exception):
            async with asyncio.timeout(3):
                await pubsub.unsubscribe(topic)
        await pubsub.aclose()
