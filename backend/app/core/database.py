from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings
from app.models import Base

__all__ = ["Base", "Database", "get_db_session"]


class Database:
    def __init__(self, settings: Settings) -> None:
        self.engine: AsyncEngine = create_async_engine(
            settings.database_url.get_secret_value(),
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            pool_timeout=settings.dependency_timeout_seconds,
            connect_args={
                "timeout": settings.dependency_timeout_seconds,
                "command_timeout": settings.dependency_timeout_seconds,
            },
            echo=False,
            hide_parameters=True,
        )
        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def ping(self) -> bool:
        async with self.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return True

    async def close(self) -> None:
        await self.engine.dispose()


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One session per request. Services explicitly commit successful transactions."""
    database: Database = request.app.state.database
    async with database.session_factory() as session:
        try:
            yield session
        except BaseException:
            await session.rollback()
            raise
