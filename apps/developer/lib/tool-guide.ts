/**
 * The Info panel's words for each tool: why reach for it, what it does, where it helps, and
 * where to go next. Like lib/tool-content.ts, every claim here has to be true of this
 * implementation — a feature listed is a feature the handler in lib/run-tool.ts actually has.
 *
 * The page header already says the tools are free, need no account and run in the browser,
 * so none of that is repeated here: this is what is particular to each tool.
 */

export type UseCaseIcon =
  | "api" | "file" | "data" | "code" | "bug" | "config" | "search" | "shield" | "key" | "card"
  | "clock" | "globe" | "text" | "compare" | "terminal" | "image" | "list" | "mail" | "lock" | "doc";

export type ToolGuide = {
  /** One or two sentences on when this tool earns its place. */
  why: string;
  features: [string, string, string, string];
  uses: Array<[UseCaseIcon, string]>;
  /** Tool ids with the action-phrased label the Result tab shows for them. */
  next: Array<[string, string]>;
  /** Shown in the Result tab; the drag-and-drop hint is used when this is absent. */
  tip?: string;
};

export const GUIDES: Record<string, ToolGuide> = {
  json: {
    why: "Turn a one-line API response or a hand-edited config into readable JSON. Useful for developers, API testing and data processing.",
    features: ["Validate JSON syntax", "Pretty print (human readable)", "Minify JSON (smallest size)", "Jump straight to a syntax error"],
    uses: [["api", "Format API responses"], ["file", "Validate JSON files"], ["data", "Prepare data for development"], ["code", "Minify for production"], ["bug", "Debug JSON errors"]],
    next: [["json-schema", "Validate against a schema"], ["yaml", "Convert to YAML"], ["json-schema-generator", "Generate a JSON Schema"]]
  },
  base64: {
    why: "Read or produce the Base64 that API fields, email parts and config values carry, without a terminal.",
    features: ["Encode text to Base64", "Decode Base64 back to text", "UTF-8 safe for any language", "Accepts URL-safe Base64 too"],
    uses: [["api", "Read encoded API fields"], ["key", "Inspect Basic auth headers"], ["mail", "Decode MIME-encoded text"], ["config", "Embed values in config files"]],
    next: [["url", "URL-encode a value"], ["hex", "View the bytes as hex"], ["jwt", "Decode a JWT"]]
  },
  url: {
    why: "Make a value safe for a query string or path segment when it contains spaces, symbols or non-Latin text — or read one back.",
    features: ["Percent-encode any value", "Decode %XX sequences", "Handles UTF-8 characters", "Uses the browser's own encoder"],
    uses: [["globe", "Build query string values"], ["api", "Debug encoded API parameters"], ["search", "Read tracking links"], ["code", "Escape redirect targets"]],
    next: [["query", "Parse a whole query string"], ["url-parser", "Inspect a full URL"], ["base64", "Base64-encode instead"]]
  },
  jwt: {
    why: "See which claims, roles and expiry a token carries while you debug sign-in, sessions or API access.",
    features: ["Decode header and payload", "Every claim shown as JSON", "Never verifies or sends the token", "Handles UTF-8 claims"],
    uses: [["key", "Debug sign-in and sessions"], ["shield", "Check roles and scopes"], ["clock", "Read exp and iat claims"], ["api", "Inspect tokens from API calls"]],
    next: [["jwt-sign", "Verify an HS256 signature"], ["jwt-rsa", "Verify an RS256 signature"], ["timestamp", "Convert exp and iat times"]],
    tip: "Decoding is not verifying: anyone can read a JWT payload. Use a verifier before trusting one."
  },
  hash: {
    why: "Fingerprint a string to compare values, check integrity or build cache keys — with the same algorithms your servers use.",
    features: ["SHA-256, SHA-384 and SHA-512", "SHA-1 for legacy systems", "Lowercase hex digest", "Computed with Web Crypto"],
    uses: [["shield", "Check content integrity"], ["code", "Generate cache keys"], ["compare", "Compare two strings exactly"], ["key", "Match legacy SHA-1 digests"]],
    next: [["base64", "Base64-encode text"], ["password", "Generate a strong password"], ["uuid", "Generate a UUID"]]
  },
  uuid: {
    why: "Get a unique identifier for a database row, test fixture or request ID in one click.",
    features: ["Version 4 (random) UUIDs", "Cryptographically secure source", "Standard 36-character format", "A fresh value on every run"],
    uses: [["data", "Seed database records"], ["code", "Create test fixtures"], ["api", "Tag requests with IDs"], ["file", "Name temporary files"]],
    next: [["password", "Generate a password"], ["hash", "Hash a value"], ["timestamp", "Get the current timestamp"]],
    tip: "Run again for another UUID. Nothing is stored between runs."
  },
  timestamp: {
    why: "Translate between the ways logs, databases and APIs write time, so a value from one reads correctly in another.",
    features: ["Unix seconds and milliseconds", "ISO 8601 in UTC", "Tells seconds from milliseconds", "Empty input gives the current time"],
    uses: [["bug", "Read timestamps in logs"], ["data", "Convert database values"], ["api", "Prepare API date fields"], ["clock", "Check token expiry times"]],
    next: [["iso-date", "Normalise a written date"], ["timezone", "Show it in another timezone"], ["cron", "Explain a cron schedule"]]
  },
  regex: {
    why: "Build and debug a pattern against real sample text before it goes into code, validation rules or a search.",
    features: ["Lists every match", "Positions and capture groups", "All JavaScript flags", "Global or first-match mode"],
    uses: [["search", "Build search patterns"], ["shield", "Write input validation"], ["text", "Extract data from text"], ["bug", "Debug a failing pattern"]],
    next: [["regex-visualizer", "Explain the pattern"], ["regex-safe", "Test with backtracking guards"], ["line-sort", "Sort the matched lines"]]
  },
  markdown: {
    why: "Check how a README, doc page or release note will render before you publish it.",
    features: ["GitHub-flavoured Markdown", "Rendered HTML preview", "Sanitised output, no scripts", "Line breaks kept as written"],
    uses: [["doc", "Preview README files"], ["text", "Draft documentation"], ["code", "Check code blocks and tables"], ["mail", "Write release notes"]],
    next: [["html", "Escape the HTML"], ["whitespace", "Clean up whitespace"], ["diff", "Compare two drafts"]]
  },
  yaml: {
    why: "Move configuration between tools that disagree on format — Kubernetes and CI in YAML, APIs and code in JSON.",
    features: ["YAML to JSON", "JSON to YAML", "Keeps nesting and lists", "Reports parse errors clearly"],
    uses: [["config", "Convert Kubernetes manifests"], ["terminal", "Move CI config between tools"], ["api", "Turn YAML into API payloads"], ["file", "Read config in a familiar format"]],
    next: [["yaml-formatter", "Tidy the YAML"], ["json", "Format the JSON"], ["docker-compose", "Check a Compose file"]]
  },
  curl: {
    why: "Turn a request you can describe into a command you can paste into a terminal or share in a bug report.",
    features: ["Method, URL, headers and body", "Shell-safe single quoting", "JSON bodies serialised for you", "Rejects unsafe methods and URLs"],
    uses: [["terminal", "Reproduce API calls"], ["bug", "Share a failing request"], ["api", "Document API examples"], ["code", "Script quick smoke tests"]],
    next: [["api-request", "Also get a fetch() call"], ["url-parser", "Inspect the URL"], ["query", "Build a query string"]]
  },
  diff: {
    why: "See exactly which lines changed between two versions of a config, log excerpt or paragraph.",
    features: ["Line-by-line comparison", "Added lines marked +", "Removed lines marked -", "Unchanged lines kept for context"],
    uses: [["compare", "Compare config versions"], ["text", "Review document edits"], ["bug", "Spot changes in logs"], ["code", "Check generated output"]],
    next: [["json-diff", "Compare JSON by field"], ["openapi-diff", "Compare API specs"], ["line-sort", "Sort lines before comparing"]]
  },
  xml: {
    why: "Read SOAP payloads, feeds and config files that arrive on a single line.",
    features: ["Two-space indentation", "Keeps attributes", "Preserves element order", "Reports malformed XML"],
    uses: [["api", "Read SOAP and XML APIs"], ["file", "Tidy config and feed files"], ["bug", "Debug integration payloads"], ["data", "Prepare test fixtures"]],
    next: [["xml-validator", "Validate the XML"], ["json", "Format JSON instead"], ["html", "Escape the markup"]]
  },
  csv: {
    why: "Move spreadsheet exports into code, or turn API data into something a spreadsheet can open.",
    features: ["CSV rows to JSON objects", "JSON arrays back to CSV", "Header row becomes the keys", "Quotes and commas handled"],
    uses: [["data", "Import spreadsheet exports"], ["api", "Turn API data into CSV"], ["file", "Prepare seed data"], ["code", "Build test fixtures"]],
    next: [["csv-viewer", "Preview the CSV"], ["json", "Format the JSON"], ["jsonpath", "Query the rows"]]
  },
  html: {
    why: "Show markup as text on a page, or read entity-encoded strings from a template or feed.",
    features: ["Escapes < > & \" and '", "Unescapes the same entities", "Safe to paste into templates", "Round-trips exactly"],
    uses: [["code", "Show code on a web page"], ["shield", "Neutralise markup in examples"], ["file", "Read encoded feed content"], ["doc", "Prepare documentation"]],
    next: [["markdown", "Preview Markdown"], ["url", "URL-encode instead"], ["xml", "Format XML"]]
  },
  sql: {
    why: "Read long generated queries, review migrations and share SQL that people can follow.",
    features: ["Keywords in upper case", "Two-space indentation", "One clause per line", "Standard SQL dialect"],
    uses: [["data", "Read generated queries"], ["bug", "Debug slow or failing SQL"], ["code", "Review migrations"], ["doc", "Share SQL in tickets"]],
    next: [["code-formatter", "Format other code"], ["diff", "Compare two queries"], ["json", "Format JSON results"]]
  },
  graphql: {
    why: "Tidy a query copied from the network tab and confirm it parses before you send it.",
    features: ["Standard GraphQL printing", "Validates syntax", "Queries, mutations and fragments", "Uses the reference parser"],
    uses: [["api", "Tidy queries from DevTools"], ["bug", "Find syntax errors"], ["code", "Format queries for review"], ["doc", "Document API examples"]],
    next: [["json", "Format the JSON response"], ["api-request", "Build the HTTP request"], ["curl", "Get a cURL command"]]
  },
  query: {
    why: "Read the parameters in a long tracking or API link, or build a query string without escaping by hand.",
    features: ["Parses a full URL or bare query", "Builds a query from JSON", "Decodes every value", "Keeps parameter names as written"],
    uses: [["search", "Read tracking parameters"], ["api", "Debug API query strings"], ["globe", "Build links with parameters"], ["bug", "Check what a redirect carries"]],
    next: [["url-parser", "Inspect every URL part"], ["url", "Encode a single value"], ["curl", "Build a cURL request"]]
  },
  number: {
    why: "Read register values, bit masks, IDs and protocol fields written in a base other than the one you need.",
    features: ["Binary, octal, decimal and hex", "Integers wider than 64 bits", "0x prefix accepted for hex", "Every base shown at once"],
    uses: [["code", "Read bit masks and flags"], ["data", "Convert IDs and counters"], ["card", "Decode protocol fields"], ["bug", "Check register values"]],
    next: [["binary", "Inspect individual bits"], ["hex", "Convert text to hex"], ["color", "Convert a colour"]]
  },
  color: {
    why: "Translate a colour from the notation a design uses into the one your CSS, canvas or native code wants.",
    features: ["HEX, RGB and HSL", "Short HEX such as #fff", "Alpha channel supported", "All notations at once"],
    uses: [["code", "Convert design tokens"], ["image", "Match brand colours"], ["config", "Update theme files"], ["file", "Move values between design tools"]],
    next: [["number", "Convert a hex number"], ["code-formatter", "Format CSS"], ["hex", "Convert text to hex"]]
  },
  status: {
    why: "Find out what a bare status code in a log, monitor or API client means, and when a server sends it.",
    features: ["1xx to 5xx codes", "Plain-language meanings", "Rarer codes such as 425 and 451", "Instant lookup"],
    uses: [["bug", "Read API error responses"], ["api", "Design API error handling"], ["globe", "Debug redirects"], ["terminal", "Understand monitoring alerts"]],
    next: [["curl", "Reproduce the request"], ["mime", "Look up a MIME type"], ["url-parser", "Inspect the URL"]]
  },
  cron: {
    why: "Check a schedule does what you think before it goes into a crontab, CI pipeline or job runner.",
    features: ["Standard five-field syntax", "The next five run times", "Ranges, steps and lists", "Uses your browser's timezone"],
    uses: [["clock", "Check job schedules"], ["terminal", "Review crontab entries"], ["config", "Validate CI schedules"], ["bug", "Debug jobs that never run"]],
    next: [["timestamp", "Convert a run time"], ["timezone", "View it in another timezone"], ["iso-date", "Normalise a date"]]
  },
  "json-validator": {
    why: "Get a quick yes or no on whether a payload or config file will parse, and what kind of value it holds.",
    features: ["Strict JSON parsing", "Reports the top-level type", "Jump straight to a syntax error", "Leaves your document unchanged"],
    uses: [["api", "Check API payloads"], ["file", "Validate config files"], ["bug", "Find why a parser fails"], ["data", "Check fixtures before commit"]],
    next: [["json", "Format the JSON"], ["json-schema", "Validate against a schema"], ["json-minifier", "Minify it"]]
  },
  "json-minifier": {
    why: "Shrink a payload before you store, send or embed it.",
    features: ["Removes insignificant whitespace", "Validates while minifying", "Keeps every value exactly", "Shows how much smaller it got"],
    uses: [["api", "Shrink API payloads"], ["code", "Embed JSON in code"], ["config", "Store compact config"], ["data", "Reduce fixture size"]],
    next: [["json", "Pretty print it again"], ["base64", "Base64-encode the result"], ["hash", "Hash the payload"]]
  },
  jsonpath: {
    why: "Pull a few values out of a large response without scrolling through it.",
    features: ["Dot and bracket paths", "Recursive descent with ..", "Filter expressions", "Sandboxed filter evaluator"],
    uses: [["api", "Extract fields from responses"], ["search", "Find values in large documents"], ["code", "Test paths before coding them"], ["data", "Pull lists out of nested data"]],
    next: [["json", "Format the document"], ["json-diff", "Compare two documents"], ["csv", "Turn the results into CSV"]]
  },
  "json-diff": {
    why: "See which fields changed between two API responses, config versions or fixtures.",
    features: ["Field-level comparison", "Each changed path reported", "Old and new values side by side", "Ignores key order in objects"],
    uses: [["compare", "Compare API responses"], ["config", "Review config changes"], ["bug", "Find unexpected changes"], ["data", "Check fixture updates"]],
    next: [["json", "Format a document"], ["diff", "Compare as plain text"], ["json-schema", "Validate against a schema"]]
  },
  "xml-validator": {
    why: "Check an XML payload or config is well-formed before a stricter system rejects it.",
    features: ["Well-formedness check", "First error with line and column", "Checks tags and attributes", "Leaves your document unchanged"],
    uses: [["api", "Check SOAP payloads"], ["file", "Validate config files"], ["bug", "Find broken tags"], ["data", "Check feeds before publishing"]],
    next: [["xml", "Format the XML"], ["json-validator", "Validate JSON instead"], ["html", "Escape the markup"]]
  },
  "yaml-formatter": {
    why: "Make indentation and lists consistent in a config file before you commit it.",
    features: ["Consistent indentation", "Keeps key order", "Normalises lists and strings", "Reports YAML syntax errors"],
    uses: [["config", "Tidy Kubernetes manifests"], ["terminal", "Clean up CI pipelines"], ["file", "Normalise config before commit"], ["bug", "Find indentation errors"]],
    next: [["yaml", "Convert to JSON"], ["docker-compose", "Check a Compose file"], ["diff", "Compare two versions"]]
  },
  password: {
    why: "Generate a strong, random password or secret for a new account, service or test environment.",
    features: ["8 to 128 characters", "Letters, digits and symbols", "Look-alike characters left out", "Cryptographically secure source"],
    uses: [["key", "Create account passwords"], ["shield", "Generate API secrets"], ["config", "Fill environment secrets"], ["lock", "Set test credentials"]],
    next: [["hash", "Hash a value"], ["uuid", "Generate a UUID"], ["jwt-sign", "Sign a token with a secret"]],
    tip: "Run again for another password. Change the length in the options bar."
  },
  whitespace: {
    why: "Clean text pasted from documents, emails or terminals before it goes into code or a ticket.",
    features: ["Collapses repeated spaces", "Trims line endings", "Reduces runs of blank lines", "Trims the start and end"],
    uses: [["text", "Clean pasted text"], ["code", "Tidy code comments"], ["mail", "Prepare email content"], ["file", "Normalise log excerpts"]],
    next: [["line-sort", "Sort the lines"], ["line-dedupe", "Remove duplicate lines"], ["diff", "Compare before and after"]]
  },
  "line-sort": {
    why: "Order names, IDs, dependencies or log lines so they are easy to scan and compare.",
    features: ["Natural order (item2 before item10)", "Case-insensitive", "Keeps every line", "One item per line"],
    uses: [["list", "Sort dependency lists"], ["data", "Order IDs and keys"], ["text", "Alphabetise names"], ["compare", "Prepare lists for diffing"]],
    next: [["line-dedupe", "Remove duplicates"], ["diff", "Compare two lists"], ["whitespace", "Clean whitespace"]]
  },
  "line-dedupe": {
    why: "Remove repeated entries from lists, logs and exports without changing their order.",
    features: ["Keeps the first occurrence", "Preserves the original order", "Exact line matching", "Handles long lists"],
    uses: [["list", "Clean up mailing lists"], ["data", "Remove duplicate IDs"], ["bug", "Condense repeated log lines"], ["text", "Tidy keyword lists"]],
    next: [["line-sort", "Sort the lines"], ["whitespace", "Clean whitespace"], ["diff", "Compare two lists"]]
  },
  "iso-date": {
    why: "Turn dates written by people or legacy systems into the ISO 8601 form APIs and databases expect.",
    features: ["Many common input formats", "ISO 8601 output in UTC", "Rejects dates that do not exist", "Respects written UTC offsets"],
    uses: [["api", "Prepare API date fields"], ["data", "Normalise database imports"], ["file", "Clean spreadsheet dates"], ["clock", "Convert log times"]],
    next: [["timestamp", "Convert to a Unix timestamp"], ["timezone", "Show it in another timezone"], ["cron", "Explain a schedule"]]
  },
  timezone: {
    why: "Read a server timestamp in your own time, or plan something across regions.",
    features: ["Any IANA timezone", "Daylight saving applied", "Full date and time output", "Accepts ISO 8601 dates"],
    uses: [["globe", "Schedule across regions"], ["clock", "Read server log times"], ["mail", "Plan meeting times"], ["api", "Check scheduled job times"]],
    next: [["timestamp", "Convert to a Unix timestamp"], ["iso-date", "Normalise a date"], ["cron", "Explain a schedule"]]
  },
  "url-parser": {
    why: "Check exactly which host, path and parameters a long or suspicious link contains.",
    features: ["Protocol, host and port", "Path and fragment", "Every query parameter", "Decoded values"],
    uses: [["shield", "Inspect suspicious links"], ["api", "Debug API endpoints"], ["search", "Read tracking links"], ["globe", "Check redirect targets"]],
    next: [["query", "Build a query string"], ["url", "Encode a value"], ["curl", "Build a cURL request"]]
  },
  "code-formatter": {
    why: "Tidy snippets copied from answers, logs or chat before they go into your code.",
    features: ["JavaScript and TypeScript", "JSON, CSS and HTML", "Formatted with Prettier", "The same output every time"],
    uses: [["code", "Tidy copied snippets"], ["bug", "Read minified code"], ["file", "Format config files"], ["doc", "Prepare code for docs"]],
    next: [["sql", "Format SQL"], ["json", "Format JSON"], ["html", "Escape HTML"]]
  },
  "csv-viewer": {
    why: "See a CSV's shape before you import it or open it in a spreadsheet.",
    features: ["Column and row counts", "Header names listed", "First rows previewed", "Quoted fields handled"],
    uses: [["data", "Check exports before import"], ["file", "Preview large files"], ["bug", "Find malformed rows"], ["list", "Confirm column names"]],
    next: [["csv", "Convert to JSON"], ["line-dedupe", "Remove duplicate lines"], ["json", "Format JSON"]]
  },
  mime: {
    why: "Find the Content-Type for a file, or the extensions a type covers, when setting headers or checking uploads.",
    features: ["Extension to MIME type", "MIME type to extensions", "File names accepted", "Common web formats"],
    uses: [["api", "Set Content-Type headers"], ["config", "Configure web servers"], ["file", "Check upload types"], ["shield", "Build upload allow-lists"]],
    next: [["status", "Look up a status code"], ["curl", "Build a request"], ["url-parser", "Inspect a URL"]]
  },
  "openapi-viewer": {
    why: "Get the outline of an API spec without scrolling through thousands of lines.",
    features: ["Title and version", "Every path and method", "JSON or YAML input", "OpenAPI 3 and Swagger 2"],
    uses: [["api", "Review a new API"], ["file", "Audit spec files"], ["code", "Plan client code"], ["search", "Find an endpoint quickly"]],
    next: [["openapi-validator", "Validate the spec"], ["openapi-diff", "Compare two versions"], ["curl", "Build a request"]]
  },
  "openapi-validator": {
    why: "Catch spec mistakes before code generators, gateways or docs tools reject the file.",
    features: ["Official OpenAPI schemas", "Every problem listed", "Path to each problem", "JSON or YAML input"],
    uses: [["api", "Validate before publishing"], ["code", "Check before code generation"], ["config", "Gate specs in review"], ["bug", "Find why a tool rejects a spec"]],
    next: [["openapi-viewer", "Summarise the spec"], ["openapi-diff", "Compare two versions"], ["json", "Format the JSON"]]
  },
  "json-schema": {
    why: "Check payloads and config against a contract before they reach a service that enforces it.",
    features: ["Drafts 4, 7, 2019-09 and 2020-12", "Every failure reported", "Path to each failure", "Reads the draft the schema declares"],
    uses: [["api", "Check request payloads"], ["config", "Validate config files"], ["data", "Test fixtures against a contract"], ["bug", "Find why validation fails"]],
    next: [["json-schema-generator", "Generate a schema"], ["json", "Format the JSON"], ["json-validator", "Check JSON syntax"]]
  },
  "regex-visualizer": {
    why: "Understand a dense pattern written by someone else before you change it.",
    features: ["Token-by-token breakdown", "Groups, classes and quantifiers", "Position of each token", "Modern JavaScript syntax"],
    uses: [["code", "Review patterns in code"], ["bug", "Debug a pattern"], ["text", "Learn regex syntax"], ["doc", "Document validation rules"]],
    next: [["regex", "Test against sample text"], ["regex-safe", "Test with backtracking guards"], ["line-sort", "Sort lines"]]
  },
  "docker-compose": {
    why: "Check a Compose file parses and every service knows what to run, before you bring the stack up.",
    features: ["YAML syntax check", "Services with image, ports and volumes", "Flags services without image or build", "Clear error messages"],
    uses: [["config", "Check files before deploying"], ["terminal", "Review local dev setups"], ["bug", "Find missing images"], ["file", "Audit services in a repo"]],
    next: [["yaml-formatter", "Tidy the YAML"], ["yaml", "Convert to JSON"], ["env", "Format an .env file"]]
  },
  gitignore: {
    why: "Start a repository with sensible ignore rules for the stacks it uses.",
    features: ["14 stacks, Node to Terraform", "Several stacks at once", "Says when a stack is unknown", "Ready to paste into .gitignore"],
    uses: [["code", "Start a new repository"], ["file", "Clean up a noisy repo"], ["config", "Standardise team settings"], ["shield", "Keep .env files out of git"]],
    next: [["env", "Format an .env file"], ["docker-compose", "Check a Compose file"], ["code-formatter", "Format code"]]
  },
  nginx: {
    why: "Read dense server blocks copied from docs, tickets or one-line configs.",
    features: ["Indents nested blocks", "One directive per line", "Keeps directive order", "Plain-text output"],
    uses: [["config", "Tidy server blocks"], ["bug", "Read configs from tickets"], ["globe", "Review proxy settings"], ["file", "Prepare config for review"]],
    next: [["docker-compose", "Check a Compose file"], ["env", "Format an .env file"], ["diff", "Compare two configs"]]
  },
  "jwt-sign": {
    why: "Create HS256 test tokens for local development, or check a token was signed with the secret you expect.",
    features: ["Signs JSON payloads as HS256", "Verifies HS256 signatures", "Secret stays in this tab", "Refuses algorithm downgrades"],
    uses: [["key", "Create tokens for local testing"], ["bug", "Check why a token is rejected"], ["api", "Test protected endpoints"], ["shield", "Confirm which secret signed a token"]],
    next: [["jwt", "Decode a token"], ["jwt-rsa", "Verify an RS256 token"], ["timestamp", "Set exp and iat values"]]
  },
  cert: {
    why: "Read who a certificate was issued to, who issued it and when it expires, without openssl.",
    features: ["Subject and issuer", "Validity dates", "Serial number and algorithms", "Block type and size"],
    uses: [["shield", "Check expiry dates"], ["globe", "Inspect TLS certificates"], ["bug", "Debug certificate errors"], ["config", "Audit certificates in config"]],
    next: [["pem", "Identify another PEM block"], ["asn1", "Walk the DER structure"], ["base64", "Decode Base64"]]
  },
  pem: {
    why: "Tell what a PEM block holds — a key, a certificate or a request — and how large it is.",
    features: ["Identifies the block type", "Decoded byte length", "Certificate details when present", "Checks the Base64 body"],
    uses: [["key", "Identify key files"], ["shield", "Check certificate requests"], ["config", "Audit secrets in config"], ["bug", "Find truncated blocks"]],
    next: [["cert", "Decode a certificate"], ["asn1", "Walk the DER structure"], ["base64", "Decode Base64"]]
  },
  webhook: {
    why: "Read a webhook payload with the event name and identifiers up front, then the full body.",
    features: ["Pretty-printed payload", "Event name surfaced first", "Identifiers surfaced first", "Validates the JSON"],
    uses: [["api", "Debug webhook deliveries"], ["bug", "Read failed events"], ["doc", "Document event shapes"], ["data", "Prepare test events"]],
    next: [["json-schema", "Validate against a schema"], ["jsonpath", "Extract fields"], ["jwt-sign", "Check a signed token"]]
  },
  "api-request": {
    why: "Describe a request once and get both a fetch() call for code and a cURL command for the terminal.",
    features: ["fetch() and cURL together", "Headers and JSON body", "Shell-safe quoting", "Rejects unsafe methods and URLs"],
    uses: [["code", "Add requests to code"], ["terminal", "Try an endpoint quickly"], ["doc", "Document API examples"], ["bug", "Share a failing request"]],
    next: [["curl", "Just the cURL command"], ["url-parser", "Inspect the URL"], ["json", "Format the body"]]
  },
  "image-base64": {
    why: "Check an image data URL — its type and decoded size — or turn a raw Base64 image into one.",
    features: ["Reads image files locally", "Reports type and byte size", "Accepts raw Base64 payloads", "Images up to 10 MB"],
    uses: [["image", "Inline small images in CSS"], ["code", "Embed icons in code"], ["mail", "Prepare email images"], ["bug", "Check data URLs from APIs"]],
    next: [["base64", "Decode Base64 text"], ["qr", "Generate a QR code"], ["mime", "Look up a MIME type"]],
    tip: "You can also drag and drop an image straight into the input editor."
  },
  qr: {
    why: "Make a QR code for a link, Wi-Fi note or any short text, ready to download as a PNG.",
    features: ["Any text or URL", "PNG you can download", "Medium error correction", "Rendered in your browser"],
    uses: [["globe", "Share links on print"], ["mail", "Add codes to invitations"], ["doc", "Label devices and assets"], ["code", "Test QR scanners"]],
    next: [["url", "URL-encode a link"], ["image-base64", "Inspect the image data"], ["password", "Generate a password"]]
  },
  semver: {
    why: "Settle which of two versions is newer, prerelease tags included, before you pin a dependency.",
    features: ["Semantic Versioning 2.0 rules", "Prerelease ordering", "Says which side is newer", "Compare result as -1, 0 or 1"],
    uses: [["code", "Pin dependencies"], ["terminal", "Check release tags"], ["config", "Review upgrade ranges"], ["bug", "Debug version conflicts"]],
    next: [["diff", "Compare two changelogs"], ["line-sort", "Sort a version list"], ["json", "Format package.json"]]
  },
  env: {
    why: "Tidy a .env file before you share or commit an example of it, and catch keys defined twice.",
    features: ["Sorts keys alphabetically", "Trims spaces around =", "Flags duplicate keys", "Drops comments and blank lines"],
    uses: [["config", "Tidy environment files"], ["shield", "Prepare .env.example files"], ["bug", "Find duplicate keys"], ["compare", "Compare environments"]],
    next: [["gitignore", "Ignore .env files"], ["diff", "Compare two environments"], ["docker-compose", "Check a Compose file"]]
  },
  "openapi-diff": {
    why: "Find changes between two versions of an API spec that could break existing clients.",
    features: ["Removed operations", "Removed parameters", "Removed responses", "JSON or YAML input"],
    uses: [["api", "Review API changes"], ["shield", "Gate breaking changes"], ["code", "Plan client updates"], ["doc", "Write migration notes"]],
    next: [["openapi-validator", "Validate the new spec"], ["openapi-viewer", "Summarise the spec"], ["json-diff", "Compare as JSON"]]
  },
  "json-schema-generator": {
    why: "Start a JSON Schema from a real example instead of a blank file.",
    features: ["Infers types from values", "Nested objects and arrays", "Marks present keys required", "Draft 2020-12 output"],
    uses: [["api", "Start an API contract"], ["config", "Describe config files"], ["data", "Document fixture shapes"], ["code", "Bootstrap validation"]],
    next: [["json-schema", "Validate data against it"], ["json", "Format the schema"], ["openapi-validator", "Validate an API spec"]],
    tip: "A generated schema is a starting point: tighten types and required keys before relying on it."
  },
  "jwt-rsa": {
    why: "Confirm an RS256 token was signed by the key you expect, using its public JWK.",
    features: ["RS256 signature check", "Public JWK input", "Decoded header and payload", "Computed with Web Crypto"],
    uses: [["key", "Verify tokens from an identity provider"], ["bug", "Debug rejected tokens"], ["shield", "Check key rotation"], ["api", "Test protected endpoints"]],
    next: [["jwt", "Decode a token"], ["jwt-sign", "Verify an HS256 token"], ["pem", "Inspect a PEM key"]]
  },
  "log-redactor": {
    why: "Mask secrets and personal data in a log excerpt before you paste it into a ticket or chat.",
    features: ["Bearer tokens and API keys", "Passwords and secrets", "Email addresses", "Card-like numbers"],
    uses: [["shield", "Share logs safely"], ["bug", "Attach logs to bug reports"], ["mail", "Send excerpts to vendors"], ["doc", "Prepare incident notes"]],
    next: [["jwt", "Decode a token"], ["whitespace", "Clean up the log"], ["line-dedupe", "Remove repeated lines"]],
    tip: "Redaction is pattern-based. Read the result before sharing it anywhere."
  },
  protobuf: {
    why: "Look inside protobuf bytes from a capture or log when you do not have the .proto file.",
    features: ["Field numbers and wire types", "Varints, fixed and length-delimited", "Printable strings shown as text", "No schema needed"],
    uses: [["api", "Debug gRPC payloads"], ["bug", "Read captured messages"], ["data", "Check stored blobs"], ["code", "Verify encoders"]],
    next: [["hex", "Convert text to hex"], ["asn1", "Inspect DER bytes"], ["base64", "Decode Base64"]]
  },
  asn1: {
    why: "Walk the structure of a DER blob — keys, certificates, signatures — tag by tag.",
    features: ["Tag, length and value", "Nested structures", "Constructed vs primitive", "Hex input with any spacing"],
    uses: [["shield", "Inspect keys and certificates"], ["bug", "Debug encoding errors"], ["card", "Read payment cryptograms"], ["code", "Verify DER encoders"]],
    next: [["cert", "Decode a certificate"], ["pem", "Inspect a PEM block"], ["emv-tlv", "Parse EMV TLV"]]
  },
  "regex-safe": {
    why: "Test a pattern with guards against catastrophic backtracking, so a bad pattern is stopped instead of freezing the tab.",
    features: ["Rejects risky nested quantifiers", "Input and pattern size limits", "Up to 500 matches listed", "Match positions"],
    uses: [["shield", "Vet patterns from users"], ["bug", "Debug slow patterns"], ["search", "Test search rules"], ["code", "Check validation patterns"]],
    next: [["regex", "Test with capture groups"], ["regex-visualizer", "Explain the pattern"], ["line-sort", "Sort lines"]]
  },
  hex: {
    why: "Convert text to the hex bytes protocol dumps use, or read hex from a trace back as text.",
    features: ["Text to hex bytes", "Hex back to text", "Spaced and compact forms", "Byte count included"],
    uses: [["card", "Read payment traces"], ["bug", "Inspect protocol dumps"], ["code", "Prepare test vectors"], ["data", "Check encodings"]],
    next: [["ebcdic", "Decode EBCDIC bytes"], ["binary", "See the bits"], ["base64", "Base64 instead"]]
  },
  binary: {
    why: "See which bits are set in a hex value, or turn a bit string back into hex.",
    features: ["Hex to binary per nibble", "Binary back to hex", "Pads to whole nibbles", "0x prefix accepted"],
    uses: [["card", "Read bitmap fields"], ["code", "Check bit flags"], ["bug", "Debug register values"], ["data", "Decode status bytes"]],
    next: [["iso-bitmap", "Expand an ISO 8583 bitmap"], ["number", "Convert number bases"], ["hex", "Convert text to hex"]]
  },
  bcd: {
    why: "Pack digits into binary-coded decimal the way payment messages expect, or unpack BCD bytes from a trace.",
    features: ["Packs two digits per byte", "F filler for odd counts", "Leading-zero option", "Unpacks back to digits"],
    uses: [["card", "Build ISO 8583 fields"], ["bug", "Read packed trace fields"], ["code", "Prepare test vectors"], ["data", "Check stored amounts"]],
    next: [["iso8583", "Inspect an ISO 8583 message"], ["hex", "Convert text to hex"], ["track2", "Parse Track 2 data"]]
  },
  ebcdic: {
    why: "Read EBCDIC bytes from a mainframe or payment host trace as ordinary text.",
    features: ["IBM code page 037", "Hex input with any spacing", "Control bytes shown as escapes", "Letters, digits and symbols"],
    uses: [["card", "Read host payment traces"], ["bug", "Debug mainframe messages"], ["data", "Check converted files"], ["terminal", "Inspect legacy logs"]],
    next: [["hex", "Convert text to hex"], ["iso8583", "Inspect an ISO 8583 message"], ["binary", "See the bits"]]
  },
  "iso-bitmap": {
    why: "Expand an ISO 8583 bitmap into the data elements it switches on.",
    features: ["Primary and secondary bitmaps", "Lists enabled data elements", "Secondary bitmap read from bit 1", "Hex input with any spacing"],
    uses: [["card", "Read authorisation messages"], ["bug", "Debug missing fields"], ["code", "Check message builders"], ["doc", "Document message specs"]],
    next: [["iso8583", "Inspect the whole message"], ["binary", "See the bits"], ["hex", "Convert to hex"]]
  },
  iso8583: {
    why: "Read an ISO 8583 message field by field: MTI, bitmap and each data element present.",
    features: ["Message type indicator", "Bitmap expanded", "Each present field listed", "PANs shown masked"],
    uses: [["card", "Debug authorisations"], ["bug", "Read host traces"], ["code", "Check message builders"], ["doc", "Explain message flows"]],
    next: [["iso-bitmap", "Expand just the bitmap"], ["track2", "Parse Track 2 data"], ["emv-tlv", "Parse EMV data"]],
    tip: "Use masked test data only. Never paste production card data into any tool."
  },
  "emv-tlv": {
    why: "Break EMV chip data from a transaction into its tags, lengths and values.",
    features: ["BER-TLV parsing", "Nested tags decoded", "Multi-byte tags and lengths", "Hex input with any spacing"],
    uses: [["card", "Read chip transaction data"], ["bug", "Debug declined transactions"], ["code", "Check kernel output"], ["doc", "Document tag usage"]],
    next: [["asn1", "Inspect DER bytes"], ["iso8583", "Inspect an ISO 8583 message"], ["hex", "Convert to hex"]]
  },
  luhn: {
    why: "Check an account number's check digit and see it masked, using test numbers.",
    features: ["Luhn (mod 10) check", "Expected check digit", "Masked number", "Spaces and dashes allowed"],
    uses: [["card", "Validate test card numbers"], ["code", "Check form validation"], ["data", "Clean imported numbers"], ["bug", "Debug rejected numbers"]],
    next: [["track2", "Parse Track 2 data"], ["iso8583", "Inspect an ISO 8583 message"], ["bcd", "Pack digits as BCD"]],
    tip: "Use documented test numbers such as 4111 1111 1111 1111."
  },
  track2: {
    why: "Split Track 2 data into PAN, expiry and service code, keeping the PAN masked.",
    features: ["PAN, expiry and service code", "Discretionary data", "PAN always masked", "Accepts = or D separators"],
    uses: [["card", "Read test swipe data"], ["bug", "Debug terminal messages"], ["code", "Check parsers"], ["doc", "Document test cards"]],
    next: [["luhn", "Check the PAN"], ["iso8583", "Inspect an ISO 8583 message"], ["bcd", "Pack digits as BCD"]],
    tip: "Use masked test data only. Never paste production card data into any tool."
  }
};

export function guideFor(toolId: string): ToolGuide | undefined {
  return GUIDES[toolId];
}
