# UtilFoundry Developer Tools

A privacy-first developer toolbox built with Next.js, React, and TypeScript. Tool processing runs in the browser; no input is uploaded by the application.

## Included tools

70 tools are included across the Phase 1 and Phase 2 roadmap, including a payments/protocol diagnostics set and enterprise API/security diagnostics:

- JSON formatting, validation, minification, JSONPath extraction, and diffing
- XML/YAML formatting and validation, Base64, URL encoding, and HTML entities
- JWT inspection/signing, hashing, UUIDs, password generation, PEM metadata
- Regex testing/visualization, Markdown, text diff, whitespace, sorting, deduplication
- Unix/ISO/timezone conversion, URL/query parsing, cURL and API request builders
- JavaScript/TypeScript/CSS/HTML formatting, CSV viewing/conversion
- HTTP status/MIME lookup, OpenAPI viewing/validation, JSON Schema validation
- SQL, GraphQL, cron, Docker Compose, `.gitignore`, Nginx, webhook, QR, image Base64, semantic versions, and environment formatting
- Hex, binary/bitfields, BCD, IBM037 EBCDIC, ISO 8583 bitmap/message inspection, EMV TLV, Luhn/PAN masking, and masked Track 2 parsing
- OpenAPI breaking-change diffing, JSON Schema generation, JWT RS256/JWK verification, log secret redaction, protobuf wire decoding, ASN.1 DER inspection, and guarded regex testing
- Explicit local workspace save/export/import is available from the workbench; no workspace is persisted unless the user chooses it.

The processors use maintained parsers rather than string placeholders: Prettier for browser code formatting, Papa Parse for quoted CSV, GraphQL's AST printer, SQL Formatter, Marked plus DOMPurify for sanitized Markdown, JSONPath Plus, regexpp, Ajv for JSON Schema, and an OpenAPI schema validator for OpenAPI 2/3 documents. Payment tools are intentionally generic and local-only. ISO 8583 field definitions and Visa/Mastercard network profiles vary by acquirer, issuer, region, and certification environment; the app does not claim to validate a proprietary scheme profile.

Production boundary: the app is suitable for local developer workflows and masked payment test vectors. It is not a card-network certification harness, HSM, PIN/CVV processor, or remote API client. Add versioned acquirer/network profiles and approved test vectors before using the ISO/EMV tools in a regulated certification process.

## Pages and URLs

Every tool has its own page, prerendered at build time: `/json-formatter`, `/jwt-decoder`, `/emv-tlv-parser` and so on, each with its own title, description and canonical URL. `/` redirects to the first tool, and older links of the `?tool=<id>` form redirect to the matching page, so saved links keep working.

The catalog lives in `lib/tools.ts` (what each tool is) and `lib/tool-content.ts` (the words around it); `lib/run-tool.ts` holds one handler per tool id, which is what the workbench and the catalog test both read.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), which redirects to the first tool.

## Production checks

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run start
```

The build script uses Next's Webpack production compiler for a stable browser bundle with the current parser dependency graph.
The Playwright suite opens every catalog tool, exercises representative modes, checks deep links and sensitive-input warnings, and runs an Axe accessibility scan. CI additionally runs representative workflows against Chromium, Firefox, and WebKit.

See [`docs/release-readiness.md`](docs/release-readiness.md) for the enterprise release boundary and deployment checklist.

The app is a static-friendly Next.js App Router application and can be deployed to Vercel, a Node container, or any platform that supports Next.js 16.
