# UtilFoundry Image Tools

The image utility vertical for UtilFoundry: practical media operations with explicit uploads, deterministic output, and no account requirement.

## V1 tools

- Compress image with quality and codec controls
- Resize with aspect-ratio preservation and no accidental enlargement
- Pixel crop
- JPG, PNG, WebP and AVIF conversion
- 90°/180°/270° rotation
- Horizontal and vertical flip
- EXIF/GPS/metadata removal through re-encoding
- Image to PDF and Screenshot to PDF
- Image to Base64 data URI
- Base64 to PNG image

Background removal, ML upscaling, and OCR are intentionally separate worker-tier features. They need model/runtime isolation and different resource limits; they are not presented as finished tools in this release.

## Architecture

This first release is a single Next.js App Router service with a Node.js runtime route backed by Sharp/libvips and pdf-lib. Requests are bounded to 32 MB and 40 million pixels, processed in memory, and never persisted by the application. The container has a 768 MB memory ceiling in the included Compose file.

The tradeoff is explicit: files are uploaded to the running instance for processing. Put this service behind TLS, keep request logs free of bodies, and use an external object store only when a future product requirement genuinely needs saved output.

## Run locally

```bash
npm ci
npm run dev -- -p 3021
```

Open <http://localhost:3021>.

Production-style local run:

```bash
npm run build
npm run start -- -p 3021
```

Docker:

```bash
docker compose up --build -d
```

## Security and operations

- Input size and pixel limits protect against decompression bombs.
- Sharp output is re-encoded without metadata unless an operation explicitly needs source bytes.
- No input is written to disk or sent to analytics.
- Responses use `Cache-Control: no-store` and restrictive security headers.
- Add rate limiting at the reverse proxy before public exposure.
- For 2 GB hosts, run this as a separate service with the included 768 MB cap and do not run AI/OCR workers on the same process.
