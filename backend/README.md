# MARP Studio backend — Phase 1

Python 3.12 / FastAPI infrastructure only. No authentication, presentation CRUD,
uploads, AI calls, or job workers are implemented. NVIDIA settings are reserved
and unused. The frontend is independent and unchanged.

## Local startup

Prerequisites: Python 3.12, uv, and Docker with the Compose plugin. From this
directory in PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up -d --wait
uv sync --locked
uv run alembic upgrade head
uv run fastapi dev app/main.py
```

Do not overwrite an existing `.env`. Shell environment variables take precedence
over `.env`. The default credentials are disposable local development values,
not production credentials. Both container ports bind to loopback only. Changing
Postgres credentials after initializing its volume requires changing the database
role too; editing `.env` alone does not change an existing role password.

The API uses port 8000. Interactive docs: `http://127.0.0.1:8000/docs`.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health/ready
docker compose ps
uv run alembic current
uv run ruff check .
uv run pytest
```

`/health` returns HTTP 200 with `{"status":"ok"}` while the process is serving.
Readiness independently executes PostgreSQL `SELECT 1` and Redis `PING` with
bounded timeouts. Healthy response (HTTP 200):

```json
{"status":"ok","database":"connected","redis":"connected"}
```

Unavailable dependencies produce HTTP 503, `status: "unavailable"`, and
`"unavailable"` for each failing dependency. No credentials or exception messages
are included. Startup probes log dependency status but permit the API to start
when services are down; readiness must be used as the deployment traffic gate.
Clients reconnect on subsequent checks, and both pools close during shutdown.
Compose health checks indicate service availability; API readiness also checks
the configured database credentials.

## Configuration and errors

`app/core/config.py` loads the backend's own `.env`, never the frontend `.env`.
`FRONTEND_ORIGINS` accepts comma-separated origins or a JSON array. Explicit
origins are required; wildcard origins are rejected. Secrets use `SecretStr`.
`DEBUG` is reserved as an application setting; it intentionally does not enable
Starlette traceback responses. Use `LOG_LEVEL=DEBUG` for log verbosity.

API errors have `{"error":{"code":"...","message":"..."}}`. Validation
errors add field locations and error types, without echoing request values.
Infrastructure and unexpected error logs include exception classes, not raw
exception text, connection URLs, or tracebacks.

## Database and future modules

`app/core/database.py` owns one async engine and session factory per app lifespan.
Use `Depends(get_db_session)` for request sessions. Services explicitly commit;
exceptions roll back and all request sessions close. `get_redis` exposes the
lifespan-owned Redis client. Do not create per-request connection pools.

Declare future models on `app.models.Base` and import them in
`app/models/__init__.py`; Alembic loads that registry and its metadata. The initial
`0001_baseline` revision has no application tables, only Alembic's version record.
Use reviewed migrations rather than `metadata.create_all()` at app startup:

```powershell
uv run alembic revision --autogenerate -m "describe schema change"
uv run alembic upgrade head
```

An offline migration check is possible with `uv run alembic upgrade head --sql`,
but it does not verify a live database. Unit tests use dependency doubles and do
not connect to PostgreSQL, Redis, or external providers. The real service check is
the local workflow above. The versioned router, repository, schema, and service
packages leave room for REST, WebSocket, and AI jobs in later phases.

`docker compose stop` preserves data. `docker compose down` removes containers
but keeps named volumes. Removing volumes destroys local data.
