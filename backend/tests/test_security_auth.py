from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from starlette.websockets import WebSocketDisconnect

from app.api.v1.dependencies import service
from app.core.config import Settings
from app.schemas.content import PresentationRead

JWT_SECRET = "test-only-session-signing-secret-32-bytes"


def authenticated_settings(settings):
    return settings.model_copy(
        update={
            "app_env": "staging",
            "auth_jwt_secret": SecretStr(JWT_SECRET),
            "auth_issuer": "https://issuer.example.test",
            "auth_audience": "marp-studio",
        }
    )


def token(*roles):
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": "person-123",
            "roles": list(roles),
            "iss": "https://issuer.example.test",
            "aud": "marp-studio",
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


class EmptyContentService:
    async def list(self, *_args, **_kwargs):
        return []

    async def create_presentation(self, data):
        now = datetime.now(UTC)
        return PresentationRead(
            id=uuid4(),
            title=data["title"],
            description=None,
            theme_id=None,
            status="draft",
            markdown="",
            created_at=now,
            updated_at=now,
        )


async def test_production_fails_closed_when_jwt_verification_is_not_configured(app_factory):
    factory, _, _ = app_factory
    settings = Settings(
        _env_file=None,
        app_env="production",
        debug=False,
        database_url="postgresql+asyncpg://marp:password@postgres:5432/marp",
        redis_url="redis://redis:6379/0",
        frontend_origins=["https://studio.example.test"],
        trusted_hosts=["studio.example.test"],
    )
    app = factory(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="https://studio.example.test",
        ) as client:
            response = await client.get("/api/v1/presentations")
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "authentication_unavailable"
            assert (await client.get("/api/v1/health/ready")).status_code == 200


async def test_production_accepts_an_issuer_signed_jwks_session(app_factory, monkeypatch):
    factory, _, _ = app_factory
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    def signing_key(_client, _token):
        return SimpleNamespace(key=public_key)

    monkeypatch.setattr("jwt.PyJWKClient.get_signing_key_from_jwt", signing_key)
    settings = Settings(
        _env_file=None,
        app_env="production",
        debug=False,
        database_url="postgresql+asyncpg://marp:password@postgres:5432/marp",
        redis_url="redis://redis:6379/0",
        frontend_origins=["https://studio.example.test"],
        trusted_hosts=["studio.example.test"],
        auth_jwks_url="https://issuer.example.test/.well-known/jwks.json",
        auth_issuer="https://issuer.example.test",
        auth_audience="marp-studio",
    )
    now = datetime.now(UTC)
    session = jwt.encode(
        {
            "sub": "administrator-123",
            "roles": ["marp_admin", "marp_editor"],
            "iss": settings.auth_issuer,
            "aud": settings.auth_audience,
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        private_key,
        algorithm="RS256",
        headers={"kid": "issuer-key"},
    )
    app = factory(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="https://studio.example.test",
        ) as client:
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {session}"},
            )
            assert response.status_code == 200
            assert response.json()["is_admin"] is True


async def test_unauthed_content_upload_job_and_media_endpoints_are_denied(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(authenticated_settings(settings))
    app.dependency_overrides[service] = EmptyContentService
    protected_paths = [
        ("/api/v1/presentations", "GET"),
        ("/api/v1/admin/config", "GET"),
        ("/api/v1/uploads/00000000-0000-0000-0000-000000000001", "GET"),
        ("/api/v1/ai/jobs/00000000-0000-0000-0000-000000000001", "GET"),
        ("/api/v1/media/00000000-0000-0000-0000-000000000001/file", "GET"),
    ]
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for path, method in protected_paths:
                response = await client.request(method, path)
                assert response.status_code == 401, path


async def test_local_development_auth_is_loopback_only_and_rejects_foreign_origins(
    app_factory, settings
):
    factory, _, _ = app_factory
    app = factory(settings)
    app.dependency_overrides[service] = EmptyContentService
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app, client=("127.0.0.1", 12345)),
            base_url="http://test",
        ) as local_client:
            assert (await local_client.get("/api/v1/presentations")).status_code == 200
            response = await local_client.post(
                "/api/v1/presentations",
                json={"title": "Cross-origin"},
                headers={"Origin": "https://attacker.example"},
            )
            assert response.status_code == 403
            assert response.json()["error"]["code"] == "origin_not_allowed"

        async with AsyncClient(
            transport=ASGITransport(app=app, client=("203.0.113.10", 12345)),
            base_url="http://test",
        ) as remote_client:
            response = await remote_client.get("/api/v1/presentations")
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "authentication_unavailable"


async def test_non_admin_cannot_read_admin_data_or_mutate_content(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(authenticated_settings(settings))
    headers = {"Authorization": f"Bearer {token('marp_viewer')}"}
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/admin/config", headers=headers)
            assert response.status_code == 403
            response = await client.put(
                "/api/v1/admin/config/ui/published",
                json={"value": {}},
                headers=headers,
            )
            assert response.status_code == 403
            response = await client.post(
                "/api/v1/presentations",
                json={"title": "Unauthorized"},
                headers=headers,
            )
            assert response.status_code == 403
            response = await client.post(
                "/api/v1/ai/jobs",
                json={"action": "generate_full_deck", "prompt": "spend credits"},
                headers=headers,
            )
            assert response.status_code == 403


async def test_unauthenticated_ai_cannot_bypass_rate_limit(app_factory, settings):
    factory, _, redis = app_factory
    app = factory(authenticated_settings(settings))
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for path in ("/api/v1/ai/generate", "/api/v1/ai/jobs"):
                response = await client.post(
                    path,
                    json={"action": "generate_full_deck", "prompt": "spend provider credits"},
                )
                assert response.status_code == 401
            assert redis.client.store == {}


async def test_editor_reads_content_but_admin_catalog_expansion_is_denied(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(authenticated_settings(settings))
    app.dependency_overrides[service] = EmptyContentService
    headers = {"Authorization": f"Bearer {token('marp_editor')}"}
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/api/v1/presentations", headers=headers)).status_code == 200
            response = await client.get("/api/v1/templates?all=true", headers=headers)
            assert response.status_code == 403
            response = await client.get("/api/v1/themes?active=false", headers=headers)
            assert response.status_code == 403


async def test_cookie_writes_require_matching_origin_and_double_submit_csrf(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(authenticated_settings(settings))
    app.dependency_overrides[service] = EmptyContentService
    session = token("marp_editor")
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            denied = await client.post(
                "/api/v1/presentations",
                json={"title": "No CSRF"},
                headers={
                    "Origin": "http://localhost:5173",
                    "Cookie": f"marp_session={session}",
                },
            )
            assert denied.status_code == 403
            allowed = await client.post(
                "/api/v1/presentations",
                json={"title": "Valid CSRF"},
                headers={
                    "Origin": "http://localhost:5173",
                    "Cookie": f"marp_session={session}; marp_csrf=csrf-value",
                    "X-CSRF-Token": "csrf-value",
                },
            )
            assert allowed.status_code == 201


def test_websocket_requires_authenticated_session(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(authenticated_settings(settings))
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as disconnect:
            with client.websocket_connect("/api/v1/ws/jobs/00000000-0000-0000-0000-000000000001"):
                pytest.fail("Unauthenticated websocket must not be accepted")
        assert disconnect.value.code == 4401


def test_local_websocket_rejects_foreign_origins(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(settings)
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as disconnect:
            with client.websocket_connect(
                "/api/v1/ws/jobs/00000000-0000-0000-0000-000000000001",
                headers={"origin": "https://attacker.example"},
            ):
                pytest.fail("Cross-origin local websocket must not be accepted")
        assert disconnect.value.code == 4403


async def test_production_docs_are_disabled_and_development_docs_remain(app_factory, settings):
    factory, _, _ = app_factory
    production = factory(
        Settings(
            _env_file=None,
            app_env="production",
            debug=False,
            database_url="postgresql+asyncpg://marp:password@postgres:5432/marp",
            redis_url="redis://redis:6379/0",
            frontend_origins=["https://studio.example.test"],
            trusted_hosts=["studio.example.test"],
        )
    )
    development = factory(settings)
    async with production.router.lifespan_context(production):
        async with AsyncClient(
            transport=ASGITransport(app=production),
            base_url="https://studio.example.test",
        ) as client:
            for path in ("/docs", "/redoc", "/openapi.json"):
                assert (await client.get(path)).status_code == 404
    async with development.router.lifespan_context(development):
        async with AsyncClient(
            transport=ASGITransport(app=development),
            base_url="http://test",
        ) as client:
            assert (await client.get("/docs")).status_code == 200
            assert (await client.get("/redoc")).status_code == 200
            assert (await client.get("/openapi.json")).status_code == 200


async def test_auth_identity_response_never_includes_provider_secrets(app_factory, settings):
    factory, _, _ = app_factory
    app = factory(
        authenticated_settings(
            settings.model_copy(
                update={"nvidia_api_key": SecretStr("do-not-return-this-provider-key")}
            )
        )
    )
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token('marp_admin')}"},
            )
            assert response.status_code == 200
            assert "do-not-return-this-provider-key" not in response.text
            assert "nvidia_api_key" not in response.text
            assert response.json()["is_admin"] is True
