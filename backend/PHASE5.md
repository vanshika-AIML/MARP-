# Phase 5: source ingestion

Start from `backend/`:

```sh
docker compose up -d
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py
# In another terminal:
uv run arq app.workers.settings.WorkerSettings
```

Upload a multipart field named `file` to `POST /api/v1/uploads`.
The 202 response contains `source_id` and the current status. Extraction runs
in ARQ, never in the HTTP request. Read `GET /api/v1/uploads/{source_id}`
or connect to `/api/v1/ws/sources/{source_id}`. The WebSocket sends a durable
snapshot, then Redis events, and closes on ready/failed/deleted. Reconnect
to obtain current state; pub/sub is not an event replay log.

Progress is tied to actual processing, extraction, chunking and completion:
`source.processing` (5), `source.extracting` (10), `source.chunking` (70),
`source.ready` (100), or `source.failed` at the last reached milestone.
These are stage markers, not elapsed-time estimates. Uploaded/deleted
snapshots use `source.uploaded` and `source.deleted`.

Once all sources are ready, submit to `POST /api/v1/ai/jobs`:

```json
{
  "action": "generate_full_deck",
  "prompt": "Explain the findings supported by these sources",
  "source_ids": ["replace-with-source-uuid"],
  "options": {"slide_count": 5}
}
```

The same optional source IDs work for outlines, slide generation, slide edits
and the existing synchronous debugging endpoint. Up to 10 distinct sources
are accepted. Factual grounding and citation instructions apply only when
sources are supplied; source content is explicitly untrusted data. Sources
are revalidated before committing, and associations are saved in the same
transaction as the presentation. Grounding is model guidance, not a guarantee
of factual correctness or citation accuracy.

## Formats and limits

- PDF: text layer, up to 200 pages, page references; encrypted PDFs rejected.
- DOCX: headings, paragraphs, lists and bounded tables.
- PPTX: up to 200 slides, titles, body, tables and available speaker notes.
- XLSX: up to 20 sheets, headers and 100 data rows / 30 columns per sheet;
  cached formula values only. CSV uses the same row/column limits.
- TXT/MD/JSON/CSV must be UTF-8. JSON is flattened with paths, depth/entry limits.
- PNG/JPG/JPEG/WebP: validated encoding, dimensions and format metadata.
  No OCR provider is installed. Images do not yield invented text, and
  image-only/scanned-only source requests fail clearly when there is no text.

Default upload limit: 25 MB. Office archives reject traversal, encryption,
macros/embedded active content, duplicate entries, XML entities, extreme
compression ratios, over 1,500 members, over 10 MB per member or over 50 MB
expanded content. Images are limited to 25 million pixels. Extraction output
is capped at 200,000 characters and 500 sections.

Chunks are at most 1,800 characters with 200-character overlap, preserve
page/slide/sheet/section references, and are capped at 256 per source. Context
defaults to 24,000 characters shared across sources. Summaries, conclusions
and section starts are prioritized; selection is extractive, with no generated
summaries, embeddings, vector database or semantic retrieval. Large documents
are intentionally truncated and may require a narrower source.

## Storage and operation

`STORAGE_PROVIDER=local`, `UPLOAD_DIR=./data/uploads`, `MAX_UPLOAD_MB=25`,
`SOURCE_CONTEXT_CHARS=24000`, `INGESTION_TIMEOUT_SECONDS=60`.
Relative upload paths resolve against the backend directory. API and worker
must share that directory; use an absolute shared path on separate processes.
Generated UUID filenames never use the client filename. Paths are not exposed
by the read endpoint. Uploads are git-ignored. The storage interface allows a
future object-storage provider to stage a local copy for parsers; S3 is not
implemented.

Parsers run in a child process without application credentials in its
environment, with a hard wall timeout. POSIX adds CPU/address-space limits;
Windows does not currently enforce an OS memory cap. This is process isolation,
not a hardened OS sandbox. Deploy untrusted public ingestion in a restricted
worker container/service. No Office applications, macros, uploaded scripts,
external links, or image-search providers are executed.

The existing recovery cron requeues stale uploaded/processing sources after
15 minutes. PostgreSQL advisory locks prevent duplicate ingestion; deleted
sources cannot be resurrected by a finishing worker. Delete removes the
local file, chunks and presentation associations. On Windows an open file can
make deletion return 409; retry after extraction. Local filesystem operations
and DB commits are not a distributed transaction; a host crash may require
orphan-file reconciliation. Authentication, per-user ownership/quotas and
retention policies remain outside this phase. Apply existing deployment access
controls before exposing source content publicly.

Validation commands:

```sh
uv run ruff check .
uv run pytest
```

Integration tests use disposable PostgreSQL/Redis containers and mock NVIDIA.
The source runtime test exercises actual HTTP, WebSocket and ARQ workers.
