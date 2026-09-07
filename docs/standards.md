# Standards and implementation boundaries

## Payment/protocol tools

- **ISO 8583:** The app supports generic MTI/bitmap/field inspection and a documented generic field profile. ISO 8583:2023 defines the common interchange interface, but real acquirer, issuer, network, and scheme profiles can change field definitions and encodings. Never describe the generic inspector as Visa/Mastercard certification tooling.
- **EMV TLV:** The parser handles BER-TLV tag, length, and value framing. Tag meaning and transaction interpretation should be added through versioned EMVCo tag dictionaries, not guessed from a single scheme profile.
- **EBCDIC:** The decoder uses IBM037/CP037, a common host code page. Other host variants (for example IBM500 or IBM1047) need an explicit code-page selector before their bytes can be interpreted correctly.
- **PAN/Track 2:** Only masked test data belongs in this public tool. The UI and output preserve BIN/last-four masking where applicable and never log inputs.
- **Cryptography:** HMAC JWT signing is available only with a user-supplied test secret. PIN blocks, CVVs, production MAC keys, HSM operations, and key management are intentionally out of scope for a browser utility.

## Browser processing

- Prettier runs with explicit parser plugins in the browser; parser plugins are loaded only when the code-formatting tool is used.
- CSV parsing uses Papa Parse so quoted fields, escaped quotes, empty rows, and large-file worker support can be added without replacing the parser.
- JSON Schema validation uses Ajv. Untrusted schemas should be size-limited and eventually moved to a worker or precompiled standalone validators before accepting very large schemas.
- OpenAPI validation uses a browser-compatible OpenAPI 2/3 schema validator after parsing JSON or YAML; it validates the document schema, but does not dereference arbitrary remote `$ref` URLs.
- SQL formatting uses `sql-formatter`, and GraphQL formatting parses and prints the GraphQL AST so malformed documents fail instead of being cosmetically rearranged.
- JSONPath extraction uses JSONPath Plus; regex visualization uses the ECMAScript parser from `regexpp`; Markdown is rendered with Marked and sanitized with DOMPurify before preview.
- Numeric conversion rejects partial parses, color conversion accepts short/full HEX, RGB(A), and HSL(A), and password generation uses rejection sampling to avoid modulo bias.
- PEM inspection validates the complete block and Base64 framing. It intentionally does not export private key material or pretend to replace a full X.509/ASN.1 certificate tool.
- Request generation: cURL and fetch builders validate the URL, method, headers, and shell quoting but only generate text; they never send a request from the browser.

## Source references

- ISO 8583:2023 overview: https://www.iso.org/standard/79451.html
- PCI SSC PAN masking guidance: https://www.pcisecuritystandards.org/faqs/1071/
- Prettier browser API: https://prettier.io/docs/browser
- Papa Parse documentation: https://www.papaparse.com/docs
- Ajv JSON Schema documentation: https://github.com/ajv-validator/ajv/tree/master/docs
