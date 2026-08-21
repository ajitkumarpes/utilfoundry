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
14. Round 2 (complete, all 7 stages shipped) — Edit Bookmarks, Sanitize PDF,
    Header & Footer, Text/Markdown/HTML to PDF, plus Split even/odd pages,
    Lock PDF extra permission toggles, and Organize Pages gaining blank-page
    and second-file page inserts. Staged, each stage independently built,
    tested, and committed. Followed by a gap-sweep pass (see the last
    sub-bullet below) that added Extract Links, Extract Attachments,
    Duplicate Pages, a Sanitize PDF "remove links" checkbox, and — one turn
    later, correcting this document's own first-pass exclusions and shipped
    after explicit user sign-off on the Extract Fonts licensing question —
    Flatten PDF and Extract Fonts.
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
    - **Text to PDF** — new tool, paste or upload plain text (`.txt`, read
      client-side, no separate backend file-upload path needed), choose
      A4/Letter. Explicit newlines are preserved as real line breaks (this is
      a plain-text tool — code, logs, poems — not a paragraph reflow like
      Markdown to PDF will be); any line too wide for the page word-wraps,
      and a single unbroken token wider than the page (a long URL, for
      example) is hard-broken character by character rather than left to
      overflow. Per-character font resolution, verified empirically against
      real PDFBox behaviour rather than assumed: Devanagari uses the bundled
      Devanagari font; everything else tries Standard14 Courier first (a
      genuinely monospaced, zero-dependency font — WinAnsiEncoding, which a
      probe confirmed covers plain ASCII *and* common paste artifacts like
      curly quotes/em-dash/€/•, not just 7-bit ASCII) so plain text and
      pasted code keep aligned columns; anything Courier can't encode falls
      back to the bundled NotoSans Unicode font; anything neither font can
      encode (confirmed by probe to throw `IllegalArgumentException`, not
      silently mis-render — e.g. CJK, emoji) is substituted with `?` rather
      than failing the whole document. Two abuse-shaped caps, both because a
      "paste arbitrary text" tool has no natural size limit otherwise: text
      over 500,000 characters is rejected outright, and — separately, since
      a low-density input like thousands of blank lines stays well under
      that character cap while still exploding into an enormous page count —
      generation itself aborts cleanly past 500 pages rather than silently
      producing a multi-thousand-page file.
      **Found while building this, not by this tool — a real, pre-existing
      bug in the already-shipped Watermark tool, reproduced and confirmed
      with evidence, not assumed:** Devanagari conjuncts (a consonant +
      virama + consonant sequence, e.g. "स्व" in "स्वीट") **render correctly**
      — confirmed by rasterizing the actual PDF page to an image and visually
      inspecting it — but PDFBox's auto-generated ToUnicode CMap does not
      correctly reverse-map the ligature glyph it substitutes in for the
      sequence, so *extracting* that text (copy-paste, search, screen
      readers) returns an unrelated character instead: "स्व" extracts as
      "×व", "क्ष" (a common conjunct) extracts as "³". Isolated character by
      character to confirm it's specifically conjunct/ligature formation, not
      Devanagari in general — plain non-conjunct Devanagari ("कमरा") round-
      trips through extraction correctly, both here and in Watermark.
      **Not fixed here — genuinely does need infrastructure this codebase
      doesn't have**: PDFBox exposes no public API to override or supply a
      ToUnicode CMap per span (checked via `javap` against the actual jar,
      not assumed), so a real fix needs either a text-shaping library
      (HarfBuzz/ICU4J-class, to shape text ourselves and track original
      codepoints through ligature substitution) or hand-written low-level
      CMap construction — both open-ended builds, not a cheap fix. Captured
      as a characterization test
      (`devanagariConjunctsRenderCorrectlyButToUnicodeExtractionIsAKnownLimitation`
      in `PdfTextToPdfServiceTest`) that will fail (prompting a re-look) if
      PDFBox's own ToUnicode generation ever improves. **Revisit trigger**:
      a user reports broken copy-paste/search of Devanagari text with
      conjuncts, or before shipping a feature whose value depends on
      Devanagari text-extraction fidelity specifically (e.g. a "searchable
      Hindi PDF" claim) — Markdown to PDF (next in this round) inherits the
      same limitation for the same reason and doesn't need to re-solve it
      first, since it's a display/print tool too, not an extraction one.
    - **Markdown to PDF** — new tool, new dependency
      (`org.commonmark:commonmark:0.30.0`, BSD-2-Clause) plus 3 new bundled
      fonts (`NotoSans-Bold.ttf`, `NotoSans-Italic.ttf`,
      `NotoSansDevanagari-Bold.ttf`, sourced from the same `notofonts`
      GitHub org's current monthly release, downloaded only after explicit
      user sign-off with filenames/source/sizes stated up front). No layout
      engine existed anywhere in this repo before this — commonmark parses
      to an AST, a custom `AbstractVisitor` walks it into a flat internal
      `Block` list (heading/paragraph/list-item/code-block/rule, each
      carrying styled inline runs), and a renderer word-wraps and paginates
      that list, reusing Text to PDF's proven per-character font-resolution
      and greedy-token-wrap algorithm, generalized from "one font" to a
      12-way matrix: Devanagari (Regular/Bold — no italic form) × Standard14
      Helvetica (Regular/Bold/Oblique/BoldOblique, tried first for anything
      WinAnsi-safe) × NotoSans Unicode fallback (Regular/Bold/Italic — no
      bundled BoldItalic; bold wins when both are requested, a disclosed,
      minor simplification) × Courier for code spans/blocks (always
      monospace regardless of surrounding emphasis, with its own
      Noto-then-`?` fallback chain for non-Latin text pasted into a code
      span). Verified against the real commonmark-java jar before writing
      the visitor, not assumed: confirmed via a throwaway probe that
      `ListItem` children are always wrapped in `Paragraph` nodes regardless
      of the list's tight/loose-ness, that blockquotes and fenced/indented
      code blocks carry a trailing `\n` in their literal, and that
      `HardLineBreak`/`SoftLineBreak` are separate sibling nodes rather than
      embedded in adjacent `Text` literals. Links only become a clickable
      `PDAnnotationLink`+`PDActionURI` for `http(s)://`/`mailto:` — anything
      else (`javascript:`, `data:`, relative paths meaningless outside the
      source document) is dropped rather than embedded, since a generated
      PDF should never carry an executable/data URI a reader could be
      tricked into invoking; covered by a test that a `javascript:` link
      renders as plain text with no annotation. Same two abuse-shaped caps
      as Text to PDF (500,000 characters; abort past 500 pages), since
      Markdown has the identical "arbitrary pasted content, no natural size
      limit" shape.
      **Two real bugs found by actually rendering the output to an image and
      looking at it, not by unit tests alone** (unit tests only assert text
      *content* survived extraction — they can't catch a purely geometric
      layout bug, which is exactly what these were):
      - **Severe line overlap between consecutive short blocks** — headings
        stacked on top of each other, list items piled up nearly unreadable.
        Root cause: the gap-before-a-new-block step only subtracted the
        block's extra breathing-room constant (e.g. 5–15pt), never a full
        line-height step first — fine for a multi-line paragraph, whose own
        internal line-wrapping already consumes real vertical space, but
        badly wrong for single-line blocks (headings, most list items) that
        never get that internal step. Fixed by making every block consume
        one full `leading` step *plus* its extra gap before drawing,
        mirroring how continuation lines inside a block already correctly
        do `y -= leading`. Applied consistently to headings/paragraphs/list
        items, code blocks, and rules — verified by re-rendering the same
        fixture and diffing the before/after images, not just re-reading
        the code.
      - **Substituted glyphs were measured correctly but drawn incorrectly**
        — `resolveFontChoice()`'s final `?`-substitution fallback correctly
        *measured* width using `"?"`, but the glyph's actual drawn text was
        reconstructed from the original (unencodable) character at the call
        site, so an unsupported character (CJK, emoji) still reached
        `showText()` unchanged and threw. Caught by a unit test, not
        review — fixed by having the font-resolution result carry the
        *actual text to draw* end to end, matching how Text to PDF already
        did this correctly (a design Markdown's rewrite had accidentally
        narrowed to font+width only).
      **One deliberately-added polish item, not in the original plan
      wording, added because an invisible link is a real usability gap, not
      cosmetic**: link text renders in blue with an underline (`#2563EB`)
      instead of plain body-color text — the plan only specified "rendered
      as text *and* a real `PDAnnotationLink`", which technically ships a
      clickable region with zero visual affordance that it's clickable.
      Cheap to add once runs were already being colored per-style; fixed
      before shipping rather than filed as a follow-up.
      **Verification**: 18 backend tests (headings, bold/italic/code spans,
      bullet/ordered/nested lists, fenced/indented code blocks, blockquotes,
      http vs. non-http links, thematic breaks, mixed Devanagari+Latin,
      multi-page pagination, both page sizes, all four rejection paths,
      glyph substitution) plus three full render-and-look passes against a
      fixture covering every block type at once, using a real PDF renderer
      (not PDFBox's own headless rasterizer, which was independently
      confirmed — by checking the actual font resource dictionary — to
      substitute one generic font for all four Helvetica weights in this
      Docker image specifically, making bold/italic invisible in *that*
      diagnostic tool alone while the PDF itself, and every other viewer,
      renders them correctly).
    - **HTML to PDF — the last, highest-security-sensitivity tool in this
      round, shipped only after its mandatory canary test passed.** New
      dependencies: `io.github.openhtmltopdf:openhtmltopdf-pdfbox:1.1.31`
      (LGPL-2.1-or-later/LGPL-3.0 — this repo's first copyleft dependency,
      used unmodified as a library, the standard safe consumption pattern)
      and `org.jsoup:jsoup:1.23.1` (MIT) for lenient HTML parsing — used
      specifically *instead of* openhtmltopdf's own `withHtmlContent`, which
      is backed by a real JAXP `DocumentBuilder` requiring well-formed XHTML
      and carrying a real XXE surface; jsoup's tokenizer has no DOCTYPE/
      entity-expansion concept at all, so that class of vulnerability is
      avoided by construction, not by remembering to disable a feature flag.
      Deliberately **not** added: `openhtmltopdf-svg-support` (pulls in
      Apache Batik, which has its own SSRF CVE history) — SVG stays
      unsupported, disclosed directly in the tool's UI copy.
      **Security design went through three independent layers, not one,
      after discovering openhtmltopdf exposes a purpose-built API for
      exactly this** (`useExternalResourceAccessControl`, taking a
      `BiPredicate<uri, ExternalResourceType>` — `ExternalResourceType`
      covers FONT/CSS/IMAGE_RASTER/etc uniformly, confirming one predicate
      governs every external-resource class, not just images) — a better,
      more official mechanism than the plan's original single-resolver
      design, found by reading the actual jar via `javap` rather than
      assuming the plan's sketch was the only lever available:
      1. `useExternalResourceAccessControl(..., RUN_BEFORE_RESOLVING_URI)` —
         rejects anything that isn't a `data:` URI before resolution even
         starts.
      2. `useUriResolver` — a second, independent rejection of anything
         that isn't `data:`.
      3. `useProtocolsStreamImplementation` registered for http/https/ftp/
         file — refuses to actually open a connection even if something
         upstream reached the stream-fetch step regardless.
      None of these are trusted alone: the plan's hostile review had flagged
      a documented openhtmltopdf issue
      ([#444](https://github.com/danfickle/openhtmltopdf/issues/444)) where
      a resource-loading path bypassed the configured resolver, which is
      exactly the failure mode three independent layers are meant to
      survive. **Shipped only after the plan's mandatory canary test passed
      with observed evidence, not on code review alone**: a real local
      `com.sun.net.httpserver.HttpServer` listener (no new dependency
      needed) logging every inbound request, with HTML referencing it via
      an `<img src>`, a `<link rel=stylesheet href>`, an `@font-face
      src:url()`, *and* a `javascript:` pseudo-protocol image source —
      confirmed **zero** inbound requests across all four vectors
      (`PdfHtmlServiceSsrfTest`, 2 tests). A `data:`-URI image was
      separately confirmed to still render, proving the allowlist admits
      the one thing it's supposed to, not just that it blocks everything.
      `baseUri` is a fixed `about:blank` constant, never derived from user
      input. Page count enforced post-generation (openhtmltopdf exposes no
      max-page/timeout hook to interrupt mid-layout, unlike this round's two
      hand-rolled renderers) — accepted as a reasonable trade-off since the
      500,000-character input cap already bounds the worst case; revisit
      only if a real abuse pattern is observed in practice.
    - **Gap sweep (after Round 2 shipped)** — challenged directly on whether
      everything from the original ~80-item brainstorm got built. Rather
      than answer from memory, pulled the exact original paste back out of
      the session transcript and checked every item against the actual
      current code (`grep`/reading source), not against what the Round 2
      plan above claimed. Confirmed three items had no on-record decision
      either way — not "already covered," not "excluded with a reason,"
      just never addressed — and were cheap enough to build immediately
      rather than leave open:
      - **Duplicate Pages** — Organize Pages gained a per-thumbnail Duplicate
        action. No backend change: `PdfOrganizeService` already imports
        whatever `sourceIndex` a plan entry names with no uniqueness check,
        confirmed by reading the service before assuming a change was
        needed — duplicating was already possible for any caller building
        the JSON plan directly, just not reachable from the UI.
      - **Remove Links** — Sanitize PDF gained a fifth, independent checkbox
        ("Clickable links") on top of its existing four. `PDAnnotationLink`
        is not a `PDAnnotationMarkup` subclass (unlike the file-attachment
        case above), so it was invisible to the existing "remove
        annotations" checkbox entirely — not a redundant addition. `scan()`
        now reports a `linkCount` alongside the existing four fields, same
        pre-tick-from-real-scan UX as the rest of the tool.
      - **Extract Links / Extract Attachments** — two new tools, both
        following existing precedent exactly (`PdfToTextService`'s
        single-file-out shape for Links, `PdfExtractImagesService`'s
        zip-or-single shape for Attachments — the zip-vs-single response
        plumbing already existed in `PdfController.respondWithFiles`, built
        for Split/PDF-to-Images/Extract-Images, so neither tool needed new
        infrastructure). Extract Links only reports `PDAnnotationLink`
        annotations whose action is `PDActionURI` — disclosed in the tool's
        own copy that a same-document navigation link or plain text that
        merely *looks* like a URL won't appear, since neither is a real
        clickable-link-to-a-URL annotation. Extract Attachments reads both
        storage locations Sanitize already has to write to (the
        document-level `/EmbeddedFiles` name tree and per-page
        `PDAnnotationFileAttachment`), and de-duplicates colliding
        filenames (`data.txt`, `data (2).txt`, ...) before zipping — two
        attachments sharing a name would otherwise throw
        `ZipException: duplicate entry` at response time, not a hypothetical.
      - **Flatten PDF** — a fourth new tool, added one turn after the three
        above, when directly asked "do we need anything extra to build the
        excluded items" and it turned out the answer for this one was no.
        **This corrects the original exclusion write-up in this same
        document**, which reasoned "no Fill-Forms feature exists, so nothing
        to flatten" — too narrow: a PDF with real form field values or
        markup annotations can arrive from *anywhere* (Acrobat, DocuSign,
        a reviewer's comments), not only from a Fill-Forms tool this repo
        doesn't have. Two independent checkboxes, pre-scanned like Sanitize:
        **Form fields**, calling PDFBox's own `PDAcroForm.flatten()` (a
        verified one-call API, confirmed via `javap` before writing a line
        of code); **Comments & markup**, reusing Sanitize's exact
        `PDAnnotationMarkup`-minus-`PDAnnotationFileAttachment` definition
        of "annotations" for consistency across both tools. Annotation
        flattening is hand-rolled (PDFBox has no built-in equivalent to
        `PDAcroForm.flatten()` for non-form annotations) and **deliberately
        conservative**: it only bakes in an annotation whose appearance
        stream has an identity matrix (no rotation/shear/scale baked into
        the appearance itself, the common case for mainstream-tool output);
        anything else is left exactly as-is rather than risk drawing it in
        the wrong place, disclosed directly in the tool's own copy. Verified
        past "no exception thrown": a real fixture with both a filled text
        field and a markup annotation, flattened, then read back with
        `PDFTextStripper` — the field's value and the annotation's baked-in
        content both come back as ordinary extractable page text
        (`PdfFlattenServiceTest`, 6 tests, including one fixture with a
        45-degree-rotated appearance matrix asserting it survives untouched).
      - **Extract Fonts** — a fifth new tool, built the same turn as Flatten
        PDF, once asked directly whether the excluded items needed anything
        extra. Technically easy (`PDFontDescriptor.getFontFile()/
        getFontFile2()/getFontFile3()` hands back the raw embedded font
        bytes directly, confirmed via `javap`, same shape as Extract
        Attachments) — the open question was never engineering cost but a
        licensing risk: most commercial font EULAs permit embedding a font
        for display but forbid extracting the file for reuse elsewhere,
        unlike Extract Images/Text/Attachments, which all hand back content
        the document's own author put there. Put to the user directly, who
        chose **build it, with a disclaimer** over skipping it or the
        stricter subsetted-only variant also on offer. Shipped with the
        disclaimer in the tool's own copy: most PDF-embedded fonts are
        subsets (only the glyphs the document actually uses, not a complete
        font), which the extracted filename discloses rather than hides -
        confirmed for real, not just claimed, when the live server round-trip
        against a genuine embedded NotoSans returned exactly
        `AAAXBC+NotoSans-Regular.ttf`. The same embedded font referenced from
        every page of a document is extracted once, by COS object identity,
        not once per page reference (`PdfExtractFontsServiceTest`, 3 tests,
        including one fixture with the font used across two pages asserting
        a single result).
      One item remains excluded **with a stated reason**, not silently:
      - **Request Signature** (send a PDF to someone else to sign, track
        who has/hasn't signed) — not offered, and not comparable in size to
        anything else in this document. Every tool in this repo, sync and
        async alike, is stateless per-request — the async ones poll a job
        for at most an hour and then it's purged. Request Signature needs
        durable state across days (who's been asked, who's signed, signer
        access links, notify-on-completion) — a different architecture
        class from anything this platform currently runs, not a feature gap
        inside the existing one. Confirmed directly, not assumed: grepped
        `backend/pom.xml`, `frontend/package.json`, and `docker-compose.yml`
        for any existing email-sending capability (SMTP, SendGrid, Resend,
        Mailgun, SES, javamail) — zero hits; the only durable-ish state this
        repo has is the async job queue (Postgres + Redis + MinIO), and even
        that purges job output after at most an hour, per this doc's own
        Architecture section below. Hid inside the brainstorm's "Sign" tier
        rather than its "Forms" tier, which is why it wasn't swept into the
        Forms exclusion the first time around. Put to the user directly, who
        chose to scope this as its own project (email provider selection,
        durable state model, signer-facing flow, all designed before any
        code) rather than skip it outright — **not started**; revisit when
        that planning conversation happens.

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
