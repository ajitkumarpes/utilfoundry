# PDF Utility Platform

The PDF vertical of the UtilNexa toolbox — a standalone app, own codebase.
Other tool families (developer tools, image tools, calculators, AI tools) are
separate apps, linked together from a master site later. This repo only
builds PDF tools.

## Shipped tools

**Synchronous** (in-memory, one request in, one response out):

| Tool | Route | API |
|---|---|---|
| Merge PDF | `/tools/merge-pdf` | `POST /api/v1/pdf/merge` |
| Split PDF | `/tools/split-pdf` | `POST /api/v1/pdf/split` |
| Organize Pages (reorder/rotate/duplicate/delete/extract/insert blank/insert from another PDF) | `/tools/organize-pdf` | `POST /api/v1/pdf/organize` |
| Image to PDF | `/tools/image-to-pdf` | `POST /api/v1/pdf/images-to-pdf` |
| PDF to Image | `/tools/pdf-to-image` | `POST /api/v1/pdf/pdf-to-images` |
| Compress PDF | `/tools/compress-pdf` | `POST /api/v1/pdf/compress` |

**Async** (submit → poll → download, backed by a job queue + the `processor` container):

| Tool | Route | API |
|---|---|---|
| OCR PDF (English + Hindi) | `/tools/ocr-pdf` | `POST /api/v1/pdf/ocr` |
| Word to PDF | `/tools/word-to-pdf` | `POST /api/v1/pdf/word-to-pdf` |
| Excel to PDF | `/tools/excel-to-pdf` | `POST /api/v1/pdf/excel-to-pdf` |
| PowerPoint to PDF | `/tools/ppt-to-pdf` | `POST /api/v1/pdf/ppt-to-pdf` |
| PDF to Word | `/tools/pdf-to-word` | `POST /api/v1/pdf/pdf-to-word` |
| PDF to PowerPoint | `/tools/pdf-to-ppt` | `POST /api/v1/pdf/pdf-to-ppt` |

PDF to Excel is not offered — LibreOffice has no PDF-import path into Calc
(confirmed directly, not assumed); see `docs/NEXT_FEATURES.md` for details.

**Synchronous, second batch** (rotate/watermark/page numbers/protect/unlock/
grayscale/extract-images/crop, all follow the same in-memory pattern as the
first batch above):

| Tool | Route | API |
|---|---|---|
| Rotate PDF | `/tools/rotate-pdf` | `POST /api/v1/pdf/rotate` |
| Add Watermark | `/tools/watermark-pdf` | `POST /api/v1/pdf/watermark` |
| Add Page Numbers | `/tools/page-numbers-pdf` | `POST /api/v1/pdf/page-numbers` |
| Lock PDF | `/tools/lock-pdf` | `POST /api/v1/pdf/protect` |
| Unlock PDF | `/tools/unlock-pdf` | `POST /api/v1/pdf/unlock` |
| Grayscale PDF | `/tools/grayscale-pdf` | `POST /api/v1/pdf/grayscale` |
| Extract Images | `/tools/extract-images` | `POST /api/v1/pdf/extract-images` |
| Crop PDF (auto-margins) | `/tools/crop-pdf` | `POST /api/v1/pdf/crop` |
| Sign PDF (visual stamp, not a certified e-signature) | `/tools/sign-pdf` | `POST /api/v1/pdf/sign` |
| Redact PDF (true content removal, not a visual overlay) | `/tools/redact-pdf` | `POST /api/v1/pdf/redact` |

**Synchronous, third batch:**

| Tool | Route | API |
|---|---|---|
| Repair PDF | `/tools/repair-pdf` | `POST /api/v1/pdf/repair` |
| PDF to Text | `/tools/pdf-to-text` | `POST /api/v1/pdf/to-text` |
| Edit PDF Metadata | `/tools/edit-metadata` | `POST /api/v1/pdf/metadata` |
| Pages per Sheet (2-up / 4-up) | `/tools/pages-per-sheet` | `POST /api/v1/pdf/n-up` |

**Synchronous, fourth batch ("Round 2"):**

| Tool | Route | API |
|---|---|---|
| Edit Bookmarks | `/tools/bookmarks-pdf` | `POST /api/v1/pdf/bookmarks` (+ `/bookmarks/read`) |
| Sanitize PDF | `/tools/sanitize-pdf` | `POST /api/v1/pdf/sanitize` (+ `/sanitize/scan`) |
| Header & Footer | `/tools/header-footer-pdf` | `POST /api/v1/pdf/header-footer` |
| Text to PDF | `/tools/text-to-pdf` | `POST /api/v1/pdf/text-to-pdf` |
| Markdown to PDF | `/tools/markdown-to-pdf` | `POST /api/v1/pdf/markdown-to-pdf` |
| HTML to PDF | `/tools/html-to-pdf` | `POST /api/v1/pdf/html-to-pdf` |

Both of these pre-read the file before showing options — Edit Bookmarks
shows any existing bookmarks to edit rather than starting blank, Sanitize
shows a scan of what it actually found (metadata, attachments, comments,
links, scripts) with matching checkboxes pre-ticked. See
`docs/NEXT_FEATURES.md` item 14 for the full design notes on this round.

**Synchronous, fifth batch (gap sweep):** after Round 2 shipped, a systematic
pass matched every item from the original feature brainstorm against what
actually exists in the repo, rather than relying on memory of what was
scoped in. Several items came back genuinely unaddressed with no on-record
decision either way:

| Tool | Route | API |
|---|---|---|
| Extract Links | `/tools/extract-links` | `POST /api/v1/pdf/extract-links` |
| Extract Attachments | `/tools/extract-attachments` | `POST /api/v1/pdf/extract-attachments` |
| Flatten PDF | `/tools/flatten-pdf` | `POST /api/v1/pdf/flatten` (+ `/flatten/scan`) |
| Extract Fonts | `/tools/extract-fonts` | `POST /api/v1/pdf/extract-fonts` |

Plus two enhancements to existing tools: Organize Pages gained a Duplicate
action per page (no backend change needed — the plan format already allowed
the same source page to appear twice), and Sanitize PDF gained a fifth,
independent checkbox to strip clickable link annotations, alongside its
existing metadata/attachments/comments/scripts checkboxes. Flatten PDF and
Extract Fonts both shipped one turn later than the rest, after directly
correcting this same document's first-pass reasoning for excluding them —
Extract Fonts specifically after asking the user to weigh in on the
licensing risk (embedding a font for display and reusing the font file
elsewhere are governed by different rights); the tool ships with that
disclosed directly in its own copy. See `docs/NEXT_FEATURES.md` item 14 for
the full account, including Request Signature — the one item excluded from
this batch, now fully scoped (email provider, durable-state schema, signer
flow, abuse-prevention model) but still not built, pending a separate
go-ahead.

Repair re-saves whatever PDFBox's own recovery-capable parser was able to
read from a damaged file — it doesn't have separate "repair logic," the
recovery already happens on load, and this tool's job is to persist that
recovery as a clean file. Pages per Sheet imports each source page as a
reusable Form XObject (`LayerUtility`) rather than rasterizing to an image,
so text stays real text and quality doesn't degrade — each page is scaled
to fit its cell without distorting its aspect ratio.

Add Watermark supports Hindi/Devanagari free text, not just Latin — two
OFL-licensed Noto fonts are bundled and the text is automatically split into
per-script runs (Devanagari input has no Latin glyphs in its font and vice
versa, confirmed directly, not assumed) so mixed strings like "Room 101
कमरा" render correctly. Grayscale converts embedded images only (not
arbitrary vector/text color) — disclosed in the tool's own copy, not
silently limited. Redact rewrites the
page's content stream to drop any text-show or image-draw operator
overlapping a marked area, then covers it — verified by confirming redacted
text is genuinely absent from `PDFTextStripper` output on the result, not
just visually covered. Compare PDFs, Fill PDF Forms, and PDF/A conversion
are deliberately not offered; see `docs/NEXT_FEATURES.md`.

All processing happens locally — Apache PDFBox for the synchronous tools,
Tesseract/`ocrmypdf`/LibreOffice (via a Python processor shim) for the async
ones. No external PDF API. Job inputs/outputs live in MinIO for at most 1
hour, then are purged automatically regardless of whether they were
downloaded.

## Stack
- Next.js + TypeScript frontend, drag-and-drop reordering via `@dnd-kit`,
  client-side page thumbnails via `pdfjs-dist`, job polling via a shared hook
- Java 21 + Spring Boot backend — PDFBox for sync tools, a durable Postgres-backed
  job dispatcher for async tools
- Python/FastAPI processor shim (`processor/app.py`) — stateless executor
  running `ocrmypdf`/Tesseract and LibreOffice headless, no DB/queue access
- PostgreSQL for job state and its atomic work queue, Redis for distributed rate
  limiting, MinIO (S3-compatible) for job input/output storage
- Docker Compose for local development

## Run
Requirements: Docker Desktop.

```bash
docker compose up --build
```

Open:
- Frontend: http://localhost:3000
- Backend health: http://localhost:8091/actuator/health
- Processor health: http://localhost:8000/health
- MinIO console: http://localhost:9001

Note the backend is mapped to host port **8091** (container port 8080) —
see `docker-compose.yml`. The frontend reads `NEXT_PUBLIC_API_BASE_URL`,
which defaults to `http://localhost:8091`.

## Site essentials
Beyond the tools themselves: CORS origins and the per-IP rate limit (default
20 requests/minute on `/api/**`, Redis-backed token bucket via Bucket4j — see
`RateLimitFilter`) are both environment-configurable (`CORS_ALLOWED_ORIGINS`,
`RATE_LIMIT_PER_MINUTE` — see `.env.example`), not hardcoded to localhost.
Every tool page has its own SEO title/description (client-component pages
get theirs from a sibling `layout.tsx`, since Next.js metadata exports
require a Server Component); a generated favicon, OG image, `robots.txt`,
`sitemap.xml`, and a branded 404 page are all in place. Privacy Policy
(`/privacy`) and Terms of Service (`/terms`) exist and are linked from the
footer — their content accurately describes how this app actually handles
files, but **both have `[CONTACT_EMAIL]` / `[JURISDICTION]` placeholders
that need real values filled in before this goes live**; nothing here
fabricates a company identity that doesn't exist yet.

## Production deployment

For the production topology (landing page, developer tools, PDF backend, processor, PostgreSQL, Redis,
MinIO, and Caddy), see [docs/PRODUCTION.md](docs/PRODUCTION.md) and the sibling `utilnexa-web/deployment`
Compose project. The local `docker-compose.yml` is intended for development only.

## Production readiness
The synchronous tools process within the request (Merge uses immediately deleted
temporary files); the async tools (OCR,
Office conversion) already run through a real job queue with retry, timeout,
and stale-job reaping — see `docs/NEXT_FEATURES.md` for the full design.

Three items formerly listed here as open are now shipped: schema changes go
through real Flyway migrations (`backend/src/main/resources/db/migration/`,
`ddl-auto: validate` as a safety net, not `update`); the download endpoint
redirects to a short-lived presigned MinIO URL instead of proxying file
bytes through the API's own memory; and the rate limiter is now Redis-backed
(`RedisRateLimiter`, shared across however many backend replicas are
running, not a per-instance `ConcurrentHashMap`). On a Redis outage it moves
to bounded per-instance emergency buckets, preserving availability without
silently removing abuse protection; a short command timeout and
`REJECT_COMMANDS` prevent the multi-minute request hangs caused by Lettuce's
reconnection defaults.

Still open: this has never been deployed anywhere — CI now verifies every
push and pull request, but a hosting target, deployment pipeline, domain and
TLS configuration still need to be selected.
