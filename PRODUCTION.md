# MARP Studio operations

## Local development (PowerShell)

Prerequisites: Python 3.12, uv, Node.js 22.12+ (or 24+), Docker Desktop.

On Windows, after `uv sync --project backend` and creating `backend/.env`,
`npm run dev:all` runs the full local stack, including migrations and starter data.
It uses the database/Redis ports in `backend/.env` for Docker port mappings.
For machines where 5432 is reserved, use 55432 in `DATABASE_URL`.

```powershell
Copy-Item backend/.env.example backend/.env
docker compose -f backend/docker-compose.yml up -d
Set-Location backend
uv sync
$env:DEBUG='true'
uv run alembic upgrade head
uv run fastapi dev app/main.py
```

In a second terminal:

```powershell
Set-Location backend
$env:DEBUG='true'
uv run arq app.workers.settings.WorkerSettings
```

In a third terminal:

```powershell
npm ci
npm run dev
```

The frontend is at `http://localhost:5173`; API readiness is
`http://localhost:8000/api/v1/health/ready`. Add `NVIDIA_API_KEY` to
`backend/.env` to enable generation. Search and generation visuals are optional
and use the provider keys documented in `backend/.env.example`.
Development and test mode need no gateway credentials: the backend grants a
local editor/admin principal only to loopback clients. The Vite and backend
servers bind to `127.0.0.1`; keep those bindings. Browser writes and WebSockets
also reject origins outside `CORS_ORIGINS`. This local development identity is
not available in staging or production.

## Configuration

Frontend builds accept `VITE_API_BASE_URL` and optional `VITE_WS_BASE_URL`.
Leave both unset in the production container so HTTP, media, and WebSockets use
the reverse-proxy origin.

The backend reads the variables in `backend/.env.example`. Production requires
`APP_ENV=production`, `DEBUG=false`, a non-local PostgreSQL URL, a non-local
Redis URL, explicit `CORS_ORIGINS`, and explicit `TRUSTED_HOSTS`. Secrets stay
in the deployment environment or secret manager and are never browser-visible.

Production API access is authenticated and role-checked by FastAPI. Configure
`AUTH_JWKS_URL` (HTTPS), `AUTH_ISSUER`, `AUTH_AUDIENCE`, and the identity
provider's `AUTH_ROLES_CLAIM` before allowing users in. The authenticated
IEEE/enterprise gateway must validate SSO and issue a short-lived RS256 JWT in
an HttpOnly, Secure, SameSite session cookie named `marp_session`, with `sub`,
`iat`, `exp`, `iss`, `aud`, and roles. By default, `marp_admin` permits admin
operations and `marp_editor` permits content writes; `AUTH_ADMIN_ROLE`,
`AUTH_EDITOR_ROLE`, `AUTH_ROLES_CLAIM`, and
`AUTH_MAX_TOKEN_LIFETIME_SECONDS` can map and bound the provider's claims.
For cookie-authenticated writes, the gateway also sets a same-site,
JavaScript-readable `marp_csrf` cookie and the frontend sends its value as
`X-CSRF-Token`. WebSocket connections use that same authenticated session and
must originate from an allowed frontend origin.

The identity provider/gateway operator must supply these exact deployment
values; do not use guessed values:

- `AUTH_JWKS_URL`: HTTPS URL returning the issuer's JSON Web Key Set. It must
  publish the RSA public key matching the JWT's `kid`.
- `AUTH_ISSUER`: exact `iss` claim value in the gateway-issued session.
- `AUTH_AUDIENCE`: exact `aud` claim value for this MARP Studio API.
- `AUTH_ROLES_CLAIM`: claim name containing the role list (default `roles`),
  with values mapped to `marp_admin` and/or `marp_editor` (or configure the
  corresponding role names).
- `CORS_ORIGINS`: comma-separated exact HTTPS frontend origins.
- `TRUSTED_HOSTS`: the public frontend hostname plus the internal `backend`
  service name used by the container readiness check.

The gateway must mint an RS256 token with `sub`, `iat`, `exp`, `iss`, `aud`,
and the configured roles claim; its lifetime must not exceed
`AUTH_MAX_TOKEN_LIFETIME_SECONDS`. Set a host-only `marp_session` cookie with
`HttpOnly; Secure; SameSite=Lax; Path=/`, and a separate random,
JavaScript-readable `marp_csrf` cookie with `Secure; SameSite=Lax; Path=/`
(not `HttpOnly`). Unsafe cookie-authenticated requests must include the
matching `X-CSRF-Token`. The gateway must preserve cookies on HTTP and
WebSocket upgrades. Until these issuer/gateway values are supplied and
verified, protected production operations correctly remain unavailable with
HTTP 503.

There is no local production login or shared browser secret. If JWT verification
is missing or unavailable, protected operations fail closed with HTTP 503.
Health checks and the active, read-only themes/templates/feature-flag catalogs
remain public. Admin settings, private presentations, uploaded sources, media,
jobs, uploads, AI, exports, and all writes require an authenticated session.
The role gate is enforced at the API, regardless of what the React UI displays.

## Tests and builds

```powershell
Set-Location backend
uv sync
$env:DEBUG='false'
uv run alembic upgrade head
uv run alembic current
uv run alembic heads
uv run ruff check .
uv run pytest

Set-Location ..
npm ci
npm run lint
npm run test:run
npm run build
```

Backend integration tests create disposable PostgreSQL and Redis containers.
Docker Desktop must be running.

Maintenance cleanup is dry-run-first and processes bounded batches:

```powershell
Set-Location backend
uv run python -m app.scripts.cleanup
uv run python -m app.scripts.cleanup --apply --older-than-hours 720
```

## Production deployment

Create a deployment-only `.env` beside `compose.production.yml` containing at
least `POSTGRES_PASSWORD`, `CORS_ORIGINS`, `TRUSTED_HOSTS`, `AUTH_JWKS_URL`,
`AUTH_ISSUER`, `AUTH_AUDIENCE`, and `NVIDIA_API_KEY`. Add optional
image-provider keys only when those providers are enabled.
Include the public studio hostname and the internal `backend` service name in
`TRUSTED_HOSTS`; the latter is used by the backend readiness health check.

```powershell
docker compose -f compose.production.yml config
docker compose -f compose.production.yml build
docker compose -f compose.production.yml run --rm migrate
docker compose -f compose.production.yml up -d postgres redis backend worker frontend
docker compose -f compose.production.yml ps
Invoke-RestMethod http://127.0.0.1:8080/api/v1/health/ready
```

Run the one-shot migration service before scaling application replicas. The
frontend container proxies API, media, and WebSocket traffic to FastAPI. It is
published only on `127.0.0.1:8080`; PostgreSQL and Redis have no public ports.
Put an authenticated TLS gateway in front of this private preview listener.
The gateway must perform IEEE/enterprise SSO, mint the signed session and CSRF
cookies described above, preserve them to Nginx/FastAPI, and restrict access to
the private listener. Do not publish port 8080 directly to the public network.
The backend and worker listen on the Compose network only.

If authentication is not yet configured, the web shell and public catalog may
load, but protected API calls deliberately return `503 authentication_unavailable`.
Do not enable public preview access until the gateway and JWKS verification are
configured.

## Backup and restore

Back up the PostgreSQL database plus the `uploads` and `media` volumes. Redis
is recoverable queue/cache state but its AOF volume can also be retained.

```powershell
docker compose -f compose.production.yml exec -T postgres pg_dump -U marp -Fc marp > marp.dump
docker run --rm -v marp-studio_uploads:/data -v ${PWD}:/backup alpine tar czf /backup/uploads.tgz -C /data .
docker run --rm -v marp-studio_media:/data -v ${PWD}:/backup alpine tar czf /backup/media.tgz -C /data .
```

Restore into stopped application/worker services, then run:

```powershell
Get-Content marp.dump -AsByteStream | docker compose -f compose.production.yml exec -T postgres pg_restore -U marp -d marp --clean --if-exists
docker compose -f compose.production.yml run --rm migrate
```

Test restores regularly and keep database/files from the same backup window.

## Troubleshooting

- A 503 readiness response identifies PostgreSQL or Redis as unavailable.
- A 429 response includes `Retry-After`; wait rather than resubmitting.
- Generation requires API, worker, Redis, PostgreSQL, and a valid NVIDIA key.
- Visual-provider failures intentionally fall back to a text-only deck.
- WebSocket failures reconnect with bounded backoff and recover the durable job
  state through the REST job endpoint.
- If a host-level `DEBUG` variable exists, set it explicitly to `true` or
  `false` for backend commands.
