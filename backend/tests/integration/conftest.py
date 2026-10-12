"""Real PostgreSQL in a disposable Docker container; never reads DATABASE_URL.

No fallback to the development/production DB. Missing Docker fails explicitly.
Run unit tests alone with: pytest --ignore=tests/integration
"""

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import get_db_session

ROOT = Path(__file__).resolve().parents[2]


def docker(*args):
    return subprocess.run(["docker", *args], check=True, capture_output=True, text=True, timeout=60)


@pytest.fixture(scope="session")
def postgres_url():
    container = None
    try:
        # Loopback + random host port; all test data disappears with this container.
        container = docker(
            "run",
            "--rm",
            "-d",
            "-e",
            "POSTGRES_USER=marp",
            "-e",
            "POSTGRES_PASSWORD=isolated-test-only",
            "-e",
            "POSTGRES_DB=marp_test",
            "-p",
            "127.0.0.1::5432",
            "postgres:17-alpine",
        ).stdout.strip()
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            result = subprocess.run(
                [
                    "docker",
                    "exec",
                    container,
                    "pg_isready",
                    "-h",
                    "127.0.0.1",
                    "-U",
                    "marp",
                    "-d",
                    "marp_test",
                ],
                capture_output=True,
                timeout=5,
            )
            if result.returncode == 0:
                break
            time.sleep(0.25)
        else:
            pytest.fail("Isolated PostgreSQL did not become ready")
        port = docker("port", container, "5432/tcp").stdout.strip().rsplit(":", 1)[1]
        url = f"postgresql+asyncpg://marp:isolated-test-only@127.0.0.1:{port}/marp_test"
        environment = {
            **os.environ,
            "DATABASE_URL": url,
            "APP_ENV": "test",
            "DEBUG": "false",
            "DEPENDENCY_TIMEOUT_SECONDS": "10",
        }
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            text=True,
            timeout=45,
        )
        assert result.returncode == 0, result.stderr
        yield url
    finally:
        if container:
            docker("stop", "--time", "3", container)


@pytest.fixture
async def sessions(postgres_url):
    engine = create_async_engine(postgres_url, hide_parameters=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    # The URL is generated above for our own disposable test container only.
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE media_assets, media_cache, uploaded_sources, generation_jobs, "
                "slides, presentations, templates, themes, app_configs, feature_flags CASCADE"
            )
        )
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.fixture
async def client(app_factory, sessions):
    factory, _, _ = app_factory
    app = factory()

    async def test_session():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db_session] = test_session
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test/api/v1"
        ) as api:
            yield api
