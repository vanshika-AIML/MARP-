import logging

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient


async def test_startup_connects_and_shutdown_closes_both_clients(app_factory):
    factory, database, redis = app_factory
    app = factory()
    async with app.router.lifespan_context(app):
        assert database.ping_count == redis.ping_count == 1
        assert not database.closed and not redis.closed
    assert database.closed and redis.closed


async def test_database_is_closed_when_redis_construction_fails(app_factory, monkeypatch):
    factory, database, _ = app_factory

    def fail(_settings):
        raise RuntimeError("Cannot initialize Redis")

    monkeypatch.setattr("app.main.RedisClient", fail)
    app = factory()
    with pytest.raises(RuntimeError, match="Cannot initialize Redis"):
        async with app.router.lifespan_context(app):
            pytest.fail("Startup should have failed")
    assert database.closed


async def test_cleanup_attempts_database_even_if_redis_close_fails(app_factory, monkeypatch):
    factory, database, redis = app_factory

    async def fail():
        raise ConnectionError("Do not include secret connection values")

    monkeypatch.setattr(redis, "close", fail)
    app = factory()
    async with app.router.lifespan_context(app):
        pass
    assert database.closed


async def test_custom_prefix_and_cors(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(settings.model_copy(update={"api_v1_prefix": "/custom/v1"}))
    assert app.title == "MARP Studio API"
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/custom/v1/health/ready")).status_code == 200
            response = await client.get("/api/v1/health/ready")
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "http_404"
            for origin in settings.frontend_origins:
                response = await client.options(
                    "/health",
                    headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
                )
                assert response.status_code == 200
                assert response.headers["access-control-allow-origin"] == origin
            response = await client.options(
                "/health",
                headers={
                    "Origin": "https://untrusted.example.org",
                    "Access-Control-Request-Method": "GET",
                },
            )
            assert response.status_code == 400
            assert "access-control-allow-origin" not in response.headers


async def test_global_errors_do_not_leak_exception_or_input(app_factory):
    factory, _, _ = app_factory
    app = factory()

    @app.get("/test-error")
    async def broken():
        raise RuntimeError("password=never-disclose")

    @app.get("/test-validation")
    async def validated(count: int):
        return {"count": count}

    @app.get("/test-conflict")
    async def conflict():
        raise HTTPException(status_code=409, detail="Conflict", headers={"X-Conflict": "true"})

    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test-error")
            assert response.status_code == 500
            assert response.json() == {
                "error": {"code": "internal_error", "message": "Internal server error"}
            }
            response = await client.get("/test-validation?count=never-disclose")
            assert response.status_code == 422
            assert "never-disclose" not in response.text
            assert response.json()["error"]["details"][0]["location"] == ["query", "count"]
            response = await client.get("/test-conflict")
            assert response.status_code == 409
            assert response.json()["error"]["message"] == "Conflict"
            assert response.headers["x-conflict"] == "true"


async def test_dependency_failures_do_not_log_credentials(app_factory, caplog):
    factory, database, redis = app_factory
    database.available = redis.available = False
    app = factory()
    logger = logging.getLogger("marp")
    logger.addHandler(caplog.handler)
    try:
        async with app.router.lifespan_context(app):
            pass
    finally:
        logger.removeHandler(caplog.handler)
    assert "PostgreSQL health check failed (ConnectionError)" in caplog.text
    assert "Redis health check failed (ConnectionError)" in caplog.text
    assert "do-not-leak" not in caplog.text
    assert "internal-host" not in caplog.text
