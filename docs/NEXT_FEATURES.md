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
    Lock PDF, Unlock, Grayscale, Extract Images, Crop (auto-margins),
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
12. Site completeness pass — shipped:
    - **CORS was hardcoded to `http://localhost:3000`** with no env override —
      would have rejected every request the moment the frontend ran on a real
      domain. Now reads `app.cors.allowed-origins` (`CORS_ALLOWED_ORIGINS`
      env var, comma-separated), defaulting to `http://localhost:3000` so
      local dev is unaffected. Verified with real cross-origin curl requests:
      the configured origin gets `200` + the correct
      `Access-Control-Allow-Origin` header, an unrelated origin gets `403`.
    - **Zero rate limiting existed anywhere in the backend.** Added
      `RateLimitFilter` (Bucket4j, in-memory token bucket, per client IP) on
      `/api/**`, default 20 req/min (`RATE_LIMIT_PER_MINUTE`). Client IP comes
      from `getRemoteAddr()` by default — `X-Forwarded-For` is only trusted if
      `app.rate-limit.trust-forwarded-for=true` is explicitly set, because
      blindly trusting that header lets a caller spoof their rate-limit
      identity unless a real reverse proxy is the one setting it; flip it on
      only once this sits behind one. Idle per-IP buckets are evicted every 5
      minutes so the map doesn't grow unbounded under a many-source-IP abuse
      pattern. Verified with 25 rapid real requests against a running
      instance: requests 1–20 passed through, 21–25 got a real `429` with a
      clean JSON body — the threshold lands exactly where configured, not
      approximately.
    - **No Privacy Policy or Terms of Service existed.** Both now exist
      (`/privacy`, `/terms`, linked from the footer), and their content
      describes verified real behavior (in-memory sync processing, 1-hour
      MinIO auto-purge for async jobs, zero third-party analytics/tracking
      dependencies in `package.json`, no payment processing anywhere in this
      repo) rather than boilerplate. **Both have `[CONTACT_EMAIL]` /
      `[JURISDICTION]` placeholders** — deliberately not fabricated, since
      inventing a fake contact or registered jurisdiction in a legal document
      would be actively worse than leaving it marked as missing. Fill these
      in before this goes live.
    - **No `public/` assets, no per-page SEO metadata, no custom 404.** Added
      a generated favicon (`app/icon.tsx`) and OG image
      (`app/opengraph-image.tsx`, via `next/og`, matching the site's actual
      `.brand` mark — not a generic placeholder), `robots.ts`, `sitemap.ts`
      (homepage + both legal pages + all 22 tool routes), and
      `app/not-found.tsx`. Every tool page now has its own title/description
      instead of all 22 sharing one generic `<title>` — the 7 tools whose
      `page.tsx` is already a Server Component got `export const metadata`
      directly; the other 15 are Client Components (`"use client"`), which
      Next.js forbids from exporting metadata at all, so each got a new
      sibling `layout.tsx` carrying the metadata instead — **zero changes to
      any of the 15 already-working client page.tsx files.** Root layout now
      defines a title template (`"%s | PDFLab"`) so child pages only need a
      short unique title. Verified in a real, rebuilt-from-scratch browser
      session: correct tab title for both a direct-metadata page
      (`Merge PDF | PDFLab`) and a sibling-layout page
      (`Redact PDF | PDFLab`), `/robots.txt` and `/sitemap.xml` serving valid
      content, the favicon and OG image both returning real PNGs, the custom
      404 page rendering for an unknown route, and — to close the loop that
      none of this broke the actual product — a real file drop through
      Merge PDF's UI completing end-to-end (`200`, correct merged output)
      after the full rebuild.
    - **Still open, not attempted here**: this app has never been deployed
      anywhere (no CI/CD, no hosting target, no TLS — local `docker compose
      up` only). That's an infrastructure/hosting decision for the user to
      make, not something to guess at in code.
13. Fourth tool batch — shipped: Repair PDF, PDF to Text, Edit PDF Metadata,
    Pages per Sheet (2-up/4-up).
    - **Repair** doesn't implement separate repair logic — PDFBox's own
      parser already recovers from a broken xref table or trailer by falling
      back to a full-file object scan when it loads a document at all; this
      tool's entire job is to persist whatever was recovered as a clean,
      well-formed file. Verified with a real fixture, not assumed: built a
      valid 2-page PDF, corrupted its `startxref` byte offset to an
      impossible value, fed it through the service, and confirmed the output
      still has exactly 2 pages.
    - **Pages per Sheet** imports each source page as a Form XObject via
      PDFBox's `LayerUtility` (verified against the real 3.0.5 jar with
      `javap` before writing any code, not assumed from memory) rather than
      rasterizing to an image — real vector/text content is preserved, not
      flattened. Each page is scaled to fit its grid cell without distorting
      its aspect ratio (letterboxed/centered, never stretched). Only 2-up
      (1x2) and 4-up (2x2), both landscape A4 — the two layouts that cover
      the overwhelming majority of real "handout" use, not an arbitrary
      N-per-page picker nobody would tune correctly. Verified that content
      genuinely survives the Form XObject round-trip, not just visually: a
      4-page source PDF with a distinct label per page, after 4-up, has every
      label still present in a fresh `PDFTextStripper` extraction of the
      output.
    - **Edit PDF Metadata** (original version): a field was only changed if
      the caller actually sent it — an omitted field left the existing value
      untouched. The frontend form intentionally never sent an empty field,
      because it didn't show the PDF's current metadata values — a blank
      input silently erasing a value the user can't see would be a real
      footgun. **Superseded in Round 2, see item 14** — the form now shows
      current values, which removes the reason this behavior existed.
    - **PDF to Text** is a direct `PDFTextStripper` pass — same extraction
      engine already proven correct elsewhere in this codebase (it's what
      verifies Redact actually removes content). Scanned pages with no
      text layer come out empty; the tool's own copy says so and points to
      OCR PDF first, rather than silently returning an empty file with no
      explanation.
14. Round 2 (in progress) — Edit Bookmarks, Sanitize PDF, Header & Footer,
    Text/Markdown/HTML to PDF, plus Split even/odd pages, Lock PDF extra
    permission toggles, and Organize Pages gaining blank-page and
    second-file page inserts. Staged, each stage independently built,
    tested, and committed.
    - **Three exclusions carried over from the first tool-batch round that
      were only ever reasoned about in a since-discarded plan file, written
      down here for real so they don't get re-litigated from memory:**
      - **Compare PDFs** — not offered. A real diffing feature has its own
        UI paradigm (two files in, a diff view out, no single processed
        file to download) — different enough in shape from every tool here
        that bolting it on would either be shallow (byte-diff, not useful)
        or effectively a second project.
      - **Fill PDF Forms** — not offered. Needs AcroForm field detection and
        an interactive form-filling surface, a different interaction model
        from every tool here (upload → options → download). A real,
        substantial feature, not a quick add — comparable in size to the
        whole Sign/Redact canvas-editor build.
      - **PDF/A conversion** — not offered. PDF/A specifically needs ICC
        profile embedding and real conformance validation (veraPDF-class);
        doing it superficially would hand someone a file that fails the
        exact government/archival portal validator it's meant for, which is
        worse than not offering it at all.
    - **Split PDF gained EVEN/ODD modes**, alongside the existing ALL/RANGES
      — returns one PDF with just the odd- or even-numbered pages, in
      original order. Rejects a request for even pages on a 1-page document
      (nothing to return) with a clear message rather than silently handing
      back an empty file.
    - **Lock PDF gained two more permission toggles** ("Allow editing the
      document", "Allow filling in form fields") — previously hardcoded to
      always-restricted regardless of what the caller asked for. Printing
      and copying were already configurable; this completes the same
      treatment for the other two `AccessPermission` flags PDFBox exposes
      (document assembly and annotation-modification stay restricted —
      narrower permissions with little real end-user demand, not exposed).
    - **Edit PDF Metadata now shows the file's current values** instead of
      starting blank, via a client-side `pdfjs-dist` metadata read (no new
      backend endpoint — this is a pure read, so it never needs to leave the
      browser). This is what makes "leave blank to clear that field" a safe,
      intentional action instead of the footgun the original version's
      design note (item 13, above) explains — the user can now see exactly
      what they're changing or erasing. The submit guard changed to match:
      it now blocks only when nothing differs from the loaded snapshot
      (true no-op), not "all fields are blank" (which is now a legitimate
      request to clear everything the file had). **One disclosed boundary**:
      clearing all four fields at once still round-trips through the
      backend's existing "provide at least one field" guard and gets
      rejected — a narrow edge case, and Sanitize PDF (this same round) is
      the purpose-built tool for a full metadata wipe; revisit only if a
      user actually hits this specific path through Edit Metadata itself.
    - **Found while verifying the above, unrelated to any of it, fixed
      immediately: a malformed/corrupted PDF returned a raw 500 Internal
      Server Error on every tool, not a clean 400.** `PdfFileValidator`
      (`backend/.../service/support/`), the single load chokepoint every
      synchronous service shares, only caught PDFBox's `InvalidPasswordException`
      and let every other `IOException` — e.g. `Loader.loadPDF` failing with
      "Page tree root must be a dictionary" on a file too damaged for even
      its own recovery scan — propagate uncaught to a generic framework
      error page. Reproduced directly (not assumed): a genuinely malformed
      file against the running backend logged exactly that stack trace and
      returned 500. Fixed with the same pattern `PdfUnlockService` already
      uses for a wrong password — catch it at the boundary, rethrow as the
      existing `IllegalArgumentException` the global handler already maps
      to a clean 400. Notably, `PdfRepairService`'s own doc comment already
      *claimed* "every other tool in this codebase already surfaces [this]
      as a clean 400" — that was untrue until this fix; it's true now.
      Covered by a new `PdfFileValidatorTest`.
    - **Edit Bookmarks** — new tool, reads/writes the PDF outline as a flat
      `{page, title}` list rather than a tree editor. Read is a real backend
      round-trip (`POST /bookmarks/read`), not a client-side `pdfjs-dist`
      call like Edit Metadata — bookmark destinations need real resolution
      (`PDOutlineItem.findDestinationPage`) that's meaningfully simpler done
      once, server-side, than reimplemented against pdfjs-dist's own
      destination-ref format. **Disclosed boundary**: existing entries that
      point at a URL/named-destination rather than a page, or that are
      nested under another bookmark, get flattened to a plain top-level page
      link on save — this tool edits one flat list, not the full outline
      tree. Saving an empty list clears any existing outline entirely
      (`setDocumentOutline(null)`, not an empty-but-present one) — that's
      the tool's "remove all bookmarks" path, not a separate feature.
    - **Sanitize PDF** — new tool, four independent removal targets
      (document metadata + XMP, embedded attachments, comment/markup
      annotations, embedded scripts/actions), each pre-checked from a real
      pre-scan (`POST /sanitize/scan`) rather than a blind form. **Two real
      bugs caught by the service's own tests before this shipped, not found
      in review**:
      - `PDDocumentCatalog.getActions()` auto-vivifies a non-null wrapper
        object even when the underlying PDF has no `/AA` entry at all — a
        completely clean, freshly-created PDF was scanning as
        "has embedded scripts." Fixed by checking
        `catalog.getCOSObject().containsKey(COSName.AA)` directly instead of
        the Java wrapper's null-ness.
      - `PDAnnotationFileAttachment` (a page-level "pushpin" attachment) is
        itself a `PDAnnotationMarkup` subclass. The first version's removal
        logic let "remove annotations/comments" alone delete a page's file
        attachment even with "remove attachments" left unchecked — silently
        broader than what the two checkboxes independently promised. Fixed
        by explicitly excluding `PDAnnotationFileAttachment` from the
        annotations-removal branch; it's now only ever touched by the
        attachments checkbox, matching what a user unchecking one and not
        the other would actually expect.
      Attachment removal covers both storage locations that actually exist
      in a PDF, confirmed via a fixture that has both: the document-level
      `/EmbeddedFiles` name tree *and* a page-level `PDAnnotationFileAttachment`
      — a sanitizer that only cleared one and called itself done would ship
      a false sense of "removed," which is the one failure mode that matters
      for a tool whose entire purpose is removing hidden data.
    - **Header & Footer** — new tool, 6 independent zones (top/bottom x
      left/center/right), each None/Custom-text/Page-number/Date/Bates.
      Same append-mode content-stream + margin-from-`MediaBox` technique as
      `PdfPageNumberService`, just applied to a full grid instead of 3 fixed
      positions. **Deliberately coexists with the existing Page Numbers
      tool** rather than replacing it — same reasoning that already
      justified Rotate PDF existing separately from Organize Pages' granular
      rotate: a focused tool serves the "just add page numbers" search
      intent better than a 6-zone form does; this tool is for compound
      layouts a simple page-number stamp can't express (a Bates-stamped
      legal document with a date in one corner and a confidentiality notice
      in another, for example). Page-number zones here always start at 1 —
      no custom start-at like the dedicated tool has; if that's what's
      needed, use Add Page Numbers instead. Verified per-zone independently
      (text/page-number/date/Bates each checked alone), together on one page
      (all 6 zones at once, confirmed none clobber each other), and the
      Bates zone's prefix+padding+increment checked across multiple pages.
    - **Organize Pages gained blank-page and second-file page inserts** —
      no new tool page, an extension of the existing one. `PageOp` gained a
      `Kind{SOURCE, SOURCE2, BLANK}` discriminator (was implicitly
      SOURCE-only); `organize()` takes an optional second `file2` part,
      copying the same optional-`@RequestPart` pattern `/sign` already uses
      for `signatureImage`. The frontend's reorder/rotate/exclude logic
      needed no changes at all — it was already keyed entirely off a
      client-generated `id`, never `sourceIndex`, confirmed by reading the
      code before assuming it — so blank placeholders and a second file's
      thumbnails drop into the same `@dnd-kit` `SortableContext` for free.
      **One real gap caught before shipping, not after**: a `BLANK` op has
      no source page to size itself from, and PDFBox's no-arg `new PDPage()`
      defaults to US Letter — silently wrong for an all-A4 or custom-size
      document. Fixed by deriving the blank page's `MediaBox` from the
      nearest neighboring `SOURCE`/`SOURCE2` op in the same plan (previous,
      else next, else A4 fallback), bounds-safe against a neighbor whose own
      index hasn't been validated yet. Verified end-to-end with a real
      browser round trip, not just unit tests: uploaded a 3-page fixture,
      rotated page 1 90°, inserted a blank page, opened a second PDF and
      inserted one of its pages, submitted, then re-verified the actual
      downloaded bytes with a PDFBox-based structural check (not just
      HTTP 200) — 5 pages, page 1 `rotation=90`, the blank page genuinely
      empty (`text=""`) *and* correctly sized `200x200` inherited from its
      neighbors rather than falling back to A4, and the second-file page
      carrying its own real text content.

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
