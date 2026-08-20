# Next implementation sequence

1. Merge PDF — shipped
2. Split PDF — shipped
3. Extract/Delete/Reorder/Rotate pages — shipped (as "Organize Pages")
4. JPG/PNG -> PDF — shipped (as "Image to PDF")
5. PDF -> JPG/PNG — shipped (as "PDF to Image")
6. Compress PDF — shipped (PDFBox image recompression; Ghostscript upgrade path below)
7. Async job abstraction + object storage workflow — not started
8. OCR worker — not started
9. Office conversions — not started
10. AI document layer — not started

## Notes on what's next

Items 1–6 are synchronous, PDFBox-only, and need no new infrastructure — all
shipped in the frontend (Next.js) and backend (`PdfController` +
`*Service` classes in `backend/src/main/java/com/utilnexa/pdf/service`).

Items 7–10 each need infrastructure this repo doesn't have yet:
- **Async jobs**: a queue (Redis is already provisioned but unused) and a
  job-status API so large files don't block the request thread.
- **OCR**: the `processor` container already has Tesseract installed
  (`processor.Dockerfile`) but nothing calls it — needs the async job layer
  first, since OCR is too slow to run synchronously.
- **Office conversion**: same — `processor` has LibreOffice installed but
  unwired.
- **AI document layer**: needs an AI Gateway (see the product discussion) —
  out of scope for the free/no-LLM tool set entirely; a separate initiative.

**Compress upgrade path**: the shipped compressor recompresses embedded
images via PDFBox (JPEG re-encode at a chosen quality). This is real and
already gets ~80-90% reduction on image-heavy PDFs (scans, photos), but a
Ghostscript-based pass (already staged in `processor.Dockerfile`) would
compress vector/text content too and give better ratios generally. Revisit
once the async job layer exists, since Ghostscript needs to run out-of-process.
