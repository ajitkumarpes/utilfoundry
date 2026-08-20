# Architecture

## Current vertical slice
Browser -> Next.js -> Spring Boot -> PDFBox -> merged PDF response.

## Planned processing architecture
Browser -> Spring Boot API -> job queue -> specialized processor -> object storage -> download.

Specialized processing dependencies prepared in `processor.Dockerfile`:
- Ghostscript: compression/rendering
- LibreOffice: Office/PDF conversion
- Tesseract OCR: OCR
- Poppler utilities: PDF rendering/conversion helpers

## Storage
MinIO is used locally as an S3-compatible object store. Production can use Amazon S3 or another S3-compatible provider without changing the application contract.

## Why this starts simple
The first Merge PDF feature is synchronous so the team can immediately validate the product. Large files, OCR and Office conversions should move to asynchronous worker jobs before production scale.
