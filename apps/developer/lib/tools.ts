/**
 * The tool catalog. Plain data so server components can read it: the lucide icon for
 * each tool lives in components/ui/ToolIcon.tsx, keyed by the same id.
 *
 * `id` is the runtime key the workbench switches on, and is kept stable because saved
 * workspaces and the old `?tool=` links refer to it. `slug` is the URL, which reads as
 * what the tool is called.
 */

export type ToolCategory =
  | "Format & validate"
  | "JSON"
  | "Encode & decode"
  | "Encoding"
  | "Converters"
  | "Text"
  | "Code"
  | "Web"
  | "API"
  | "Security"
  | "Payments"
  | "Generators"
  | "Time"
  | "Data";

export type ToolAccent =
  | "violet" | "blue" | "cyan" | "amber" | "rose" | "green"
  | "orange" | "indigo" | "slate" | "teal" | "pink" | "lime";

export type ToolDefinition = {
  /** Stable runtime key the workbench switches on. */
  id: string;
  /** URL segment, e.g. /json-formatter. */
  slug: string;
  /** Page H1 and sidebar label. */
  name: string;
  /** One-line sidebar caption and card copy. */
  tagline: string;
  /** Sentence under the H1, also the page description for search engines. */
  description: string;
  category: ToolCategory;
  accent: ToolAccent;
  /** Label above the input pane, e.g. "JSON". */
  inputLabel: string;
  /**
   * A format the tool expects that the input box cannot show on its own — the
   * two-document tools, and anything with a limitation worth stating up front.
   * Shown above the input, so it is read before the run rather than after it fails.
   */
  inputHint?: string;
};

export const TOOLS: ToolDefinition[] = [
  { id: "json", slug: "json-formatter", name: "JSON Formatter", tagline: "Format, validate and minify JSON", description: "Format, validate and minify JSON in your browser, with clear error messages when the JSON is invalid.", category: "Format & validate", accent: "violet", inputLabel: "JSON" },
  { id: "base64", slug: "base64-encoder", name: "Base64 Encoder", tagline: "Encode and decode text privately", description: "Encode text to Base64 or decode it back, handling UTF-8 characters correctly and without sending anything to a server.", category: "Encode & decode", accent: "blue", inputLabel: "Text" },
  { id: "url", slug: "url-encoder", name: "URL Encoder", tagline: "Safely encode URL components", description: "Percent-encode a value for use in a URL, or decode one you already have, using the browser's own encoder.", category: "Encode & decode", accent: "cyan", inputLabel: "Text" },
  { id: "jwt", slug: "jwt-decoder", name: "JWT Decoder", tagline: "Inspect a token locally", description: "Read the header and payload of a JSON Web Token without verifying or transmitting it. The token never leaves this tab.", category: "Security", accent: "amber", inputLabel: "Token" },
  { id: "hash", slug: "hash-generator", name: "Hash Generator", tagline: "Create SHA-2 and SHA-1 hashes", description: "Produce a SHA-256, SHA-384, SHA-512 or SHA-1 digest of any text using the browser's Web Crypto implementation.", category: "Security", accent: "rose", inputLabel: "Text" },
  { id: "uuid", slug: "uuid-generator", name: "UUID Generator", tagline: "Generate cryptographically strong UUIDs", description: "Generate a version 4 UUID from the browser's cryptographic random source, one press at a time.", category: "Generators", accent: "green", inputLabel: "Not needed" },
  { id: "timestamp", slug: "unix-timestamp-converter", name: "Unix Timestamp", tagline: "Convert dates and timestamps", description: "Convert between Unix seconds, milliseconds and ISO 8601. Leave the field empty to read the current time.", category: "Converters", accent: "orange", inputLabel: "Date or timestamp" },
  { id: "regex", slug: "regex-tester", name: "Regex Tester", tagline: "Test patterns with live matches", description: "Run a regular expression over sample text and list every match with its position and capture groups.", category: "Text", accent: "indigo", inputLabel: "Text" },
  { id: "markdown", slug: "markdown-preview", name: "Markdown Preview", tagline: "Write and preview Markdown", description: "Render Markdown to sanitised HTML and preview it beside the source.", category: "Text", accent: "slate", inputLabel: "Markdown" },
  { id: "yaml", slug: "yaml-to-json", name: "YAML ↔ JSON", tagline: "Convert configuration formats", description: "Convert YAML to JSON or JSON back to YAML, so configuration can move between tools that disagree on format.", category: "Format & validate", accent: "teal", inputLabel: "YAML or JSON" },
  { id: "curl", slug: "curl-builder", name: "cURL Builder", tagline: "Build requests from method and headers", description: "Turn a small JSON description of a request into a cURL command you can paste into a terminal.", category: "Web", accent: "pink", inputLabel: "Request JSON" },
  { id: "diff", slug: "text-diff", name: "Text Diff", tagline: "Compare two text snippets", description: "Compare two snippets side by side and see which lines were added or removed.", category: "Text", accent: "lime", inputLabel: "Two snippets" },
  { id: "xml", slug: "xml-formatter", name: "XML Formatter", tagline: "Format and inspect XML documents", description: "Re-indent an XML document so its structure is readable, and report where it is malformed.", category: "Format & validate", accent: "blue", inputLabel: "XML" },
  { id: "csv", slug: "csv-to-json", name: "CSV ↔ JSON", tagline: "Convert tabular data instantly", description: "Convert CSV rows into JSON objects or turn an array of objects back into CSV, with quoting handled for you.", category: "Converters", accent: "green", inputLabel: "CSV or JSON" },
  { id: "html", slug: "html-escape", name: "HTML Escape", tagline: "Escape or unescape HTML entities", description: "Escape characters that would otherwise be read as markup, or turn entities back into the characters they stand for.", category: "Encode & decode", accent: "orange", inputLabel: "HTML or text" },
  { id: "sql", slug: "sql-formatter", name: "SQL Formatter", tagline: "Make SQL readable and consistent", description: "Re-indent a SQL statement with consistent keyword casing so a long query can be read at a glance.", category: "Format & validate", accent: "indigo", inputLabel: "SQL" },
  { id: "graphql", slug: "graphql-formatter", name: "GraphQL Formatter", tagline: "Format queries and mutations", description: "Parse and re-print a GraphQL document with standard indentation, reporting syntax errors by position.", category: "Web", accent: "pink", inputLabel: "GraphQL" },
  { id: "query", slug: "query-string-parser", name: "Query String Parser", tagline: "Parse and build URL parameters", description: "Split a URL or query string into its parameters, or build a query string from a JSON object.", category: "Web", accent: "cyan", inputLabel: "URL or JSON" },
  { id: "number", slug: "base-converter", name: "Base Converter", tagline: "Convert binary, decimal and hex", description: "Convert a number between binary, octal, decimal and hexadecimal, starting from whichever base it is written in.", category: "Converters", accent: "violet", inputLabel: "Number" },
  { id: "color", slug: "color-converter", name: "Color Converter", tagline: "Convert HEX, RGB and HSL", description: "Convert a colour between HEX, RGB and HSL notation and see all three at once.", category: "Converters", accent: "rose", inputLabel: "Colour" },
  { id: "status", slug: "http-status-codes", name: "HTTP Status Codes", tagline: "Look up HTTP meanings quickly", description: "Look up what an HTTP status code means and when a server is expected to send it.", category: "Web", accent: "slate", inputLabel: "Status code" },
  { id: "cron", slug: "cron-explainer", name: "Cron Explainer", tagline: "Explain five-field cron schedules", description: "Translate a five-field cron expression into a sentence and list the next times it fires.", category: "Generators", accent: "teal", inputLabel: "Cron expression" },
  { id: "json-validator", slug: "json-validator", name: "JSON Validator", tagline: "Validate JSON and inspect its type", description: "Check whether a document is valid JSON and report its top-level type, key count and depth.", category: "Format & validate", accent: "violet", inputLabel: "JSON" },
  { id: "json-minifier", slug: "json-minifier", name: "JSON Minifier", tagline: "Minify JSON for transport", description: "Strip whitespace from a JSON document so it travels as few bytes as possible.", category: "Format & validate", accent: "blue", inputLabel: "JSON" },
  { id: "jsonpath", slug: "jsonpath-extractor", name: "JSONPath Extractor", tagline: "Extract nested values with JSONPath", description: "Pull values out of a JSON document with a JSONPath expression instead of reading it by hand.", category: "JSON", accent: "cyan", inputLabel: "JSON", inputHint: "Paths like $.user.name and $..id work, and so do filters such as $.users[?(@.age > 18)].name. Filters run in a sandboxed evaluator that can read your document and nothing else." },
  { id: "json-diff", slug: "json-diff", name: "JSON Diff", tagline: "Compare two JSON documents", description: "Compare two JSON documents and list the fields that were added, removed or changed, by path.", category: "JSON", accent: "indigo", inputLabel: "Two JSON documents" },
  { id: "xml-validator", slug: "xml-validator", name: "XML Validator", tagline: "Validate XML syntax locally", description: "Check an XML document for well-formedness and report the first error with its location.", category: "Format & validate", accent: "blue", inputLabel: "XML" },
  { id: "yaml-formatter", slug: "yaml-formatter", name: "YAML Formatter", tagline: "Normalize YAML configuration", description: "Re-emit a YAML document with consistent indentation and key order preserved.", category: "Format & validate", accent: "teal", inputLabel: "YAML", inputHint: "Comments are not carried into the formatted output, so keep a copy of any you need." },
  { id: "password", slug: "password-generator", name: "Password Generator", tagline: "Generate strong passwords locally", description: "Generate a random password of the length you choose from the browser's cryptographic random source.", category: "Security", accent: "rose", inputLabel: "Not needed" },
  { id: "whitespace", slug: "whitespace-cleaner", name: "Whitespace Cleaner", tagline: "Normalize spaces and blank lines", description: "Collapse repeated spaces, trim line ends and reduce runs of blank lines to one.", category: "Text", accent: "slate", inputLabel: "Text" },
  { id: "line-sort", slug: "line-sorter", name: "Line Sorter", tagline: "Sort lines naturally or alphabetically", description: "Sort lines using natural ordering, so item2 comes before item10.", category: "Text", accent: "orange", inputLabel: "Lines" },
  { id: "line-dedupe", slug: "line-deduplicator", name: "Line Deduplicator", tagline: "Remove duplicate lines", description: "Remove repeated lines while keeping the first occurrence in its original position.", category: "Text", accent: "green", inputLabel: "Lines" },
  { id: "iso-date", slug: "iso-date-converter", name: "ISO Date Converter", tagline: "Convert dates to ISO 8601", description: "Turn a date written in almost any common form into an ISO 8601 timestamp in UTC.", category: "Time", accent: "orange", inputLabel: "Date" },
  { id: "timezone", slug: "timezone-converter", name: "Timezone Converter", tagline: "Render a date in any timezone", description: "Show what a moment in time reads as in another IANA timezone, daylight saving included.", category: "Time", accent: "amber", inputLabel: "Date" },
  { id: "url-parser", slug: "url-parser", name: "URL Parser", tagline: "Inspect every URL component", description: "Break a URL into protocol, host, port, path, query and fragment, with each parameter listed.", category: "Web", accent: "cyan", inputLabel: "URL" },
  { id: "code-formatter", slug: "code-formatter", name: "Code Formatter", tagline: "Format JSON, HTML, CSS and JS", description: "Format JavaScript, TypeScript, JSON, CSS or HTML with Prettier, running entirely in this tab.", category: "Code", accent: "indigo", inputLabel: "Source" },
  { id: "csv-viewer", slug: "csv-viewer", name: "CSV Viewer", tagline: "Inspect rows and columns quickly", description: "Summarise a CSV file: its columns, row count and the first rows, without opening a spreadsheet.", category: "Data", accent: "green", inputLabel: "CSV" },
  { id: "mime", slug: "mime-type-lookup", name: "MIME Type Lookup", tagline: "Find a file's content type", description: "Look up the MIME type for a file extension, or the extensions a MIME type covers.", category: "API", accent: "slate", inputLabel: "Extension or type" },
  { id: "openapi-viewer", slug: "openapi-viewer", name: "OpenAPI Viewer", tagline: "Summarize endpoints and metadata", description: "Summarise an OpenAPI document: its title, version and every path with the methods it accepts.", category: "API", accent: "pink", inputLabel: "OpenAPI JSON" },
  { id: "openapi-validator", slug: "openapi-validator", name: "OpenAPI Validator", tagline: "Check required OpenAPI fields", description: "Validate an OpenAPI document against the specification's schema and list what is missing or wrong.", category: "API", accent: "pink", inputLabel: "OpenAPI JSON" },
  { id: "json-schema", slug: "json-schema-validator", name: "JSON Schema Validator", tagline: "Validate JSON against a schema", description: "Validate a JSON document against a JSON Schema, with each failure reported by the path that broke it.", category: "Format & validate", accent: "violet", inputLabel: "Data and schema" },
  { id: "regex-visualizer", slug: "regex-visualizer", name: "Regex Visualizer", tagline: "Break a pattern into readable tokens", description: "Explain a regular expression token by token, so a dense pattern can be read in order.", category: "Text", accent: "indigo", inputLabel: "Pattern" },
  { id: "docker-compose", slug: "docker-compose-validator", name: "Docker Compose Validator", tagline: "Inspect services in a Compose file", description: "Parse a Compose file and list its services, images, ports and volumes, flagging entries that cannot be read.", category: "Code", accent: "blue", inputLabel: "Compose YAML" },
  { id: "gitignore", slug: "gitignore-generator", name: ".gitignore Generator", tagline: "Generate starter ignore rules", description: "Build a .gitignore from a list of stacks, such as Node, Python or macOS.", category: "Code", accent: "slate", inputLabel: "Stacks", inputHint: "Separate stacks with commas. Known: Node, Python, Java, Go, Rust, Ruby, PHP, DotNet, Terraform, macOS, Windows, Linux, VSCode, JetBrains." },
  { id: "nginx", slug: "nginx-formatter", name: "Nginx Formatter", tagline: "Format Nginx configuration", description: "Re-indent an Nginx configuration so its blocks and directives line up.", category: "Code", accent: "green", inputLabel: "Config" },
  { id: "jwt-sign", slug: "jwt-hmac-signer", name: "JWT HMAC Signer", tagline: "Sign and verify HS256 tokens locally", description: "Sign a payload as an HS256 token, or verify one, using a secret that stays in this tab.", category: "Security", accent: "amber", inputLabel: "Payload or token" },
  { id: "cert", slug: "certificate-decoder", name: "Certificate Decoder", tagline: "Inspect PEM certificate metadata", description: "Read the block type, byte length and structure of a PEM certificate without uploading it.", category: "Security", accent: "rose", inputLabel: "PEM" },
  { id: "pem", slug: "pem-inspector", name: "PEM Inspector", tagline: "Identify PEM block types and size", description: "Identify what a PEM block holds — a key, a certificate or a request — and how large it is.", category: "Security", accent: "rose", inputLabel: "PEM" },
  { id: "webhook", slug: "webhook-formatter", name: "Webhook Formatter", tagline: "Pretty-print webhook payloads", description: "Pretty-print a webhook payload and surface the event name and identifiers at the top.", category: "Web", accent: "pink", inputLabel: "Payload JSON" },
  { id: "api-request", slug: "api-request-builder", name: "API Request Builder", tagline: "Create fetch and cURL requests", description: "Turn a JSON description of a request into both a fetch() call and a cURL command.", category: "Web", accent: "cyan", inputLabel: "Request JSON" },
  { id: "image-base64", slug: "image-to-base64", name: "Image to Base64", tagline: "Inspect an image data URL locally", description: "Read an image into a data URL and report its type and size. The file is read in this tab only.", category: "Converters", accent: "orange", inputLabel: "Data URL" },
  { id: "qr", slug: "qr-generator", name: "QR Generator", tagline: "Generate a QR image locally", description: "Generate a QR code as a PNG data URL you can download, rendered in the browser.", category: "Generators", accent: "violet", inputLabel: "Text or URL" },
  { id: "semver", slug: "version-comparator", name: "Version Comparator", tagline: "Compare semantic versions", description: "Compare two semantic versions and say which is newer, including prerelease ordering.", category: "Generators", accent: "lime", inputLabel: "Two versions" },
  { id: "env", slug: "env-formatter", name: "Environment Formatter", tagline: "Normalize and sort env variables", description: "Sort and tidy a .env file: trim the spaces around each =, drop comments and blank lines, and flag keys defined more than once.", category: "Code", accent: "teal", inputLabel: "Env file" },
  { id: "openapi-diff", slug: "openapi-diff", name: "OpenAPI Diff", tagline: "Detect potentially breaking API changes", description: "Compare two OpenAPI documents and flag removed paths, methods and responses that may break clients.", category: "API", accent: "pink", inputLabel: "Two documents" },
  { id: "json-schema-generator", slug: "json-schema-generator", name: "JSON Schema Generator", tagline: "Generate a draft schema from JSON", description: "Infer a draft JSON Schema from an example document, as a starting point to edit.", category: "JSON", accent: "violet", inputLabel: "JSON" },
  { id: "jwt-rsa", slug: "jwt-rs256-verifier", name: "JWT RS256 Verifier", tagline: "Verify JWTs with a local JWK", description: "Verify an RS256 token against a JWK you paste, using Web Crypto in this tab.", category: "Security", accent: "amber", inputLabel: "Token and JWK" },
  { id: "log-redactor", slug: "log-secret-redactor", name: "Log Secret Redactor", tagline: "Remove common secrets from logs", description: "Mask bearer tokens, API keys and email addresses in a log excerpt before you share it.", category: "Security", accent: "rose", inputLabel: "Log text" },
  { id: "protobuf", slug: "protobuf-decoder", name: "Protobuf Wire Decoder", tagline: "Inspect protobuf bytes without a schema", description: "Decode protobuf wire format into field numbers, wire types and values, with no .proto file needed.", category: "Encoding", accent: "blue", inputLabel: "Hex bytes" },
  { id: "asn1", slug: "asn1-der-inspector", name: "ASN.1 DER Inspector", tagline: "Inspect DER TLV structure locally", description: "Walk the tag-length-value structure of a DER encoded blob and show how it nests.", category: "Encoding", accent: "orange", inputLabel: "Hex bytes" },
  { id: "regex-safe", slug: "safe-regex-tester", name: "Safe Regex Tester", tagline: "Test patterns with abuse safeguards", description: "Test a pattern with a step limit, so one that backtracks catastrophically is stopped rather than freezing the tab.", category: "Text", accent: "indigo", inputLabel: "Text" },
  { id: "hex", slug: "hex-encoder", name: "Hex Encoder / Decoder", tagline: "Convert text and protocol hexadecimal bytes", description: "Convert text to hexadecimal bytes or read hex back as text, in the spacing protocol dumps use.", category: "Payments", accent: "blue", inputLabel: "Text or hex" },
  { id: "binary", slug: "binary-bitfield", name: "Binary / Bitfield", tagline: "Inspect binary values and bits", description: "Convert between hexadecimal and binary and see which bits in a field are set.", category: "Encoding", accent: "indigo", inputLabel: "Hex or binary" },
  { id: "bcd", slug: "bcd-encoder", name: "BCD Encoder / Decoder", tagline: "Pack and unpack numeric BCD", description: "Pack digits into binary-coded decimal or unpack BCD bytes back into digits.", category: "Payments", accent: "amber", inputLabel: "Digits or BCD" },
  { id: "ebcdic", slug: "ebcdic-decoder", name: "EBCDIC Decoder", tagline: "Decode common host bytes locally", description: "Decode EBCDIC bytes from a mainframe trace into readable text.", category: "Payments", accent: "teal", inputLabel: "Hex bytes" },
  { id: "iso-bitmap", slug: "iso-8583-bitmap", name: "ISO 8583 Bitmap", tagline: "Show enabled data elements", description: "Expand an ISO 8583 primary or secondary bitmap into the list of data elements it enables.", category: "Payments", accent: "violet", inputLabel: "Bitmap hex" },
  { id: "iso8583", slug: "iso-8583-inspector", name: "ISO 8583 Inspector", tagline: "Inspect MTI, bitmap and fields", description: "Read an ISO 8583 message: its MTI, bitmap and each present field. Use masked test data only.", category: "Payments", accent: "pink", inputLabel: "Message" },
  { id: "emv-tlv", slug: "emv-tlv-parser", name: "EMV TLV Parser", tagline: "Parse BER-TLV payment tags", description: "Parse BER-TLV data from an EMV transaction into tags, lengths and values, nested tags included.", category: "Payments", accent: "orange", inputLabel: "TLV hex" },
  { id: "luhn", slug: "luhn-pan-check", name: "Luhn / PAN Check", tagline: "Validate and mask account numbers", description: "Check an account number against the Luhn algorithm and show it masked. Use test numbers only.", category: "Payments", accent: "rose", inputLabel: "Number" },
  { id: "track2", slug: "track-2-inspector", name: "Track 2 Inspector", tagline: "Parse masked Track 2 data", description: "Split Track 2 data into its PAN, expiry and service code. Use masked test data only.", category: "Payments", accent: "rose", inputLabel: "Track 2" }
];

/** Sidebar order: the everyday formats first, the specialist sets last. */
export const CATEGORY_ORDER: ToolCategory[] = [
  "Format & validate",
  "JSON",
  "Encode & decode",
  "Encoding",
  "Converters",
  "Text",
  "Code",
  "Web",
  "API",
  "Security",
  "Payments",
  "Generators",
  "Time",
  "Data"
];

export const DEFAULT_TOOL = "json-formatter";

const BY_SLUG = new Map(TOOLS.map((tool) => [tool.slug, tool]));
const BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function getTool(slug: string) {
  return BY_SLUG.get(slug);
}

export function getToolById(id: string) {
  return BY_ID.get(id);
}
