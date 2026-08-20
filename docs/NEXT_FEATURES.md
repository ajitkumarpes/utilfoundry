# Next implementation sequence

1. Merge PDF — shipped
2. Split PDF — shipped
3. Extract/Delete/Reorder/Rotate pages — shipped (as "Organize Pages")
4. JPG/PNG -> PDF — shipped (as "Image to PDF")
5. PDF -> JPG/PNG — shipped (as "PDF to Image")
6. Compress PDF — shipped (PDFBox image recompression; Ghostscript upgrade path below)
7. Async job abstraction + object storage workflow — shipped (Postgres `jobs` table,
   Redis list as the queue, MinIO for input/output, 1h retention purge)
8. OCR — shipped (Python/FastAPI processor shim running ocrmypdf; English + Hindi)
9. Office conversions — shipped, with one confirmed exception:
   - Word/Excel/PowerPoint -> PDF: shipped
   - PDF -> Word, PDF -> PowerPoint: shipped
   - **PDF -> Excel: not offered.** LibreOffice has no PDF-import path into Calc in
     this build (no `calc_pdf_import` filter is registered, unlike Writer/Impress) -
     forcing it opens the PDF via Draw and crashes soffice on export. Confirmed
     directly, not assumed. Building this would need a genuinely different approach
     (PDF table extraction, e.g. camelot/tabula) - a different tool, not a LibreOffice
     conversion. Revisit if a user actually asks for it.
10. AI document layer — not started, out of scope for the free/no-LLM tool set
11. Second tool batch — shipped: Rotate, Add Watermark, Add Page Numbers,
    Password Protect, Unlock, Grayscale, Extract Images, Crop (auto-margins),
    Sign (visual stamp), Redact (true content removal). All synchronous,
    same in-memory pattern as batch 1 — no new infrastructure.
    - **Grayscale** converts embedded images only, not arbitrary content-stream
      color operators on vector/text. Rewriting `rg`/`RG`/`k`/`K`/`sc`/`scn` +
      pattern/shading colorspaces correctly is materially harder and risks
      breaking pages for a correctness gain that's rarely what "grayscale my
      PDF" actually means — scans/photos (the dominant real case) are images,
      and those are handled fully. Revisit only if a user explicitly asks for
      full-content grayscale.
    - **Crop** is auto-detect-margins, not manual numeric offsets — a raster
      scan for the tight non-white bounding box per page, not a fiddly
      per-side-in-points UI nobody tunes correctly on a phone.
    - **Sign** is a visual PNG/JPEG stamp placed via drag, never described as
      a "digital signature" or "e-sign" anywhere in the UI — that term carries
      specific legal weight (India's IT Act, Aadhaar-eSign class) a stamped
      image doesn't have.
    - **Redact** rewrites the actual page content stream (via a
      `PDFTextStripper` subclass overriding `processOperator`/
      `processTextPosition`) to drop any text-show or image-draw operator
      whose bounding box overlaps a marked area, then draws an opaque cover —
      the cover is cosmetic, the content removal is what matters. Granularity
      is per-operator (not per-glyph) and any partial overlap drops the whole
      operator, deliberately erring toward removing more rather than risking
      a sliver of sensitive content surviving. Verified by confirming the
      redacted string is genuinely absent from a fresh `PDFTextStripper`
      extraction of the output, and that the `Do` operator for a redacted
      image is actually gone from the rewritten content stream — not just
      that the region renders black. **Known boundary**: an image nested
      inside a Form XObject that has its own resources dictionary (common in
      output from complex desktop-publishing tools, not in scanned/generated
      PDFs) may not be identified as an image during the direct pre-check;
      text inside a form IS still caught (triggers dropping the whole form
      invocation) via the engine's natural recursion. Revisit if a user hits
      this with a real document.
    - **Watermark Devanagari/Hindi support — shipped.** Two OFL-licensed fonts
      are bundled at `backend/src/main/resources/fonts/`
      (`NotoSans-Regular.ttf`, `NotoSansDevanagari-Regular.ttf`, pulled from
      the canonical `notofonts` GitHub org, not the `google/fonts` mirror —
      that repo no longer ships pre-built static instances for these
      families, only a variable font). The watermark text is scanned for the
      Devanagari Unicode block (U+0900–U+097F); pure-Latin input keeps the
      original Helvetica-Bold path unchanged (zero behavior change, zero
      added embedding weight for the common case). Any Devanagari character
      switches the whole call into Unicode mode, which **must split the
      string into per-script runs and draw each with `setFont()` +
      `showText()` in sequence** — confirmed via `hb-shape` that
      `NotoSansDevanagari-Regular.ttf` has zero Latin letter glyphs (only
      Devanagari + shared digits/punctuation), so a mixed string like
      "Room 101 कमरा" genuinely needs both embedded fonts, not one.
      - **A real finding surfaced during verification, worth recording so it
        isn't mistaken for a bug later**: `PDFTextStripper`'s line-detection
        heuristic splits sufficiently long **diagonal/rotated** watermark
        text across multiple extracted lines — confirmed via content-stream
        token inspection that this is NOT missing or corrupted content (every
        character is present, correctly encoded, in the right order) and NOT
        specific to Devanagari or the new font-switching code — an unmodified
        pure-Latin diagonal string of the same length ("Room 101 ABCD")
        exhibits the identical split. This is pre-existing behavior of
        rotated-text extraction in this tool, invisible before now only
        because the original diagonal test used a 5-character string too
        short to trigger it. It doesn't affect the visual watermark (a
        separate, unaffected rendering path) and diagonal stamps aren't
        realistically copy-pasted as contiguous text anyway, so this isn't
        being treated as a defect — but the test suite now asserts against it
        honestly (whitespace-normalized for the diagonal case) rather than
        silently avoiding long diagonal strings.

## Architecture (as shipped)

`Browser -> Next.js -> Spring Boot API -> Redis queue -> JobDispatcher (Spring) ->
processor shim (Python/FastAPI) -> MinIO -> download`.

- **Processor shim** (`processor/app.py`): pure stateless executor, two endpoints
  (`/process/ocr`, `/process/office-convert`), no DB/Redis/S3 client. Runs
  `ocrmypdf` (Tesseract eng+hin) and `soffice --headless`. Every subprocess call
  uses an argv list with allow-listed params - never shell interpolation.
  `soffice` calls are serialized behind an in-process lock (well documented as
  unreliable under concurrent invocation); OCR runs with real concurrency.
  PDF-as-source conversions require `--infilter=writer_pdf_import` /
  `impress_pdf_import`, or LibreOffice opens the PDF via Draw and the export
  filter mismatches - confirmed directly against the actual soffice output, not
  assumed from documentation.
- **Job orchestration** (`backend/.../job/`): Spring Boot owns all state.
  `JobDispatcher` pops job ids off a Redis list (`BRPOP`-style blocking pop) on a
  thread pool separate from Tomcat's request threads, calls the shim, updates the
  `jobs` table. Failed jobs retry up to 3 times **with an 8s backoff between
  attempts** - without this, idle dispatcher threads re-pop a failed job almost
  instantly (confirmed: 3 attempts logged 33ms apart before the fix), which would
  burn all retries before a processor restart could ever recover. A shim 4xx
  response (bad input) fails immediately without retrying; connection failures /
  timeouts retry. `JobMaintenanceTask` purges jobs older than 1h (enforces the
  privacy promise for the async path) and reaps jobs stuck in `PROCESSING` for 5+
  minutes in case the JVM died mid-job - Postgres, not in-memory state, is the
  source of truth.
- **Frontend**: `useJobPoll` hook + a shared `JobToolWorkspace` component for the
  5 option-free conversion tools; OCR is its own page (needs a language picker).
  In-flight jobs survive a page refresh via a `?job=<id>` URL param.
