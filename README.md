# PDF Utility Platform

The PDF vertical of the UtilNexa toolbox — a standalone app, own codebase.
Other tool families (developer tools, image tools, calculators, AI tools) are
separate apps, linked together from a master site later. This repo only
builds PDF tools.

## Shipped tools

| Tool | Route | API |
|---|---|---|
| Merge PDF | `/tools/merge-pdf` | `POST /api/v1/pdf/merge` |
| Split PDF | `/tools/split-pdf` | `POST /api/v1/pdf/split` |
| Organize Pages (reorder/rotate/delete/extract) | `/tools/organize-pdf` | `POST /api/v1/pdf/organize` |
| Image to PDF | `/tools/image-to-pdf` | `POST /api/v1/pdf/images-to-pdf` |
| PDF to Image | `/tools/pdf-to-image` | `POST /api/v1/pdf/pdf-to-images` |
| Compress PDF | `/tools/compress-pdf` | `POST /api/v1/pdf/compress` |

All PDF processing happens locally in the Spring Boot backend via Apache
PDFBox — no external PDF API. Uploaded files are processed in memory/temp
files and never persisted; temp files are cleaned up after every request.

## Stack
- Next.js + TypeScript frontend, drag-and-drop reordering via `@dnd-kit`,
  client-side page thumbnails via `pdfjs-dist`
- Java 21 + Spring Boot backend
- Apache PDFBox for PDF manipulation and image-based compression
- AWS SDK S3 client, using MinIO locally and S3-compatible storage in production
- PostgreSQL for metadata/users/jobs later
- Redis for jobs/rate limits/cache later
- Docker Compose for local development
- Ghostscript/LibreOffice/OCR are intentionally prepared as later workers
  rather than forced into the first features (see `docs/NEXT_FEATURES.md`)

## Run
Requirements: Docker Desktop.

```bash
docker compose up --build
```

Open:
- Frontend: http://localhost:3000
- Backend health: http://localhost:8091/actuator/health
- MinIO console: http://localhost:9001

Note the backend is mapped to host port **8091** (container port 8080) —
see `docker-compose.yml`. The frontend reads `NEXT_PUBLIC_API_BASE_URL`,
which defaults to `http://localhost:8091`.

## Production readiness
The current implementation processes everything synchronously in memory for
simplicity. Before scale, large-file processing should move to object
storage + async job workers with strict limits and cleanup — see
`docs/NEXT_FEATURES.md` for the planned sequence (async jobs, OCR, Office
conversion, AI layer).
