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
- OCR Image and Screenshot to Text through the local Tesseract worker
- 2× Image Upscaler through the local FSRCNN super-resolution model
- Background removal through the local U²-Net model

OCR, background removal and upscaling run in the separate `image-worker` service. No paid OCR API or LLM is used. The worker has its own CPU/memory limits, model cache and request boundary so heavier workloads cannot take down the normal Sharp service.

## Architecture

This release is a Next.js App Router service with a Node.js runtime route backed by Sharp/libvips and pdf-lib, plus a separate Python worker backed by Tesseract, U²-Net and FSRCNN. Requests are bounded to 32 MB and 40 million pixels, processed in memory, and never persisted by the application. Both services have explicit CPU and memory ceilings in the included Compose file.

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

The four worker-backed tools require the `image-worker` container (the Compose command below starts it automatically). For a plain Node run, set `IMAGE_WORKER_URL` to a reachable worker URL.

Docker:

```bash
docker compose up --build -d
```

The Compose stack exposes the web app on <http://localhost:3021>. The worker remains private to the Compose network and has a `/health` endpoint for the web service dependency check.

## Security and operations

- Input size and pixel limits protect against decompression bombs.
- Sharp output is re-encoded without metadata unless an operation explicitly needs source bytes.
- No input is written to disk or sent to analytics.
- Responses use `Cache-Control: no-store` and restrictive security headers.
- Add rate limiting at the reverse proxy before public exposure.
- On a 2 GB host, keep the included service limits and run one worker replica. OCR and ML jobs are intentionally serialized by the worker's single process; scale out only after measuring memory and queue latency.
