import asyncio
import logging
from typing import Literal, Protocol

logger = logging.getLogger("marp.health")
DependencyStatus = Literal["connected", "unavailable"]


class HealthDependency(Protocol):
    async def ping(self) -> bool: ...


async def check_dependency(
    name: str, dependency: HealthDependency, timeout_seconds: float
) -> DependencyStatus:
    try:
        async with asyncio.timeout(timeout_seconds):
            if not await dependency.ping():
                raise ConnectionError("Dependency ping returned false")
        return "connected"
    except Exception as exc:
        # Connection exception text/tracebacks can contain URLs or passwords.
        logger.warning("%s health check failed (%s)", name, type(exc).__name__)
        return "unavailable"


async def dependency_statuses(
    database: HealthDependency, redis: HealthDependency, timeout_seconds: float
) -> dict[str, DependencyStatus]:
    database_status, redis_status = await asyncio.gather(
        check_dependency("PostgreSQL", database, timeout_seconds),
        check_dependency("Redis", redis, timeout_seconds),
    )
    return {"database": database_status, "redis": redis_status}
