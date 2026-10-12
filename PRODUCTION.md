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

## Configuration

Frontend builds accept `VITE_API_BASE_URL` and optional `VITE_WS_BASE_URL`.
Leave both unset in the production container so HTTP, media, and WebSockets use
the reverse-proxy origin.

The backend reads the variables in `backend/.env.example`. Production requires
`APP_ENV=production`, `DEBUG=false`, a non-local PostgreSQL URL, a non-local
Redis URL, explicit `CORS_ORIGINS`, and explicit `TRUSTED_HOSTS`. Secrets stay
in the deployment environment or secret manager and are never browser-visible.

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
least `POSTGRES_PASSWORD`, `CORS_ORIGINS`, `TRUSTED_HOSTS`, and
`NVIDIA_API_KEY`. Add optional image-provider keys only when those providers
are enabled.

```powershell
docker compose -f compose.production.yml config
docker compose -f compose.production.yml build
docker compose -f compose.production.yml run --rm migrate
docker compose -f compose.production.yml up -d postgres redis backend worker frontend
docker compose -f compose.production.yml ps
Invoke-RestMethod http://localhost:8080/api/v1/health/ready
```

Run the one-shot migration service before scaling application replicas. The
frontend container terminates HTTP and proxies API, media, and WebSocket traffic
to FastAPI. Put the frontend service behind the platform TLS/load-balancer layer.

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
