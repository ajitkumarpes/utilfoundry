# UtilFoundry Image Tools

The image vertical for UtilFoundry: practical media operations with explicit uploads,
predictable output, and no account requirement.

Every tool lives at its own route (`/blur-image`, `/image-to-pdf`, …) behind a shared
shell, so pages are linkable, indexable and statically prerendered.

## Where the work happens

Two engines, chosen per tool:

**In the browser (canvas).** Compress, resize, crop, rotate, flip, remove metadata,
convert, watermark, borders, rounded corners, grayscale, sharpen, blur, Base64 in both
directions, PDF generation, and every Utility tool — metadata inspection, dimensions,
comparison, colour picking, palette extraction, contact sheets, collages, favicon sets and
GIF frame extraction. These never upload anything. That is what makes the previews live:
moving a slider re-renders locally instead of waiting on a round trip.

Previews render at a 1400 px cap with every pixel-denominated option scaled by the same
factor, so what you see is a faithful miniature of the exported file. The export path
re-renders at full resolution.

**On the server.** Only the four model-backed tools — OCR Image, Screenshot to Text,
Image Upscaler and Background Removal — plus AVIF and TIFF encoding, which no browser
can do. Those run in the separate `image-worker` service (Tesseract, U²-Net, FSRCNN).
No paid OCR API and no LLM is involved.

`/api/process` also implements the canvas tools server-side. That path is not used by the
UI; it exists so the API is usable without JavaScript and so the route tests have
something to assert against.

## Tools

| Group | Tools |
| --- | --- |
| Optimize | Image Compressor, Resize Image, Remove Metadata |
| Transform | Crop, Rotate, Flip, Watermark, Add Border, Rounded Corners, Grayscale, Sharpen, Blur |
| Convert | Image Converter, Image to PDF, Screenshot to PDF, Image to Base64, Base64 to Image, Favicon Generator, GIF to Frames |
| AI & OCR | Background Removal, Image Upscaler, OCR Image, Screenshot to Text |
| Utility | Image Metadata Viewer, Image Dimensions, Image Compare, Color Picker, Color Palette Extractor, Contact Sheet, Image Collage |

All thirty tools are built. `lib/tools.ts` still supports a `comingSoon` flag for anything
added later, and a test enforces that a flagged tool carries no engine so no half-working
screen can render.

### Formats implemented here

Four file formats are read or written by hand, because no dependency was worth the weight:

- **EXIF / IPTC / XMP** (`lib/metadata.ts`) — JPEG segments, PNG chunks, WebP RIFF chunks,
  GIF and BMP headers. TIFF IFD walking, rational formatting and GPS conversion included.
- **GIF** (`lib/gif.ts`) — a full decoder: LZW, interlacing, transparency and all four
  frame disposal methods, so a partial frame still comes out as a whole picture. Animated
  WebP and APNG go through WebCodecs' `ImageDecoder` where the browser has it.
- **ICO** (`lib/ico.ts`) — multi-resolution icons; 16/32/48 px as 32-bit BMP DIBs with a
  real AND mask, 256 px as PNG, which is what icon toolchains settled on.
- **ZIP** (`lib/zip.ts`) — stored (not deflated) entries with correct CRC-32 and central
  directory. Everything archived here is already compressed.

## Architecture

- `lib/tools.ts` — the single registry: slugs, categories, copy, engine and preview kind.
  Adding a tool starts here.
- `app/(tool)/[slug]/page.tsx` — one dynamic route, `generateStaticParams` over the
  registry, per-tool metadata.
- `components/tools/*Workbench.tsx` — nine workbenches (canvas, PDF, worker, Base64,
  inspect, colour, compose, favicon, frames) covering every tool, rather than one bespoke
  page each. `ToolPage` dispatches on `tool.engine`.
- `components/tools/OptionsRail.tsx` — the per-tool right-hand panel. Bespoke by design:
  the controls are the product.
- `lib/canvas/` — image loading, the pixel operations, and encoding with the server
  fallback for AVIF/TIFF.
- `lib/pdf.ts` — page layout shared by the on-screen preview and the generated PDF, so the
  preview cannot drift from the output.
- `lib/compose.ts` — contact sheet and collage layout, DOM-free and unit-tested; the same
  geometry renders the preview and the export, at a scale factor.
- `scripts/generate-samples.mjs` — regenerates the sample assets that the newer tools need,
  including a JPEG with hand-built EXIF and GPS records that doubles as a test fixture.

## Run locally

```bash
npm ci
npm run dev -- -p 3021
```

Open <http://localhost:3021>. It redirects to the first tool.

Production-style local run:

```bash
npm run build
npm run start -- -p 3021
```

The four worker-backed tools need the `image-worker` container. Without it they return a
clear "the local image worker is unavailable" message instead of failing silently. For a
plain Node run, set `IMAGE_WORKER_URL` to a reachable worker URL.

Docker:

```bash
docker compose up --build -d
```

The web app is exposed on <http://localhost:3021>; the worker stays private to the Compose
network and has a `/health` endpoint used for the dependency check.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Regenerate the sample assets after editing the generator:

```bash
npm run samples
```

The tests cover the registry's invariants and the API route — output formats, AVIF
encoding, crop ratios, rotation guards, enlargement prevention, multi-image PDF page
counts, Base64 round-tripping and the worker-down path — plus the four hand-written format
implementations: EXIF/GPS parsing against a fixture with known values, GIF decoding frame
by frame, ICO pixel round-tripping, ZIP structure and CRC-32 against the reference vector,
palette determinism, colour conversion and the composition layout invariants. Newer suites
cover lossless metadata stripping (byte-identical scan data, selective GPS/camera/software
modes, WebP header flags), the crop and resize geometry, the BMP encoder, Base64 parsing,
PDF layout with captions and footers, and the compressor and converter routes (palette PNG,
never-larger fallback, EXIF orientation, animated GIF to WebP, JPEG transparency).

## Security and operations

- Input is bounded to 32 MB and 40 megapixels; upscaling additionally caps input at
  12 megapixels and output at 48.
- Browser-side tools transmit nothing at all.
- Server responses use `Cache-Control: no-store`; nothing is written to disk.
- Remove Metadata edits JPEG, PNG and WebP containers in the browser: metadata segments are
  dropped or rewritten and the compressed image data is copied byte for byte. Other formats
  are redrawn as PNG. The output is re-read to report what is actually left.
- Add rate limiting at the reverse proxy before public exposure.
- On a 2 GB host keep the included service limits and run one worker replica. OCR and ML
  jobs are deliberately serialised in the worker's single process.

## Known limits

- OCR "Auto Detect" assumes Latin script; Tesseract has no real language detector, so the
  option resolves to the worker's default language pack. Pick a language for best accuracy.
- HEIC is only readable where the browser decodes it (Safari); Sharp's prebuilt libvips has
  no HEVC decoder. BMP and ICO inputs are sent to the server as the browser's lossless PNG
  decode, because Sharp cannot read them either.
- Screenshot to PDF's capture tabs need `getDisplayMedia`, i.e. a desktop browser. The
  browser always shows its own picker; mobile users upload screenshots instead.
- Metadata reading skips `zTXt` and compressed `iTXt` PNG chunks, which need an inflate
  implementation; uncompressed text chunks are read.
- GIF to Frames decodes GIF itself, but animated WebP and APNG depend on the browser's
  `ImageDecoder`. Firefox has none, and says so rather than failing quietly.
- Upscaling at 4× and 8× is two and three passes of the 2× FSRCNN model.
