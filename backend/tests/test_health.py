import asyncio

import pytest
from httpx import ASGITransport, AsyncClient


async def test_liveness_does_not_probe_dependencies(app_factory):
    factory, database, redis = app_factory
    app = factory()
    async with app.router.lifespan_context(app):
        startup_checks = (database.ping_count, redis.ping_count)
        database.available = redis.available = False
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response.headers["cache-control"] == "no-store"
        assert (database.ping_count, redis.ping_count) == startup_checks


async def test_readiness_success(app_factory):
    factory, _, _ = app_factory
    app = factory()
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected", "redis": "connected"}


@pytest.mark.parametrize("unavailable", ["database", "redis", "both"])
async def test_readiness_failure_and_recovery(app_factory, unavailable):
    factory, database, redis = app_factory
    database.available = unavailable not in {"database", "both"}
    redis.available = unavailable not in {"redis", "both"}
    app = factory()
    # Failed startup probes do not prevent health endpoints from serving.
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/health/ready")
            assert response.status_code == 503
            assert response.json() == {
                "status": "unavailable",
                "database": "connected" if database.available else "unavailable",
                "redis": "connected" if redis.available else "unavailable",
            }
            assert "do-not-leak" not in response.text
            assert response.headers["cache-control"] == "no-store"
            database.available = redis.available = True
            assert (await client.get("/api/v1/health/ready")).status_code == 200


async def test_readiness_timeout_is_bounded(app_factory, monkeypatch):
    factory, database, _ = app_factory
    app = factory()

    async def stalled_ping():
        await asyncio.sleep(10)
        return True

    async with app.router.lifespan_context(app):
        monkeypatch.setattr(database, "ping", stalled_ping)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            async with asyncio.timeout(1):
                response = await client.get("/api/v1/health/ready")
            assert response.status_code == 503
            assert response.json()["database"] == "unavailable"
            assert response.json()["redis"] == "connected"
