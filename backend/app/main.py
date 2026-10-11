import logging
from collections.abc import AsyncIterator
from contextlib import AsyncExitStack, asynccontextmanager
from typing import Protocol

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_router
from app.core.config import Settings
from app.core.database import Database
from app.core.errors import register_exception_handlers
from app.core.health import dependency_statuses
from app.core.job_queue import JobQueue
from app.core.logging import configure_logging
from app.core.redis import RedisClient
from app.core.upload_limits import UploadSizeLimit
from app.schemas.health import HealthResponse
from app.services.ai.nvidia_nim import NvidiaNIMClient

logger = logging.getLogger("marp.lifecycle")


class Closeable(Protocol):
    async def close(self) -> None: ...


async def close_resource(name: str, resource: Closeable) -> None:
    try:
        await resource.close()
    except Exception as exc:
        logger.error("%s cleanup failed (%s)", name, type(exc).__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        configure_logging(settings.log_level)
        logger.info("Starting MARP Studio API (%s)", settings.app_env)
        async with AsyncExitStack() as resources:
            database = Database(settings)
            resources.push_async_callback(close_resource, "PostgreSQL", database)
            redis = RedisClient(settings)
            resources.push_async_callback(close_resource, "Redis", redis)
            application.state.database = database
            application.state.redis = redis
            queue = JobQueue(settings)
            resources.push_async_callback(close_resource, "Job queue", queue)
            application.state.job_queue = queue
            nvidia = NvidiaNIMClient(settings)
            resources.push_async_callback(close_resource, "NVIDIA client", nvidia)
            application.state.nvidia = nvidia
            statuses = await dependency_statuses(
                database, redis, settings.dependency_timeout_seconds
            )
            logger.info(
                "Dependencies: PostgreSQL=%s Redis=%s", statuses["database"], statuses["redis"]
            )
            try:
                yield
            finally:
                logger.info("Stopping MARP Studio API; closing dependency clients")
        logger.info("MARP Studio API stopped")

    # Do not enable Starlette debug tracebacks: they bypass the safe error envelope.
    application = FastAPI(title="MARP Studio API", version="0.1.0", lifespan=lifespan)
    application.state.settings = settings
    application.add_middleware(
        UploadSizeLimit,
        path=settings.api_v1_prefix + "/uploads",
        max_bytes=settings.max_upload_mb * 1024 * 1024,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    )
    register_exception_handlers(application)

    @application.get("/health", response_model=HealthResponse, tags=["health"])
    async def health(response: Response) -> HealthResponse:
        response.headers["Cache-Control"] = "no-store"
        return HealthResponse()

    application.include_router(api_router, prefix=settings.api_v1_prefix)
    return application


app = create_app()
