import hashlib
from dataclasses import dataclass

from fastapi import HTTPException, Request

from app.core.redis import get_redis


@dataclass(frozen=True)
class RateLimit:
    name: str
    setting: str
    window_seconds: int = 60

    async def __call__(self, request: Request):
        limit = getattr(request.app.state.settings, self.setting)
        identity = getattr(request.state, "principal_id", None) or (
            request.client.host if request.client else "unknown"
        )
        digest = hashlib.sha256(str(identity).encode()).hexdigest()[:24]
        key = f"marp:rate:{self.name}:{digest}"
        redis = get_redis(request)
        try:
            async with redis.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.ttl(key)
                count, ttl = await pipe.execute()
            if count == 1 or ttl < 0:
                await redis.expire(key, self.window_seconds)
                ttl = self.window_seconds
        except Exception:
            raise HTTPException(503, "Rate limiting service unavailable") from None
        if count > limit:
            raise HTTPException(
                429, "Rate limit exceeded", headers={"Retry-After": str(max(1, ttl))}
            )


ai_rate_limit = RateLimit("ai", "ai_rate_limit_per_minute")
upload_rate_limit = RateLimit("uploads", "upload_rate_limit_per_minute")
