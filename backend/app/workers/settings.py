"""Run: uv run arq app.workers.settings.WorkerSettings."""

import logging
import sys
from datetime import UTC, datetime, timedelta

from arq import cron
from sqlalchemy import select

from app.core.config import Settings
from app.core.database import Database
from app.core.job_queue import QUEUE_NAME, worker_redis_settings
from app.core.logging import configure_logging
from app.models import GenerationJob, UploadedSource
from app.services.ai.nvidia_nim import NvidiaNIMClient
from app.workers.generation import generate_job
from app.workers.ingestion import ingest_source

logger = logging.getLogger("marp.worker")


async def recover_jobs(ctx):
    # Reconcile the DB/Redis crash window and interrupted workers. No WS polling.
    cutoff = datetime.now(UTC) - timedelta(minutes=15)
    async with ctx["sessions"]() as session:
        ids = list(
            await session.scalars(
                select(GenerationJob.id)
                .where(
                    GenerationJob.status.in_(["queued", "running"]),
                    GenerationJob.updated_at < cutoff,
                )
                .order_by(GenerationJob.updated_at)
                .limit(100)
            )
        )
    for job_id in ids:
        await ctx["redis"].enqueue_job(
            "generate_job",
            str(job_id),
            _job_id=str(job_id),
            _queue_name=QUEUE_NAME,
        )
    async with ctx["sessions"]() as session:
        source_ids = list(
            await session.scalars(
                select(UploadedSource.id)
                .where(
                    UploadedSource.status.in_(["uploaded", "processing"]),
                    UploadedSource.updated_at < cutoff,
                )
                .order_by(UploadedSource.updated_at)
                .limit(100)
            )
        )
    for source_id in source_ids:
        await ctx["redis"].enqueue_job(
            "ingest_source",
            str(source_id),
            _job_id=f"source:{source_id}",
            _queue_name=QUEUE_NAME,
        )


async def startup(ctx):
    settings = Settings()
    configure_logging(settings.log_level)
    database = Database(settings)
    ctx.update(
        settings=settings,
        database=database,
        sessions=database.session_factory,
        nvidia=NvidiaNIMClient(settings),
    )
    logger.info("Generation worker ready")


async def shutdown(ctx):
    await ctx["nvidia"].close()
    await ctx["database"].close()


class WorkerSettings:
    handle_signals = sys.platform != "win32"
    functions = [generate_job, ingest_source]
    cron_jobs = [cron(recover_jobs, minute=set(range(0, 60, 1)), run_at_startup=True)]
    redis_settings = worker_redis_settings(Settings())
    queue_name = QUEUE_NAME
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 4
    max_tries = 3
    job_timeout = 700
    keep_result = 0  # Durable result is PostgreSQL, not ARQ's result cache.
    log_results = False
