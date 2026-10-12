# MARP Studio feature audit — 12 October 2026

## Why presentation creation failed

The default frontend sends requests to its own origin. The development server
had no `/api/v1` proxy, so those requests did not reach FastAPI. This checkout
also lacked the backend virtual environment and environment file, and Docker
Desktop was stopped. Creation failures were replaced with a generic message.

On this Windows machine, port 5432 cannot be bound by Docker. The local database
now uses 55432. An inherited non-boolean `DEBUG` variable also broke migration
startup; the development launcher now supplies the configured boolean explicitly.

The local API, worker, PostgreSQL, Redis, and Vite are running. From `MARP-`, use
`npm run dev:all` to start them again. The launcher applies migrations and seeds
starter data without overwriting existing records. The local `.env` is ignored
by Git and contains no provider credentials.

## Feature coverage and fixes

| Feature | Audit result |
| --- | --- |
| Landing and blank-deck creation | Fixed API proxy and preserved backend errors; live create verified. Landing visibility and AI feature flag are now honored. |
| Dashboard, search, open, copy, delete | Component and backend coverage; fixed configured initial section, disabled-section fallback, keyboard End crash, duplicate title limits, and copied metadata. Live create/delete checked. |
| Template catalog and creation | Live template-to-presentation creation verified; initial catalog seeded. |
| Markdown template upload | Component/backend tests cover persistence; refresh failures now surface. Upload enabled for new installations. |
| Markdown editor and formatting | Formatting toolbar moved into the editor where a CodeMirror instance exists. Replaced fragile regex rendering with markdown-it; code, tables, links, lists and fenced examples tested. |
| Slide add, delete, duplicate and synchronization | Existing backend CRUD/reorder/reconciliation tests pass. Fixed splitting on separators inside code/comments and inherited/scoped directives. |
| Saving and rename | Wired Ctrl+S; flush before dashboard/new deck and AI actions. Failed saves show an error and retry; unsaved revisions are distinguishable from saved revisions. Added stale-load protection and an unload warning. |
| Themes | Frontmatter theme edits preserve body/code. Custom slugs now resolve; palette tokens survive publication; preview uses draft tokens; new templates reference newly created themes. |
| AI actions | Existing backend tests cover generation, rewrite, shorten, expand, simplify, tone, professional/creative/technical, storytelling, agenda, conclusion, notes, visuals, split, merge, deck improvement and reorder suggestions. Frontend flushes recent edits before selecting backend slides and shows setup errors/results instead of discarding them. Default instructions/theme now reach generation. |
| Source uploads | Backend suite covers PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown, JSON, PNG, JPG/JPEG and WebP, plus rejection, limits, extraction and grounding. Fixed deletion error handling and fallback polling. |
| Realtime progress and cancellation | Real Redis/ARQ/WebSocket tests pass. Frontend now continues checking durable job/source status after WebSocket retries are exhausted. Windows worker signal handling fixed. |
| Generated visuals | Provider/cache/storage/fallback tests pass with controlled providers. Frontend now recognizes generated background/split-image directives and visual classes. Live external image providers were not called. |
| Preview, presentation and fullscreen | Existing component tests plus code review; fixed fullscreen state synchronization, absent Fullscreen API handling and keyboard interception. No visual browser verification was available. |
| Markdown/HTML/PDF export | HTML uses the same sanitized slide renderer and theme tokens as preview. Fixed title/header injection, missing page wrappers, print dimensions and unusable `noopener` print-window handle. Automated export tests pass; native print dialog not visually tested. |
| PowerPoint export | Replaced the always-failing service stub with an endpoint producing editable text slides and source Markdown in notes. Live export and parsed-PPTX integration test pass. This is a text export, not an exact rendering of CSS/images. |
| Administration | Fixed stale published drafts, theme-before-template publishing, default-theme switch ordering, template duplication retaining the original backend ID, sorted-row actions targeting wrong records, palette persistence and draft theme preview. Empty-theme controls disabled. |
| Feature flags and appearance | Editor AI/export/theme flags and landing AI flag now apply. Animation/reduced-motion/ambient policy now reaches the UI. Existing appearance test passes. |
| Embeddable module | Fixed invalid named Dashboard export and added an entrypoint import test. |
| Development and deployment | Added full-stack Windows launcher, configurable Docker ports, Vite HTTP/WebSocket proxy and setup instructions. Backend migrations, health and integration tests pass. Production deployment was not performed. |

## Validation

- Frontend: 49 tests pass; ESLint and production build pass.
- Backend: 227 tests pass; Ruff passes. The suite includes real disposable PostgreSQL and Redis services,
  real worker/HTTP/WebSocket integration, and controlled AI/image provider responses.
- Live local smoke: readiness, create, slide synchronization, save, reload, PPTX,
  template creation and deletion all pass through `http://127.0.0.1:5173/api/v1`.
- Live source smoke: text upload, worker extraction, terminal progress through
  Vite's WebSocket proxy, and source deletion also pass.
- Production npm dependencies: `npm audit --omit=dev` reports zero vulnerabilities.
- Vite/Vitest were upgraded to remove their reported vulnerabilities. Seven
  development-only advisories remain in the Tailwind 3 dependency tree
  (braces and postcss-selector-parser plus dependents). npm proposes Tailwind 4,
  a separate CSS migration requiring visual verification. No forced migration
  was applied during this repair.

## Remaining limits and integration work

- Live NVIDIA generation requires `NVIDIA_API_KEY` in `backend/.env` and enabling
  `createWithAI`/`aiAgent` in administration. The local environment has no NVIDIA
  credential. Real paid/external provider success was therefore not tested.
- The browser tool reported no connected browsers. Native fullscreen, print,
  responsive layout and visual fidelity need a browser review; component and
  transport tests are not a substitute for that review.
- Media Library management, user management, analytics and Activity Log are
  explicit portal-integration placeholders. The role adapter is a UI adapter;
  the backend has no user authentication/authorization integration. These were
  identified as unimplemented integrations, not reported as working features.
- Admin publishing spans multiple API requests and is not atomic. A later
  request failing can leave earlier changes persisted. A transactional backend
  publish endpoint is needed for atomic publication.
- This frontend implements a MARP-compatible subset; arbitrary Marp theme CSS,
  every Marp plugin/directive, pixel-identical CLI output, and offline embedding
  of linked images are not promised by these tests.

No production data or deployment was changed. Temporary live smoke-test decks
were removed. The local starter templates and database remain available.
