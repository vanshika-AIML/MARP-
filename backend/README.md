# MARP Studio backend - Phase 4

Python 3.12 / FastAPI infrastructure and PostgreSQL REST APIs for presentations,
slides, templates, themes, application configuration, and feature flags. All
records are globally accessible. Phase 3 adds synchronous NVIDIA NIM generation,
validated structured slides, and transactional AI edits. Phase 4 adds durable jobs,
an ARQ worker, and WebSocket progress. Authentication, ownership, uploads, and image
generation/search are not implemented.
The frontend is independent and unchanged.

## Local startup

Prerequisites: Python 3.12, uv, and Docker with the Compose plugin. From this
directory in PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up -d --wait
uv sync --locked
uv run alembic upgrade head
uv run python -m app.scripts.seed
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

API errors have `{"error":{"code":"...","message":"..."}}`. Phase 2 input
and business validation returns 400; missing or malformed resource IDs return
404; uniqueness/reference conflicts return 409. Phase 1 validation retains its
422 response with field locations and error types, without echoing request values.
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
`0002_content` adds the six Phase 2 tables without altering existing tables/data.
Use reviewed migrations rather than `metadata.create_all()` at app startup:

```powershell
uv run alembic revision --autogenerate -m "describe schema change"
uv run alembic upgrade head
```

An offline migration check is possible with `uv run alembic upgrade head --sql`,
but it does not verify a live database. `uv run alembic check` compares the live
schema with model metadata. The versioned router, repository, schema, and service
packages leave room for WebSocket and AI jobs in later phases.

`docker compose stop` preserves data. `docker compose down` removes containers
but keeps named volumes. Removing volumes destroys local data.

## Phase 2 REST contract

All routes below use the `/api/v1` prefix. Request/response schemas and examples
of field types are available in `/docs` and `/openapi.json`. Read responses use
explicit Pydantic schemas; database internals are not serialized.

| Resource | Routes |
| --- | --- |
| Presentations | `GET/POST /presentations`, `GET/PATCH/DELETE /presentations/{id}` |
| Slides | `GET/POST /presentations/{id}/slides`, `PATCH/DELETE /slides/{id}` |
| Reorder | `POST /presentations/{id}/slides/reorder` |
| Templates | `GET/POST /templates`, `GET/PATCH/DELETE /templates/{id}` |
| Template actions | `POST /templates/{id}/duplicate`, `POST /templates/{id}/create-presentation` |
| Themes | `GET/POST /themes`, `GET/PATCH/DELETE /themes/{id}` |
| Theme actions | `POST /themes/{id}/duplicate`, `POST /themes/{id}/set-default` |
| Configuration | `GET /admin/config`, `GET /admin/config/{namespace}`, `PUT /admin/config/{namespace}/{key}` |
| Flags | `GET /feature-flags`, `PUT /admin/feature-flags/{key}` |

List responses are arrays with `limit` (1–100, default 50), `offset` (default 0),
and literal, case-insensitive `search`. Presentations accept `status`; templates
accept `category`, `featured`, and `active`; themes accept `active`. Template/theme
lists default to active records. Use `all=true` for both states or `active=false`
for inactive records. An explicit `active` filter takes precedence over `all`.
Known IDs remain readable regardless of their active state. These switches are
filters, not authorization: Phase 2 intentionally has no authentication.

PATCH omits unchanged fields. Explicit null clears nullable fields and is rejected
for required fields. DELETE returns 204. PUT config requires `{"value": ...}`;
PUT flags requires `{"enabled": true, "config": {...}}` (config is optional).
PUT upserts by the natural key and preserves the existing UUID. Namespaces are
lowercase identifiers; the seed covers landing, dashboard, animations, ai, general,
and media. Configuration is public JSON, not a secret store: credential-shaped
keys, excessive nesting, and JSON values over 100 KB are rejected. Theme JSON/CSS
are stored as data only; the backend never executes scripts from configuration.

The existing frontend client uses PUT for presentation updates. This phase
implements the requested PATCH contract; frontend wiring is a separate task.

## Markdown and ordering

Presentation Markdown is canonical. Create and PATCH Markdown synchronize slide
rows in the same transaction. The helper retains YAML frontmatter and ignores
slide separators inside fenced code, HTML comments, and indented code. It does
not render Markdown or implement a complete document parser. Blank documents
start with no slide rows. Up to 1,000 slides and 2,000,000 Markdown characters
are accepted.

Whole-document edits reuse existing slide UUIDs by ordinal position. Unchanged
raw content preserves supplemental metadata; changed content clears that row's
metadata to prevent stale structured data. Excess rows are removed. Individual
slide updates can include supplemental data alongside `raw_markdown`.

Slide mutations lock their presentation, then recompile its ordered raw Markdown
with `\n\n---\n\n`, retaining global frontmatter. Leading/trailing blank lines are
normalized during compilation; indentation is retained. Single-slide input must
not contain global frontmatter or additional slide separators. An omitted position
appends after the highest position. Occupied positions return 409. Deleting a
slide leaves remaining positions unchanged; gaps are allowed.

Reorder accepts `{"slide_ids": ["uuid", "uuid", ...]}` containing every slide ID
exactly once, with no IDs from other decks. The change is atomic and assigns
positions 0..N-1. A deferred unique constraint on `(presentation_id, position)`
permits swaps while rejecting duplicates at commit. Presentation deletion cascades
to slides at the database level.

Theme slugs are unique. A partial unique index permits at most one default, and
a transaction-scoped advisory lock serializes default switching. Default themes
must be active; switch to another theme before deleting/deactivating the default.
Non-default theme deletion clears optional references. Theme duplication generates
a new UUID/slug and never inherits default status. Template duplication and
template-to-presentation creation also always generate new UUIDs.

## Development seed and tests

`uv run python -m app.scripts.seed` explicitly adds three themes, three templates,
eight configuration entries, and eight feature flags. Existing rows and edits are
preserved; no reseeding runs during startup. The command only allows development
or test environments. Seeded AI/upload/export flags remain disabled; these are
client-facing configuration, not authorization for backend endpoints.

`uv run pytest` runs the unit suite plus integration tests against real PostgreSQL
17 in a disposable Docker container on a random loopback port. Docker must be
running and able to access `postgres:17-alpine`. The test fixture applies Alembic
migrations, isolates each test, and removes its container afterward. It never uses
`DATABASE_URL` or the development database. Tests cover real transactions, database
constraints, concurrent changes, Markdown synchronization, and idempotent seeding.
Missing Docker fails explicitly instead of silently skipping database coverage.

For infrastructure/parser unit tests without Docker:

```powershell
uv run pytest --ignore=tests/integration
```

## Phase 3 AI generation

`POST /api/v1/ai/generate` calls `GenerationService`, which uses a lifespan-owned
async NVIDIA NIM client. Set `NVIDIA_API_KEY` in the backend environment or ignored
`.env`, never frontend variables or public admin config. Startup works without a
key; AI requests then return 503 with `ai_not_configured`.

```json
{
  "action": "generate_full_deck",
  "prompt": "Explain the supplied product roadmap to a new teammate",
  "options": {
    "slide_count": 6,
    "tone": "professional",
    "theme": "minimal",
    "persist": false
  }
}
```

Responses contain `action`, a validated `presentation`, compiled `markdown`,
`presentation_id`, `slide_ids`, `persisted`, and optional `reorder_suggestions`.
New preview slides have no persisted IDs. Request validation returns 422; unknown
targets return 404. No job queue, streaming route, or frontend mock is involved.

| Actions | Target and behavior |
| --- | --- |
| `generate_full_deck` | Create a deck, or replace an optional `presentation_id`; `persist` defaults to true. |
| `generate_outline` | Structured outline preview; never writes to the database. |
| `generate_single_slide`, `generate_conclusion` | Append one slide to an optional presentation; standalone requests return a preview. |
| `generate_agenda` | Insert after an existing title slide, otherwise at the start; standalone preview is supported. |
| `rewrite_slide`, `shorten_slide`, `expand_slide`, `simplify_slide`, `change_tone`, `make_professional`, `make_creative`, `make_technical`, `improve_storytelling` | Require `slide_id`; replace only that slide and retain its UUID. The parent can be inferred. |
| `generate_speaker_notes`, `suggest_visuals` | Require `slide_id`; update notes or visual intent while preserving visible content and unrelated metadata. |
| `split_slide` | Replace `slide_id` with 2-5 slides; retain the source UUID for the first result. |
| `merge_slides` | Require `presentation_id` and at least two unique `options.slide_ids`; combine at the first selected position. |
| `improve_entire_deck` | Require `presentation_id`; preserve slide count, order, and UUIDs. |
| `reorder_suggestions` | Require `presentation_id`; suggest an order containing every slide ID without changing the deck. |

`options.persist=false` previews any action without writing. An optional parent ID
on a slide action must match its actual parent. AI input and results are bounded
to 40 slides, 160,000 serialized context characters, and 2,000,000 Markdown
characters; existing Phase 2 CRUD limits remain unchanged.

### Provider and prompt configuration

Environment defaults are `AI_TEMPERATURE=0.5`, `AI_MAX_TOKENS=8192`,
`AI_TIMEOUT_SECONDS=90`, `AI_MAX_RETRIES=2`, `AI_DEFAULT_SLIDE_COUNT=10`, and
`AI_DEFAULT_TONE=professional`. The `ai` admin namespace may override
`temperature`, `max_tokens`, `timeout_seconds`, `default_slide_count`,
`default_tone`, and `prompt_suffix`. Invalid stored values fail before inference.
Explicit request options override allowed defaults; callers cannot change the
provider key, URL, model, timeout, or retry count through the generation request.

Prompts live in `app/prompts/system.py`, `presentation.py`, `slide.py`, and
`editing.py`, assembled by `builder.py` with action rules, existing context, and
the actual Pydantic JSON schema. Output schemas cover slides, notes, visual intent,
and reorder recommendations. Validation happens before any database write.

`NVIDIA_JSON_MODE=false` omits `response_format`; enable it only for an endpoint
supporting JSON response mode. Structured prompting and validation apply either
way. The default endpoint is `https://integrate.api.nvidia.com/v1` and model is
`nvidia/nemotron-3-nano-30b-a3b`. See the
[NVIDIA chat contract](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-30b-a3b-infer).

Transport failures and HTTP 408/429/500/502/503/504 receive bounded retries.
Authentication and other permanent HTTP errors do not retry. Each completion,
including backoff, has a total timeout. Invalid structured output gets one additional
generation attempt, which can use a second timeout window. Safe repair only removes
wrappers and trailing commas outside strings. Duplicate keys, non-finite values,
truncated data, and arbitrary prose are rejected. Logs exclude prompts, outputs,
authorization headers, and provider bodies. An SSE client iterator is ready for
future use; no streaming API is exposed.

### Markdown and persistence

`services/presentations/marp_compiler.py` emits frontmatter, pagination, theme,
layout classes, notes and visual-intent comments, lists, quotes, tables, code,
and supplied image URLs or text placeholders. It never fetches or generates images.
Model text is escaped; the frontend retains render-then-sanitize responsibility.
Code containing slide separators uses escaped preformatted markup for compatibility
with the frontend splitter. `marp_parser.py` performs a basic inverse parse,
not a full Markdown AST.

Inference runs outside database transactions. Persistence locks the parent and
checks its captured parent/slide state. Concurrent edits return HTTP 409 instead
of overwriting user work. Canonical Markdown, ordered slides, structured content,
notes, and visual intent commit together. Unaffected raw content and metadata are
retained. Split/merge preserve unrelated slides and normalize positions. Full
regeneration replaces the deck; improvement preserves UUIDs by position. Existing
tables are sufficient; Phase 3 requires no new migration.

### Verification without NVIDIA credits

AI tests use mocked HTTP responses, including database-backed tests in disposable
PostgreSQL. They cover all 20 actions, output validation, timeout/error mapping,
compilation, basic parsing, metadata preservation, rollback, and concurrent edits.
Run `uv run ruff check .` and `uv run pytest`.

The separate opt-in smoke test sends one tiny real prompt only when a key exists:

```powershell
uv run python -m app.scripts.test_nvidia
```

It validates a small JSON response and prints a safe status. An absent key prints
a skipped result, which does not verify the live provider. Model quality and
account-specific endpoint availability require this manual check.

## Phase 4 background generation

Install dependencies and apply the additive `0003_generation_jobs` migration:

```powershell
docker compose up -d --wait
uv sync --locked
uv run alembic upgrade head
uv run fastapi dev app/main.py
```

In a second terminal, in this backend directory:

```powershell
uv run arq app.workers.settings.WorkerSettings
```

The API and worker read the same backend settings. NVIDIA is called only by the
worker for job requests. `POST /api/v1/ai/generate` remains synchronous for
compatibility/debugging; the new `POST /api/v1/ai/jobs` accepts its existing
request schema and returns HTTP 202 with `{"job_id":"uuid","status":"queued"}`.
It validates resource references and queues work without waiting for the model.
The default persistence/preview semantics are identical to Phase 3.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/v1/ai/jobs/{job_id}` | Durable status, milestone progress, timestamps, safe error, and full result when completed. |
| `POST /api/v1/ai/jobs/{job_id}/cancel` | Idempotently cancel queued/running work; completed or failed jobs retain their terminal state. |
| `WS /api/v1/ws/jobs/{job_id}` | Send current state, then forward Redis events; close after a terminal state. |

WebSocket browser origins use `FRONTEND_ORIGINS`. Unknown jobs are rejected,
and subscriptions are established before the initial database snapshot to avoid
the snapshot/subscription race. Disconnects cancel the listener and unsubscribe.
No WebSocket database polling is used. Reconnect to recover current durable state
after a network interruption; Redis pub/sub does not replay historical events.

### Stable progress contract

Each event contains `event`, `job_id`, `progress`, `data`, `message`, and
`updated_at`. Machine event names are independent of human-readable messages:

`job.queued`, `job.started`, `prompt.analysis`, `outline.started`,
`outline.completed`, `slide.started`, `slide.delta`, `slide.completed`,
`visual.planned`, `theme.applying`, `finalizing`, `job.completed`,
`job.failed`, `job.cancelled`.

Progress represents completed pipeline milestones, not elapsed time or predicted
token progress: queued 0, started 5, context/prompt work 10-20, validated output 70,
theme compilation 80, finalizing 90, committed completion 100. Percentages do not
advance on timers. Failure/cancellation retain the last attained milestone.
The current generator returns a whole JSON response, so slide completion events
occur only after validating that response. `slide.started` and `slide.delta`
are reserved; no fake token events or intermediate outline stage is emitted.
Outline events are specific to the actual outline action.

### Durability, retries, and cancellation

PostgreSQL owns job state/results. Redis carries the ARQ queue and pub/sub messages.
ARQ 0.28 requires redis-py below 6; the lockfile uses redis-py 5.3.1, retaining the
existing async Redis interface. Run both Redis and PostgreSQL before the worker.
Redis must remain private/trusted, including ARQ's serialized job queue.

A PostgreSQL advisory lock prevents concurrent execution of the same job.
Terminal jobs are skipped on duplicate delivery. The final transaction locks the
job before changing presentation data, then commits the presentation/slides and
job result together. A cancellation that wins this lock prevents persistence;
if completion wins first, cancelling returns the completed state.

Cancellation is best effort during a provider request: the HTTP inference may
finish and incur usage, but checkpoints and the final transaction prevent its
cancelled output from being saved. Client disconnects do not cancel jobs.
Transient provider/timeouts/connection errors receive at most three worker
attempts; permanent authentication, malformed output, configuration, and conflict
errors become failed jobs. Phase 3's bounded transport and JSON correction retries
still apply within each attempt. Errors sent to clients contain safe codes/messages.

A worker reconciliation task runs once per minute and re-enqueues queued/running
rows unchanged for 15 minutes, covering interrupted workers or the DB/queue crash
window. This recovery can repeat an unfinished model call after process loss.
The per-attempt job deadline is 660 seconds; ARQ's outer deadline is 700 seconds.
Database outages can delay recording a terminal state until recovery.
Notification publication is best effort; polling GET or reconnecting retrieves
the durable outcome even when the final pub/sub message was lost.

There is still no authentication/ownership or per-user job quota. Do not expose
the unauthenticated generation API publicly without those controls. No uploads,
image generation/search, or frontend changes are part of Phase 4.

### Verification

```powershell
uv run ruff check .
uv run pytest
```

The suite uses isolated disposable PostgreSQL and Redis Docker containers, with
NVIDIA mocked. It exercises real ARQ processing, HTTP acceptance before inference,
network WebSocket delivery/cleanup, persistence, failures, cancellation races,
transaction rollback, and concurrent duplicate protection. No NVIDIA credits
are needed. ARQ 0.28 currently emits a redis-py `close()` deprecation warning on
worker shutdown; it comes from the dependency and does not fail the checks.

On Windows, a reserved host port can prevent Docker from publishing 5432 even
when PostgreSQL itself is healthy. Use an available loopback port with a local
Compose override and matching `DATABASE_URL` port for API, migrations, and worker.
Do not remove volumes or change database passwords to fix a host-port reservation.
