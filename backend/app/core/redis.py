from fastapi import Request
from redis.asyncio import Redis

from app.core.config import Settings


class RedisClient:
    def __init__(self, settings: Settings) -> None:
        self.client: Redis = Redis.from_url(
            settings.redis_url.get_secret_value(),
            decode_responses=True,
            socket_connect_timeout=settings.dependency_timeout_seconds,
            socket_timeout=settings.dependency_timeout_seconds,
            max_connections=20,
            health_check_interval=30,
        )

    async def ping(self) -> bool:
        return bool(await self.client.ping())

    async def close(self) -> None:
        await self.client.aclose()


def get_redis(request: Request) -> Redis:
    return request.app.state.redis.client
