# Phase 6: visual intelligence

The frontend is unchanged. Nemotron plans optional visual intent, and the existing
generation service/ARQ worker resolves it before MARP compilation. Legacy
`type: image/diagram/none` intent remains accepted; new plans use
`mode: search/generate/none`, query/prompt, placement, aspect ratio, style and alt text.
Only resolved providers supply attribution and media references.

## Setup

Run from `backend/`:

```sh
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py
# Separate terminal:
uv run arq app.workers.settings.WorkerSettings
```

Set backend-only `PIXABAY_API_KEY` for search and/or `STABILITY_API_KEY` for
generation in the ignored `.env`. These are independent of NVIDIA credentials.
No secrets are exposed by admin config. Existing keys/defaults are unchanged.

Search and generation are disabled by default. Read effective defaults from
`GET /api/v1/admin/visuals`. Use the existing
`PUT /api/v1/admin/config/visuals/{key}` with `{"value": ...}` to set:

| Key | Allowed values/default |
| --- | --- |
| search_enabled | boolean, false |
| generation_enabled | boolean, false |
| search_provider | none / pixabay |
| generation_provider | none / stability |
| preferred_strategy | auto / search / generate; auto |
| max_visuals_per_deck | 0?20; 6 |
| default_image_style | bounded text; restrained editorial style |

The admin route validates types, provider names and bounds. Arbitrary endpoint
URLs and credential keys are rejected. Configure API access controls before
exposing the existing unauthenticated admin surface publicly.

## Providers

`ImageSearchProvider`, `ImageGenerationProvider`, `VisionProvider` and
`MediaStorageProvider` are independent contracts. `ProviderRegistry` contains
adapter registration; MARP compilation and selection do not call vendor APIs.
The initial adapters are:

- Pixabay photo search with safe search, horizontal orientation and minimum
  dimensions. Candidates are ranked by aspect ratio and resolution; explicit
  watermark flags/URLs and unsafe candidates are excluded.
- Stability Stable Image Core, with prompt, aspect ratio, style and slide context.
- Local media storage; no S3 implementation.
- Optional injected vision suitability adapter; no vision model is installed.

Adapter references: [Pixabay API](https://pixabay.com/api/docs/) and
[Stability API](https://platform.stability.ai/docs/api-reference).
Adding another provider requires an adapter, registration and an allowed admin
provider name. Credentials belong only in environment settings.

## Pipeline and fallback

New events: `visual.planning`, `visual.searching`, `visual.generating`,
`visual.ready`, `visual.failed`. Existing `visual.planned` remains compatible.
These represent real operations, not fabricated percentages or token progress.
No images are forced onto every slide. Technical tables/code/stats normally
remain text-only; an explicit framed visual can opt in.

By default a provider error, missing key, rejected image, duplicate asset or
exhausted visual budget falls back to a text-only slide. Set
`options.visuals_required=true` to fail a request when a selected visual cannot
be prepared. Outlines only plan intent; they do not call image providers.
Cancellation is checked at stage events and again before committing the deck.

The additional visual stage has a 45-second total budget (configurable downward
with `VISUAL_BUDGET_SECONDS`), fitting the existing worker timeout. Later slides
may use text-only fallback when this budget is exhausted.

## Media and caching

Migration `0005_media` adds `media_assets` and `media_cache`. Media stores source,
provider, dimensions, MIME, alt text, query/prompt, attribution/licence metadata
and content digest. Generated UUID filenames are stored under `MEDIA_DIR`
(default `./data/media`, git-ignored). API and worker must share this directory.

Normalized request/provider/version/style/context/validation settings form the
cache key. PostgreSQL advisory locks prevent concurrent duplicate calls.
Selected results cache for 24 hours, provider failures for 5 minutes. Pixel
content is deduplicated by hash after sanitation. Duplicate images are skipped
within a deck unless `allow_repeat` is explicitly requested. Different source
URLs yielding identical pixels reuse the original asset and its provenance.
Cached assets can outlive cancelled jobs; automatic retention/garbage collection
is not included. Filesystem writes and DB commits are not a distributed transaction.

`GET /api/v1/media/{id}` returns safe metadata.
`GET /api/v1/media/{id}/file` serves validated JPEG pixels with nosniff headers.
It never accepts filesystem paths or arbitrary fetch URLs. Prompt/query and
stored paths are not included in public metadata responses. Relative media URLs
require rendering from the backend origin or an API reverse proxy; standalone
exports need asset packaging in a later phase.

## Security and rendering

Outbound fetches allow HTTPS port 443 only, reject credentials/private/local
addresses, and validate every redirect. A custom resolver returns only checked
public addresses directly to the connector, avoiding a second DNS resolution.
Environment proxies are disabled. Provider API redirects are refused; media
redirects are bounded and never forward authorization.

Responses are bounded by size/time. PNG/JPEG/WebP must match declared MIME and
decode successfully; SVG/HTML/animated media are rejected. Images are limited to
20 million pixels and 8192 pixels per dimension; search images must be at least
800?450. Re-encoding strips EXIF and embedded metadata. Default media size limit:
8 MB (`MAX_MEDIA_MB`). Search safety filters do not guarantee factual relevance,
licensing suitability, or absence of subtle watermarks; no semantic vision
verification is configured.

MARP uses native background/split directives plus normal inline hero/framed
images. Layout classes are `visual-full-bleed`, `visual-split`, `visual-hero`,
`visual-background`, `visual-framed`. Small scoped crop/frame styles are
appended to existing frontmatter styles, preserving theme selection and other
directives. A bounded media metadata region preserves asset references through
the backend parser. Attribution is rendered visibly when supplied.

## Verification

```sh
uv run alembic upgrade head
uv run ruff check .
uv run pytest
```

Tests mock providers and use disposable PostgreSQL/Redis instances. They cover
selection, successful search/generation, persisted media, cache concurrency,
deduplication, provenance, layouts, job events/fallback, admin validation,
unsafe URLs/redirects/DNS answers, MIME/content/dimensions and safe file serving.
Live paid image-provider verification requires configured credentials.

