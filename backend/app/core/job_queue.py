"""A separate binary Redis pool for ARQ and job events; no startup network calls."""

from arq.connections import ArqRedis, RedisSettings
from redis.asyncio import ConnectionPool

from app.core.config import Settings

QUEUE_NAME = "marp:generation"


def worker_redis_settings(settings: Settings) -> RedisSettings:
    config = RedisSettings.from_dsn(settings.redis_url.get_secret_value())
    config.conn_timeout = settings.dependency_timeout_seconds
    return config


class JobQueue:
    def __init__(self, settings: Settings):
        self.pool = ConnectionPool.from_url(
            settings.redis_url.get_secret_value(),
            decode_responses=False,
            socket_connect_timeout=settings.dependency_timeout_seconds,
            socket_timeout=None,  # Pub/sub blocks awaiting actual messages.
            health_check_interval=30,
            max_connections=30,
        )
        self.redis = ArqRedis(connection_pool=self.pool, default_queue_name=QUEUE_NAME)

    async def enqueue(self, job_id):
        return await self.redis.enqueue_job(
            "generate_job",
            str(job_id),
            _job_id=str(job_id),
            _queue_name=QUEUE_NAME,
        )

    async def close(self):

        await self.redis.aclose()
        await self.pool.aclose()

    async def enqueue_source(self, source_id):
        return await self.redis.enqueue_job(
            "ingest_source",
            str(source_id),
            _job_id=f"source:{source_id}",
            _queue_name=QUEUE_NAME,
        )
