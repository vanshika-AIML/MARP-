import asyncio
from logging.config import fileConfig

from alembic import context
from alembic.util.exc import CommandError
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import Settings
from app.models import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# app.models is the explicit model registry. Import new models there.
target_metadata = Base.metadata
settings = Settings()


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url.get_secret_value(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(
        settings.database_url.get_secret_value(),
        poolclass=pool.NullPool,
        hide_parameters=True,
        connect_args={"timeout": settings.dependency_timeout_seconds},
    )
    try:
        async with engine.connect() as connection:
            await connection.run_sync(do_run_migrations)
    except Exception as exc:
        # Driver exception messages can contain credentials or connection details.
        raise CommandError(
            f"Migration failed ({type(exc).__name__}); "
            "check database availability and configuration"
        ) from None
    finally:
        await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
