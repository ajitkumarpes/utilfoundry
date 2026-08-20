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
| Organize Pages (reorder/rotate/delete/extract) | `/tools/organize-pdf` | `POST /api/v1/pdf/organize` |
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
| Password Protect | `/tools/protect-pdf` | `POST /api/v1/pdf/protect` |
| Unlock PDF | `/tools/unlock-pdf` | `POST /api/v1/pdf/unlock` |
| Grayscale PDF | `/tools/grayscale-pdf` | `POST /api/v1/pdf/grayscale` |
| Extract Images | `/tools/extract-images` | `POST /api/v1/pdf/extract-images` |
| Crop PDF (auto-margins) | `/tools/crop-pdf` | `POST /api/v1/pdf/crop` |
| Sign PDF (visual stamp, not a certified e-signature) | `/tools/sign-pdf` | `POST /api/v1/pdf/sign` |
| Redact PDF (true content removal, not a visual overlay) | `/tools/redact-pdf` | `POST /api/v1/pdf/redact` |

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
- Java 21 + Spring Boot backend — PDFBox for sync tools, a Redis-queued job
  dispatcher for async tools
- Python/FastAPI processor shim (`processor/app.py`) — stateless executor
  running `ocrmypdf`/Tesseract and LibreOffice headless, no DB/queue access
- PostgreSQL for job state, Redis as the job queue, MinIO (S3-compatible)
  for job input/output storage
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

## Production readiness
The synchronous tools process everything in memory; the async tools (OCR,
Office conversion) already run through a real job queue with retry, timeout,
and stale-job reaping — see `docs/NEXT_FEATURES.md` for the full design and
what's still open (a proper migration tool instead of `ddl-auto: update`,
presigned MinIO downloads instead of proxying through the API, before this
goes past a single-operator scale).
