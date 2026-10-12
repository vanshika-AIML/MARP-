"""JWT-backed session authentication and API authorization."""

import asyncio
import ipaddress
import secrets
from dataclasses import dataclass
from urllib.parse import parse_qs

import jwt
from fastapi.responses import JSONResponse
from jwt import PyJWKClient, PyJWKClientConnectionError, PyJWTError
from starlette.datastructures import Headers

from app.core.config import Settings

SESSION_COOKIE_NAME = "marp_session"
CSRF_COOKIE_NAME = "marp_csrf"


@dataclass(frozen=True)
class Principal:
    subject: str
    roles: frozenset[str]


class AuthenticationUnavailable(Exception):
    pass


class AuthenticationRejected(Exception):
    pass


class AuthVerifier:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.jwks = (
            PyJWKClient(settings.auth_jwks_url, cache_jwk_set=True, timeout=5)
            if settings.auth_jwks_url
            else None
        )

    async def verify(self, token: str) -> Principal:
        if not self.settings.auth_configured:
            raise AuthenticationUnavailable
        if len(token) > 8192:
            raise AuthenticationRejected
        try:
            if self.jwks:
                signing_key = await asyncio.to_thread(self.jwks.get_signing_key_from_jwt, token)
                key, algorithm = signing_key.key, "RS256"
            else:
                key, algorithm = self.settings.auth_jwt_secret.get_secret_value(), "HS256"
            claims = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                issuer=self.settings.auth_issuer,
                audience=self.settings.auth_audience,
                options={"require": ["exp", "iat", "sub"]},
                leeway=30,
            )
        except PyJWKClientConnectionError as exc:
            raise AuthenticationUnavailable from exc
        except PyJWTError as exc:
            raise AuthenticationRejected from exc

        subject = claims.get("sub")
        roles = claims.get(self.settings.auth_roles_claim, [])
        if isinstance(roles, str):
            roles = [roles]
        if (
            not isinstance(subject, str)
            or not subject
            or len(subject) > 255
            or not isinstance(roles, list)
            or any(not isinstance(role, str) for role in roles)
        ):
            raise AuthenticationRejected
        if claims["exp"] - claims["iat"] > self.settings.auth_max_token_lifetime_seconds:
            raise AuthenticationRejected
        return Principal(subject=subject, roles=frozenset(roles))


def _is_loopback(scope) -> bool:
    client = scope.get("client")
    host = client[0] if client else ""
    if host in {"testclient", "testserver"}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _public_request(method: str, path: str, query_string: bytes, settings: Settings) -> bool:
    if path in {"/health", f"{settings.api_v1_prefix}/health/ready"}:
        return method in {"GET", "HEAD"}
    if method not in {"GET", "HEAD"}:
        return False
    public_catalog = {
        f"{settings.api_v1_prefix}/themes",
        f"{settings.api_v1_prefix}/templates",
        f"{settings.api_v1_prefix}/feature-flags",
    }
    if path not in public_catalog:
        return False
    query = parse_qs(query_string.decode("latin-1"))
    include_all = query.get("all", ["false"])[0].casefold() in {"true", "1", "yes"}
    inactive_requested = query.get("active", ["true"])[0].casefold() in {
        "false",
        "0",
        "no",
    }
    return not include_all and not inactive_requested


def _required_role(method: str, path: str, query_string: bytes, settings: Settings) -> str | None:
    prefix = settings.api_v1_prefix
    if path.startswith(f"{prefix}/admin/"):
        return settings.auth_admin_role
    query = parse_qs(query_string.decode("latin-1"))
    if (
        method in {"GET", "HEAD"}
        and path in {f"{prefix}/themes", f"{prefix}/templates"}
        and (
            query.get("all", ["false"])[0].casefold() in {"true", "1", "yes"}
            or query.get("active", ["true"])[0].casefold() in {"false", "0", "no"}
        )
    ):
        return settings.auth_admin_role
    if path in {f"{prefix}/themes", f"{prefix}/templates"} or path.startswith(
        (f"{prefix}/themes/", f"{prefix}/templates/")
    ):
        if path not in {f"{prefix}/themes", f"{prefix}/templates"} and method in {"GET", "HEAD"}:
            return settings.auth_admin_role
        if method not in {"GET", "HEAD"} and not path.endswith("/create-presentation"):
            return settings.auth_admin_role
    if method not in {"GET", "HEAD", "OPTIONS"}:
        return settings.auth_editor_role
    return None


def _bearer_token(headers: Headers) -> str | None:
    authorization = headers.get("authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if separator and scheme.casefold() == "bearer" and token.strip():
        return token.strip()
    return None


def _csrf_valid(headers: Headers, cookies: dict[str, str], settings: Settings) -> bool:
    origin = headers.get("origin")
    csrf_cookie = cookies.get(CSRF_COOKIE_NAME, "")
    csrf_header = headers.get("x-csrf-token", "")
    return bool(
        origin in settings.frontend_origins
        and csrf_cookie
        and csrf_header
        and secrets.compare_digest(csrf_cookie, csrf_header)
    )


class AuthenticationMiddleware:
    def __init__(self, app, *, settings: Settings, verifier: AuthVerifier):
        self.app = app
        self.settings = settings
        self.verifier = verifier

    async def __call__(self, scope, receive, send):
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        method = scope.get("method", "GET").upper()
        path = scope.get("path", "")
        query_string = scope.get("query_string", b"")
        if scope["type"] == "http" and method == "OPTIONS":
            await self.app(scope, receive, send)
            return
        if path != "/health" and not path.startswith(self.settings.api_v1_prefix + "/"):
            await self.app(scope, receive, send)
            return
        if _public_request(method, path, query_string, self.settings):
            await self.app(scope, receive, send)
            return

        local_development = self.settings.app_env in {"development", "test"} and _is_loopback(scope)
        if not self.settings.auth_configured and not local_development:
            await self._deny(scope, receive, send, 503, "authentication_unavailable")
            return

        principal = None
        token = _bearer_token(headers)
        cookies = {}
        cookie_header = headers.get("cookie", "")
        for item in cookie_header.split(";"):
            name, separator, value = item.strip().partition("=")
            if separator:
                cookies[name] = value
        session_cookie = cookies.get(SESSION_COOKIE_NAME)
        used_cookie = token is None and session_cookie is not None
        token = token or session_cookie

        if token is None and local_development:
            principal = Principal(
                subject="local-development",
                roles=frozenset({self.settings.auth_admin_role, self.settings.auth_editor_role}),
            )
        elif token is None:
            await self._deny(scope, receive, send, 401, "authentication_required")
            return
        else:
            try:
                principal = await self.verifier.verify(token)
            except AuthenticationUnavailable:
                await self._deny(scope, receive, send, 503, "authentication_unavailable")
                return
            except AuthenticationRejected:
                await self._deny(scope, receive, send, 401, "invalid_session")
                return

        origin = headers.get("origin")
        if scope["type"] == "websocket":
            if origin and origin not in self.settings.frontend_origins:
                await self._deny(scope, receive, send, 403, "origin_not_allowed")
                return
            if used_cookie and origin not in self.settings.frontend_origins:
                await self._deny(scope, receive, send, 403, "origin_not_allowed")
                return
        elif method not in {"GET", "HEAD", "OPTIONS"}:
            if origin and origin not in self.settings.frontend_origins:
                await self._deny(scope, receive, send, 403, "origin_not_allowed")
                return
            if used_cookie and not _csrf_valid(headers, cookies, self.settings):
                await self._deny(scope, receive, send, 403, "csrf_validation_failed")
                return

        required_role = _required_role(method, path, query_string, self.settings)
        role_granted = (
            not required_role
            or required_role in principal.roles
            or (
                required_role == self.settings.auth_editor_role
                and self.settings.auth_admin_role in principal.roles
            )
        )
        if not role_granted:
            await self._deny(scope, receive, send, 403, "insufficient_role")
            return

        scope.setdefault("state", {})["principal"] = principal
        scope["state"]["principal_id"] = principal.subject
        await self.app(scope, receive, send)

    async def _deny(self, scope, receive, send, status: int, code: str):
        if scope["type"] == "websocket":
            close_code = 4401 if status == 401 else 4403 if status == 403 else 1013
            await send({"type": "websocket.close", "code": close_code, "reason": code})
            return
        message = {
            401: "Authentication required",
            403: "Access denied",
            503: "Authentication service unavailable",
        }[status]
        response = JSONResponse(
            status_code=status,
            content={"error": {"code": code, "message": message}},
            headers={"WWW-Authenticate": "Bearer"} if status == 401 else None,
        )
        await response(scope, receive, send)
