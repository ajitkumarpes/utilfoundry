import { expect, test } from "@playwright/test";
import { TOOLS } from "../lib/tools";
import { banner, choose, expectTone, openTool, readOutput, run, runButton, setField, setInput } from "./helpers";

/**
 * Every tool, driven the way a person would use it: real-world input pasted in, a setting
 * chosen, Run pressed, and the actual answer checked — not just "something came out". Each
 * expected value was worked out independently (Node's crypto, the library itself, or by hand),
 * so a tool that answers confidently and wrongly fails here by name.
 */

test.use({ timezoneId: "UTC" });

type Case = {
  name: string;
  slug: string;
  /** Omitted: run on the shipped example. */
  input?: string;
  radio?: string;
  fields?: Record<string, string>;
  exact?: string;
  contains?: Array<string | RegExp>;
  absent?: string[];
  json?: unknown;
  tone: "ready" | "warning" | "error";
  title?: string | RegExp;
  note?: string | RegExp;
};

const CERT_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEnlyiKz/NiTSH7n4aBYqL51DXoQRb\nIfOtYNjdaqkpQNVMKUDRSSuDikK4EVXxkxlkMJCfJb35BAzlmeRH3XyXPA==\n-----END PUBLIC KEY-----";

const CASES: Case[] = [
  // ---------------------------------------------------------------- Format & validate
  {
    name: "formats a one-line API response", slug: "json-formatter",
    input: '{"user":{"id":42,"roles":["admin","dev"]},"active":true}',
    exact: '{\n  "user": {\n    "id": 42,\n    "roles": [\n      "admin",\n      "dev"\n    ]\n  },\n  "active": true\n}',
    tone: "ready", title: "Valid JSON", note: "Great! Your JSON is valid and properly formatted."
  },
  {
    name: "minifies", slug: "json-formatter", radio: "Minify",
    input: '{\n  "a": 1,\n  "b": [1, 2]\n}', exact: '{"a":1,"b":[1,2]}', tone: "ready", title: "Valid JSON", note: /Minified/
  },
  {
    name: "validates only", slug: "json-formatter", radio: "Validate only",
    input: "[1, 2, 3]", contains: ['"valid": true', '"type": "array"'], tone: "ready", note: "The document parses as an array."
  },
  {
    name: "explains a trailing comma and where it is", slug: "json-formatter",
    input: '{\n  "name": "Asha",\n  "roles": ["admin",],\n  "active": true\n}',
    tone: "error", title: "Invalid JSON", note: /Trailing comma before '\]'[\s\S]*Line 3, column 21/
  },
  {
    name: "explains single quotes", slug: "json-formatter", input: "{'name': 'Asha'}",
    tone: "error", title: "Invalid JSON", note: /double quotes/
  },
  {
    name: "explains a missing comma", slug: "json-formatter", input: '{"a": 1\n "b": 2}',
    tone: "error", title: "Invalid JSON", note: /comma is missing between two properties[\s\S]*Line 2, column 2/
  },
  { name: "reports the top-level type", slug: "json-validator", input: '{"orders": [1, 2]}', contains: ['"type": "object"'], tone: "ready", note: "The document parses as an object." },
  { name: "finds an unclosed array", slug: "json-validator", input: '{"ids": [1, 2', tone: "error", title: "Invalid JSON", note: /array is not closed/ },
  { name: "minifies a formatted payload", slug: "json-minifier", input: '{\n  "id": 7,\n  "tags": [\n    "a",\n    "b"\n  ]\n}', exact: '{"id":7,"tags":["a","b"]}', tone: "ready" },
  {
    name: "converts YAML to JSON", slug: "yaml-to-json",
    input: "app:\n  name: shop\n  replicas: 3\n  ports:\n    - 80\n    - 443",
    json: { app: { name: "shop", replicas: 3, ports: [80, 443] } }, tone: "ready", title: "Converted successfully"
  },
  {
    name: "converts JSON to YAML", slug: "yaml-to-json", radio: "JSON → YAML",
    input: '{"service":"api","ports":[80,443],"env":{"DEBUG":false}}',
    exact: "service: api\nports:\n  - 80\n  - 443\nenv:\n  DEBUG: false\n", tone: "ready"
  },
  { name: "reports broken YAML", slug: "yaml-to-json", input: "ports: [80, 443", tone: "error", title: "Invalid YAML" },
  {
    name: "indents XML", slug: "xml-formatter", input: '<note id="1"><to>Tove</to><from>Jani</from></note>',
    contains: ['<note id="1">', "\n  <to>Tove</to>", "\n  <from>Jani</from>"], tone: "ready", title: "Formatted successfully"
  },
  { name: "refuses to format broken XML", slug: "xml-formatter", input: "<a><b></a>", tone: "error", note: /line 1/ },
  {
    name: "formats a real query", slug: "sql-formatter",
    input: "select u.id, u.email, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = true group by u.id, u.email having count(o.id) > 5 order by orders desc limit 10;",
    contains: ["SELECT\n  u.id,\n  u.email,", "LEFT JOIN orders o ON o.user_id = u.id", "HAVING\n  count(o.id) > 5", "LIMIT\n  10;"], tone: "ready"
  },
  { name: "asks for a statement", slug: "sql-formatter", input: "   ", tone: "error", note: "Enter a SQL statement to format." },
  { name: "passes well-formed XML", slug: "xml-validator", input: '<catalog><book id="1"/></catalog>', contains: ['"valid": true'], tone: "ready", title: "Valid XML" },
  { name: "flags a mismatched tag", slug: "xml-validator", input: "<catalog><book></catalog>", contains: ['"valid": false'], tone: "warning", title: "Invalid XML", note: /line 1/ },
  {
    name: "normalises YAML indentation", slug: "yaml-formatter", input: "server:\n    port: 8080\n    hosts: [alpha, beta]",
    exact: "server:\n  port: 8080\n  hosts:\n    - alpha\n    - beta\n", tone: "ready"
  },
  {
    name: "shows the failing path", slug: "json-schema-validator",
    contains: ['"valid": false', '"path": "#/age"'], tone: "warning", title: "Data does not match the schema"
  },
  {
    name: "passes matching data", slug: "json-schema-validator",
    input: '{"name":"Asha","age":30}\n---\n{"type":"object","required":["name","age"],"properties":{"name":{"type":"string"},"age":{"type":"integer"}}}',
    contains: ['"valid": true'], tone: "ready", title: "Data matches the schema"
  },
  { name: "needs both documents", slug: "json-schema-validator", input: '{"a":1}', tone: "error", title: "Two documents needed", note: /JSON Schema editor is empty/ },

  // ---------------------------------------------------------------- JSON
  {
    name: "filters with an expression", slug: "jsonpath-extractor", fields: { Path: "$.store.book[?(@.price > 10)].title" },
    input: '{"store":{"book":[{"title":"Dune","price":8.99},{"title":"Neuromancer","price":12.5},{"title":"Foundation","price":15}]}}',
    exact: '[\n  "Neuromancer",\n  "Foundation"\n]', tone: "ready"
  },
  {
    name: "uses recursive descent", slug: "jsonpath-extractor", fields: { Path: "$..price" },
    input: '{"store":{"book":[{"price":8.99},{"price":12.5}],"bike":{"price":99}}}', json: [8.99, 12.5, 99], tone: "ready"
  },
  { name: "says when nothing matches", slug: "jsonpath-extractor", fields: { Path: "$.store.bicycle" }, input: '{"store":{}}', tone: "error", note: "JSONPath returned no matches." },
  {
    name: "lists changed fields", slug: "json-diff",
    input: '{"name":"api","replicas":2,"tags":["a"]}\n---\n{"tags":["a"],"name":"api","replicas":3,"debug":true}',
    contains: ['"path": "$.replicas"', '"path": "$.debug"'], absent: ['"path": "$.name"', '"path": "$.tags"'], tone: "ready", title: "2 differences found"
  },
  { name: "says when documents match", slug: "json-diff", input: '{"a":1,"b":2}\n---\n{"b":2,"a":1}', exact: "[]", tone: "ready", title: "No differences" },
  {
    name: "infers types from an example", slug: "json-schema-generator",
    input: '{"id":7,"price":9.5,"tags":["a"],"owner":{"name":"Asha"},"deleted":null}',
    contains: ['"id": {\n      "type": "integer"', '"price": {\n      "type": "number"', '"items": {\n        "type": "string"', '"deleted": {\n      "type": "null"'],
    tone: "ready", title: "Generated successfully"
  },

  // ---------------------------------------------------------------- Encode & decode
  { name: "encodes UTF-8 text", slug: "base64-encoder", input: "Hello, Wörld! 👋", exact: "SGVsbG8sIFfDtnJsZCEg8J+Riw==", tone: "ready", title: "Encoded successfully" },
  { name: "decodes back to UTF-8", slug: "base64-encoder", radio: "Decode", input: "SGVsbG8sIFfDtnJsZCEg8J+Riw==", exact: "Hello, Wörld! 👋", tone: "ready", title: "Decoded successfully" },
  { name: "decodes URL-safe Base64", slug: "base64-encoder", radio: "Decode", input: "Pz8_", exact: "???", tone: "ready" },
  { name: "rejects what is not Base64", slug: "base64-encoder", radio: "Decode", input: "not base64!", tone: "error", note: "Input is not valid Base64." },
  { name: "percent-encodes a value", slug: "url-encoder", input: "name=Jane Doe&city=São Paulo", exact: "name%3DJane%20Doe%26city%3DS%C3%A3o%20Paulo", tone: "ready" },
  { name: "decodes a value", slug: "url-encoder", radio: "Decode", input: "name%3DJane%20Doe%26city%3DS%C3%A3o%20Paulo", exact: "name=Jane Doe&city=São Paulo", tone: "ready" },
  { name: "reports a malformed escape", slug: "url-encoder", radio: "Decode", input: "%E0%A4%A", tone: "error", note: /A % must be followed by two hex digits/ },
  {
    name: "escapes markup", slug: "html-escape", input: `<a href="/x?a=1&b=2">Tom & Jerry's</a>`,
    exact: "&lt;a href=&quot;/x?a=1&amp;b=2&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;", tone: "ready", title: "Escaped successfully"
  },
  {
    name: "unescapes entities", slug: "html-escape", radio: "Unescape", input: "&lt;b&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;",
    exact: "<b>Tom & Jerry's</b>", tone: "ready"
  },

  // ---------------------------------------------------------------- Encoding
  { name: "decodes varint and string fields", slug: "protobuf-decoder", input: "08 96 01 12 07 74 65 73 74 69 6E 67", contains: ['"value": "150"', '"text": "testing"'], tone: "ready" },
  { name: "reports a truncated message", slug: "protobuf-decoder", input: "0A 05 48", tone: "error", note: /Truncated/ },
  { name: "walks nested DER", slug: "asn1-der-inspector", contains: ['"constructed": true'], tone: "ready" },
  { name: "reports truncated DER", slug: "asn1-der-inspector", input: "30 05 02 01", tone: "error", note: "ASN.1 value exceeds the input length." },
  { name: "shows bits per nibble", slug: "binary-bitfield", input: "A5", exact: "A  1010\n5  0101", tone: "ready" },
  { name: "turns bits into hex", slug: "binary-bitfield", radio: "Binary → hex", input: "1111 0000 1", exact: "1E1", tone: "ready" },
  { name: "rejects non-hex", slug: "binary-bitfield", input: "XYZ", tone: "error", note: "Enter hexadecimal characters only." },

  // ---------------------------------------------------------------- Converters
  { name: "converts seconds", slug: "unix-timestamp-converter", input: "1700000000", contains: ['"unixMilliseconds": 1700000000000', '"iso": "2023-11-14T22:13:20.000Z"'], tone: "ready" },
  { name: "reads milliseconds", slug: "unix-timestamp-converter", input: "1700000000123", contains: ['"unixSeconds": 1700000000', '"iso": "2023-11-14T22:13:20.123Z"'], tone: "ready" },
  { name: "converts an ISO date", slug: "unix-timestamp-converter", input: "2024-02-29T00:00:00Z", contains: ['"unixSeconds": 1709164800'], tone: "ready" },
  { name: "refuses a date that does not exist", slug: "unix-timestamp-converter", input: "2023-02-29", tone: "error", note: /February 2023 has 28 days/ },
  { name: "converts CSV to JSON", slug: "csv-to-json", input: 'name,age,city\nAsha,30,Pune\n"Lee, Jr",41,"New York"', json: [{ name: "Asha", age: "30", city: "Pune" }, { name: "Lee, Jr", age: "41", city: "New York" }], tone: "ready" },
  { name: "converts JSON to CSV with quoting", slug: "csv-to-json", radio: "JSON → CSV", input: '[{"name":"Asha","note":"likes, commas"},{"name":"Lee","note":"says \\"hi\\""}]', contains: ["name,note", 'Asha,"likes, commas"', 'Lee,"says ""hi"""'], tone: "ready" },
  { name: "needs an array of objects", slug: "csv-to-json", radio: "JSON → CSV", input: '{"a":1}', tone: "error", note: "Enter a JSON array of objects." },
  { name: "converts decimal", slug: "base-converter", input: "255", contains: ['"hexadecimal": "FF"', '"binary": "11111111"', '"octal": "377"'], tone: "ready" },
  { name: "converts a 64-bit hex word", slug: "base-converter", radio: "Hex", input: "0xFFFFFFFFFFFFFFFF", contains: ['"decimal": "18446744073709551615"'], tone: "ready" },
  { name: "rejects a digit outside the base", slug: "base-converter", radio: "Binary", input: "102", tone: "error", note: "Enter a valid base-2 number." },
  { name: "converts HEX", slug: "color-converter", input: "#4263EB", contains: ['"rgb": "rgb(66, 99, 235)"', '"hsl": "hsl(228, 81%, 59%)"'], tone: "ready" },
  { name: "keeps alpha", slug: "color-converter", input: "rgba(255, 0, 0, 0.5)", contains: ['"hex8": "#FF000080"'], tone: "ready" },
  { name: "converts HSL", slug: "color-converter", input: "hsl(120, 100%, 25%)", contains: ['"hex": "#008000"'], tone: "ready" },
  { name: "explains accepted formats", slug: "color-converter", input: "bluish", tone: "error", note: /Enter a HEX color/ },

  // ---------------------------------------------------------------- Text
  {
    name: "lists matches with groups", slug: "regex-tester", fields: { Pattern: "(\\d{4})-(\\d{2})-(\\d{2})", Flags: "g" },
    input: "Released 2024-03-15, patched 2024-04-01.", contains: ['"count": 2', '"2024"', '"03"', '"04"'], tone: "ready", title: "2 matches found"
  },
  { name: "says when nothing matches", slug: "regex-tester", fields: { Pattern: "xyz" }, input: "abc", tone: "warning", title: "No matches" },
  { name: "reports an invalid pattern", slug: "regex-tester", fields: { Pattern: "(" }, input: "abc", tone: "error", title: "Invalid pattern" },
  {
    name: "marks every changed line", slug: "text-diff", input: "apple\nbanana\ncherry\ndate\n---\napple\ncherry\nelderberry",
    exact: " apple\n-banana\n cherry\n-date\n+elderberry", tone: "ready", title: "1 line added, 2 removed"
  },
  { name: "marks both lines of a removed block", slug: "text-diff", input: "a\nb\nc\nd\n---\na\nd", exact: " a\n-b\n-c\n d", tone: "ready" },
  { name: "keeps one-line snippets apart", slug: "text-diff", exact: "-before\n+after", tone: "ready" },
  { name: "needs both documents", slug: "text-diff", input: "only one snippet", tone: "error", title: "Two documents needed", note: /Changed editor is empty/ },
  { name: "cleans whitespace", slug: "whitespace-cleaner", input: "hello    world   \n\n\n\nnext\t\tline  ", exact: "hello world\n\nnext line", tone: "ready" },
  { name: "sorts naturally", slug: "line-sorter", input: "item10\nitem2\nItem1\nitem1", exact: "Item1\nitem1\nitem2\nitem10", tone: "ready" },
  { name: "keeps first occurrences in order", slug: "line-deduplicator", input: "b\na\nb\nc\na", exact: "b\na\nc", tone: "ready" },
  { name: "explains a pattern", slug: "regex-visualizer", input: "^(?<year>\\d{4})-(\\d{2})$", contains: ['"type": "CapturingGroup"', '"name": "year"', '"type": "Quantifier"'], tone: "ready" },
  { name: "reports an invalid pattern", slug: "regex-visualizer", input: "(", tone: "error", title: "Invalid pattern" },
  { name: "rejects catastrophic backtracking", slug: "safe-regex-tester", fields: { Pattern: "(a+)+" }, input: "aaaa", tone: "error", note: /catastrophic/ },
  { name: "finds matches safely", slug: "safe-regex-tester", fields: { Pattern: "\\b\\w+@\\w+\\.com\\b", Flags: "g" }, input: "mail a@x.com or b@y.com", contains: ['"count": 2', '"a@x.com"'], tone: "ready" },

  // ---------------------------------------------------------------- Code
  {
    name: "formats JavaScript", slug: "code-formatter",
    input: "const total=items.reduce((sum,item)=>sum+item.price,0);if(total>100){console.log('big order')}",
    contains: ["const total = items.reduce((sum, item) => sum + item.price, 0);", 'console.log("big order");'], tone: "ready"
  },
  { name: "formats CSS", slug: "code-formatter", fields: { Language: "CSS" }, input: "a{color:red;margin:0}", exact: "a {\n  color: red;\n  margin: 0;\n}\n", tone: "ready" },
  { name: "formats TypeScript", slug: "code-formatter", fields: { Language: "TypeScript" }, input: "interface User{id:number;name?:string}", exact: "interface User {\n  id: number;\n  name?: string;\n}\n", tone: "ready" },
  { name: "reports a syntax error", slug: "code-formatter", input: "const = ;", tone: "error" },
  {
    name: "flags a service with nothing to run", slug: "docker-compose-validator",
    input: 'services:\n  web:\n    image: nginx:1.27\n    ports:\n      - "8080:80"\n  worker:\n    environment:\n      - QUEUE=jobs',
    contains: ['"8080:80"', "worker: define image or build."], tone: "warning", title: "Compose file has problems"
  },
  { name: "passes a complete file", slug: "docker-compose-validator", contains: ['"image": "node:22"', '"image": "postgres:16"'], tone: "ready", title: "Compose file looks good", note: "2 services found." },
  { name: "combines stacks, any case", slug: "gitignore-generator", input: "node, macos, Rust", contains: ["node_modules/", ".DS_Store", "# Rust\ntarget/"], tone: "ready" },
  { name: "says when a stack is unknown", slug: "gitignore-generator", input: "Cobol", contains: ['No template for "Cobol"'], tone: "ready" },
  {
    name: "indents nested blocks", slug: "nginx-formatter", input: "server{listen 80;server_name example.com;location /{proxy_pass http://app:3000;}}",
    exact: "server {\n  listen 80;\n  server_name example.com;\n  location / {\n    proxy_pass http://app:3000;\n  }\n}", tone: "ready"
  },
  {
    name: "sorts and flags duplicate keys", slug: "env-formatter", input: "PORT=3000\n# local only\nAPI_URL = https://api.example.com\nDEBUG=true\nPORT=4000",
    exact: "API_URL=https://api.example.com\nDEBUG=true\nPORT=3000\nPORT=4000\n\n# Duplicate keys: PORT", tone: "warning", title: "Formatted, with duplicate keys"
  },

  // ---------------------------------------------------------------- Web
  {
    name: "builds a shell-safe command", slug: "curl-builder",
    input: `{"method":"post","url":"https://api.example.com/users","headers":{"Content-Type":"application/json"},"body":{"name":"O'Neil"}}`,
    exact: `curl -X POST -H 'Content-Type: application/json' 'https://api.example.com/users' --data-raw '{"name":"O'\\''Neil"}'`, tone: "ready"
  },
  { name: "refuses a non-HTTP URL", slug: "curl-builder", input: '{"url":"ftp://example.com"}', tone: "error", note: "Request URL must be an absolute HTTP(S) URL." },
  {
    name: "prints a query", slug: "graphql-formatter", input: "query GetUser($id:ID!){user(id:$id){name,email,posts(first:2){title}}}",
    exact: "query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n    email\n    posts(first: 2) {\n      title\n    }\n  }\n}", tone: "ready"
  },
  { name: "reports a syntax error", slug: "graphql-formatter", input: "query { user(", tone: "error", title: "Invalid GraphQL" },
  { name: "keeps repeated parameters", slug: "query-string-parser", input: "https://shop.example.com/search?q=running+shoes&size=42&color=blue&color=red", json: { q: "running shoes", size: "42", color: ["blue", "red"] }, tone: "ready" },
  { name: "parses a bare query", slug: "query-string-parser", input: "?page=2&sort=desc", json: { page: "2", sort: "desc" }, tone: "ready" },
  { name: "builds a query from JSON", slug: "query-string-parser", input: '{"q":"a b","page":2,"tags":["x","y"]}', exact: "q=a+b&page=2&tags=x&tags=y", tone: "ready" },
  { name: "explains what it accepts", slug: "query-string-parser", input: "hello there", tone: "error", note: /Enter a URL, a query string/ },
  { name: "names a status code", slug: "http-status-codes", input: "429", exact: "Too Many Requests", tone: "ready", title: "Status code found" },
  { name: "says when a code is unknown", slug: "http-status-codes", input: "299", tone: "warning", title: "Unknown status code" },
  {
    name: "breaks a URL apart", slug: "url-parser", input: "https://user@api.example.com:8443/v1/items?limit=10&tag=a&tag=b#top",
    contains: ['"host": "api.example.com:8443"', '"port": "8443"', '"pathname": "/v1/items"', '"hash": "#top"', '"limit": "10"', '"tag": [\n      "a",\n      "b"\n    ]'], tone: "ready"
  },
  { name: "rejects what is not a URL", slug: "url-parser", input: "not a url", tone: "error", note: "Enter a full URL including its scheme, such as https://example.com/path?q=1." },
  {
    name: "puts the event first", slug: "webhook-formatter",
    input: '{"data":{"object":{"amount_paid":4200}},"id":"evt_1Nx","type":"invoice.paid","created":1700000000}',
    contains: ['{\n  "summary": {\n    "type": "invoice.paid",\n    "id": "evt_1Nx",\n    "created": 1700000000\n  },\n  "payload": {'], tone: "ready"
  },
  {
    name: "builds fetch and cURL", slug: "api-request-builder",
    contains: ['fetch(\\"https://api.example.com/users\\", { method: \\"POST\\"', "curl -X POST"], tone: "ready"
  },

  // ---------------------------------------------------------------- API
  { name: "finds a MIME type from a file name", slug: "mime-type-lookup", input: "invoice.final.PDF", exact: "pdf: application/pdf", tone: "ready" },
  { name: "finds extensions from a MIME type", slug: "mime-type-lookup", input: "image/jpeg", exact: "image/jpeg: .jpg, .jpeg", tone: "ready" },
  { name: "runs its own example", slug: "mime-type-lookup", exact: "application/json: .json, .map", tone: "ready" },
  { name: "says when there is no match", slug: "mime-type-lookup", input: "xyz", tone: "warning", title: "No match" },
  {
    name: "summarises a YAML spec", slug: "openapi-viewer",
    input: "openapi: 3.0.3\ninfo:\n  title: Pets\n  version: 1.2.0\npaths:\n  /pets:\n    get: {}\n    post: {}\n  /pets/{id}:\n    delete: {}",
    contains: ['"title": "Pets"', '"endpointCount": 3', '"GET /pets"', '"POST /pets"', '"DELETE /pets/{id}"'], tone: "ready"
  },
  { name: "passes a minimal spec", slug: "openapi-validator", contains: ['"valid": true'], tone: "ready", title: "Valid OpenAPI document" },
  { name: "lists what is missing", slug: "openapi-validator", input: '{"openapi":"3.0.3","paths":{}}', contains: ['"valid": false', "info"], tone: "warning", title: "OpenAPI document has problems" },
  { name: "flags a removed response", slug: "openapi-diff", contains: ['"type": "removed-response"', '"status": "404"'], tone: "warning", title: "1 breaking change found" },

  // ---------------------------------------------------------------- Security
  {
    name: "decodes a token", slug: "jwt-decoder",
    input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    contains: ['"alg": "HS256"', '"name": "John Doe"', '"iat": 1516239022'], tone: "ready", title: "Decoded successfully"
  },
  { name: "needs three parts", slug: "jwt-decoder", input: "not.a", tone: "error", note: "A compact JWT must contain header.payload.signature." },
  { name: "hashes with SHA-256", slug: "hash-generator", input: "The quick brown fox jumps over the lazy dog", exact: "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592", tone: "ready" },
  { name: "hashes with SHA-384", slug: "hash-generator", radio: "SHA-384", input: "The quick brown fox jumps over the lazy dog", exact: "ca737f1014a48f4c0b6dd43cb177b0afd9e5169367544c494011e3317dbf9a509cb1e5dc1e85a941bbee3d7f2afbc9b1", tone: "ready" },
  { name: "hashes with SHA-512", slug: "hash-generator", radio: "SHA-512", input: "The quick brown fox jumps over the lazy dog", exact: "07e547d9586f6a73f73fbac0435ed76951218fb7d0c8d788a309d785436bbb642e93a252a954f23912547d1e8a3b5ed6e1bfd7097821233fa0538f3db854fee6", tone: "ready" },
  { name: "hashes with SHA-1", slug: "hash-generator", radio: "SHA-1", input: "The quick brown fox jumps over the lazy dog", exact: "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12", tone: "ready" },
  {
    name: "signs a payload", slug: "jwt-hmac-signer", fields: { "HMAC secret": "s3cret" }, input: '{"sub":"42","role":"admin"}',
    exact: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInJvbGUiOiJhZG1pbiJ9.VJC0w9_pXIl5W2vaeUwcHZAhSYahCMSeONYyK4n5Sn4", tone: "ready", title: "Signed successfully"
  },
  {
    name: "verifies with the right secret", slug: "jwt-hmac-signer", radio: "Verify", fields: { "HMAC secret": "s3cret" },
    input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInJvbGUiOiJhZG1pbiJ9.VJC0w9_pXIl5W2vaeUwcHZAhSYahCMSeONYyK4n5Sn4",
    contains: ['"valid": true'], tone: "ready", title: "Signature is valid"
  },
  {
    name: "rejects the wrong secret", slug: "jwt-hmac-signer", radio: "Verify", fields: { "HMAC secret": "guess" },
    input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInJvbGUiOiJhZG1pbiJ9.VJC0w9_pXIl5W2vaeUwcHZAhSYahCMSeONYyK4n5Sn4",
    contains: ['"valid": false'], tone: "warning", title: "Signature does not match"
  },
  { name: "reads a certificate", slug: "certificate-decoder", contains: ['"type": "CERTIFICATE"', "example.utilfoundry.test", '"notAfter"'], tone: "ready" },
  { name: "needs a whole PEM block", slug: "certificate-decoder", input: "MIIDYTCC", tone: "error", note: /complete PEM block/ },
  { name: "identifies a public key", slug: "pem-inspector", input: CERT_PUBLIC_KEY, contains: ['"type": "PUBLIC KEY"', '"bytes": 91'], tone: "ready" },
  { name: "verifies its own example", slug: "jwt-rs256-verifier", contains: ['"valid": true'], tone: "ready", title: "Signature is valid" },
  {
    name: "masks every kind of secret in a log line", slug: "log-secret-redactor",
    input: "2024-05-01 ERROR login failed authorization: Bearer eyJabc.def.ghi user=asha@example.com api_key=sk_live_123 aws=AKIAABCDEFGHIJKLMNOP card=4111 1111 1111 1111",
    contains: ["authorization: Bearer [REDACTED]", "[REDACTED_EMAIL]", "api_key=[REDACTED]", "[REDACTED_AWS_KEY]", "[REDACTED_CARD]"],
    absent: ["asha@example.com", "sk_live_123", "AKIAABCDEFGHIJKLMNOP", "4111 1111"], tone: "ready", title: /Redacted 5 kinds of secret/
  },
  { name: "says when nothing needed masking", slug: "log-secret-redactor", input: "GET /health 200 3ms", tone: "warning", title: "Nothing redacted" },
  { name: "generates a password of the chosen length", slug: "password-generator", fields: { Length: "32" }, contains: [/^[A-HJ-NP-Za-km-z2-9!@#$%^&*_-]{32}$/], tone: "ready" },
  { name: "caps the length at 128", slug: "password-generator", fields: { Length: "500" }, contains: [/^\S{128}$/], tone: "ready" },

  // ---------------------------------------------------------------- Payments
  { name: "encodes text as hex bytes", slug: "hex-encoder", input: "Hi €", contains: ['"hexSpaced": "48 69 20 E2 82 AC"', '"byteLength": 6'], tone: "ready" },
  { name: "decodes hex bytes", slug: "hex-encoder", radio: "Hex → text", input: "48 65 6C 6C 6F", contains: ['"text": "Hello"'], tone: "ready" },
  { name: "rejects non-hex", slug: "hex-encoder", radio: "Hex → text", input: "4G", tone: "error", note: /hexadecimal/ },
  { name: "packs with an F filler", slug: "bcd-encoder", input: "12345", exact: "12 34 5F", tone: "ready", title: "Packed successfully" },
  { name: "packs with a leading zero", slug: "bcd-encoder", radio: "Pack (leading 0)", input: "12345", exact: "01 23 45", tone: "ready" },
  { name: "unpacks", slug: "bcd-encoder", radio: "Unpack", input: "12 34 5F", exact: "12345", tone: "ready" },
  { name: "rejects a misplaced filler", slug: "bcd-encoder", radio: "Unpack", input: "1F 23", tone: "error", note: /trailing F nibble/ },
  { name: "decodes host bytes", slug: "ebcdic-decoder", input: "C8 C5 D3 D3 D6 40 E6 D6 D9 D3 C4", exact: "HELLO WORLD", tone: "ready" },
  { name: "expands a bitmap", slug: "iso-8583-bitmap", input: "7220000000000000", contains: ['"enabledDataElements": [\n    2,\n    3,\n    4,\n    7,\n    11\n  ]'], tone: "ready" },
  { name: "needs the secondary half", slug: "iso-8583-bitmap", input: "F220000000000000", tone: "error", note: /secondary half/ },
  { name: "reads a message with a masked PAN", slug: "iso-8583-inspector", contains: ['"mti": "0200"', "411111••••••1111"], absent: ["4111111111111111"], tone: "ready" },
  { name: "parses nested TLV", slug: "emv-tlv-parser", input: "9F2608A1B2C3D4E5F60708 9F270180", contains: ['"tag": "9F26"', '"length": 8', '"tag": "9F27"', '"value": "80"'], tone: "ready" },
  { name: "reports a short value", slug: "emv-tlv-parser", input: "9F2608A1B2", tone: "error", note: /declares 8 bytes/ },
  { name: "passes a test card", slug: "luhn-pan-check", input: "4111 1111 1111 1111", contains: ['"valid": true', '"masked": "411111••••••1111"'], tone: "ready", title: "Passes the Luhn check" },
  { name: "fails a mistyped card", slug: "luhn-pan-check", input: "4111 1111 1111 1112", contains: ['"valid": false'], tone: "warning", title: "Fails the Luhn check", note: "For this number the check digit should be 1." },
  { name: "splits Track 2", slug: "track-2-inspector", input: ";4111111111111111=25121010000000000000?", contains: ['"pan": "411111••••••1111"', '"expiryYYMM": "2512"', '"serviceCode": "101"'], tone: "ready" },
  { name: "explains the format", slug: "track-2-inspector", input: "4111", tone: "error", note: /PAN=YYMM/ },

  // ---------------------------------------------------------------- Generators, time, data
  { name: "explains a weekday schedule", slug: "cron-explainer", input: "0 9 * * 1-5", contains: [/"nextRuns": \[(\s*"\d{4}-\d{2}-\d{2}T09:00:00\.000Z",?){5}\s*\]/], tone: "ready" },
  { name: "rejects an impossible minute", slug: "cron-explainer", input: "61 * * * *", tone: "error" },
  { name: "compares versions numerically", slug: "version-comparator", input: "1.10.0 1.9.3", contains: ['"relation": "left is newer"'], tone: "ready" },
  { name: "orders prereleases first", slug: "version-comparator", input: "2.0.0-rc.1 2.0.0", contains: ['"relation": "right is newer"'], tone: "ready" },
  { name: "rejects a non-semver version", slug: "version-comparator", input: "1.0 2.0", tone: "error", note: /Invalid Version/ },
  { name: "reads a local date as UTC here", slug: "iso-date-converter", input: "2024-02-29 10:30", exact: "2024-02-29T10:30:00.000Z", tone: "ready" },
  { name: "applies a written offset", slug: "iso-date-converter", input: "2024-02-29T10:30:00+05:30", exact: "2024-02-29T05:00:00.000Z", tone: "ready" },
  { name: "refuses 29 February in a common year", slug: "iso-date-converter", input: "2023-02-29", tone: "error", note: /February 2023 has 28 days/ },
  { name: "shows New York time", slug: "timezone-converter", fields: { Timezone: "America/New_York" }, input: "2024-07-04T12:00:00Z", contains: ["4 July 2024", "08:00:00"], tone: "ready" },
  { name: "rejects an unknown zone", slug: "timezone-converter", fields: { Timezone: "Mars/Base" }, input: "2024-07-04T12:00:00Z", tone: "error", note: /time zone/i },
  { name: "summarises rows and columns", slug: "csv-viewer", input: "id,name,role\n1,Asha,admin\n2,Lee,dev\n3,Sam,ops", contains: ['"columns": 3', '"rows": 3', '"role"'], tone: "ready" }
];

for (const testCase of CASES) {
  test(`${testCase.slug}: ${testCase.name}`, async ({ page }) => {
    const tool = await openTool(page, testCase.slug);
    if (testCase.radio) await choose(page, testCase.radio);
    for (const [label, value] of Object.entries(testCase.fields ?? {})) await setField(page, label, value);
    if (testCase.input !== undefined) await setInput(page, tool, testCase.input);
    await run(page);

    await expectTone(page, testCase.tone);
    if (testCase.title) await expect(banner(page).locator("strong")).toHaveText(testCase.title);
    if (testCase.note) await expect(banner(page)).toContainText(testCase.note);
    if (testCase.tone === "error") return;

    const output = await readOutput(page, tool);
    if (testCase.exact !== undefined) expect(output).toBe(testCase.exact);
    if (testCase.json !== undefined) expect(JSON.parse(output)).toEqual(testCase.json);
    for (const expected of testCase.contains ?? []) {
      if (typeof expected === "string") expect(output).toContain(expected);
      else expect(output).toMatch(expected);
    }
    for (const unexpected of testCase.absent ?? []) expect(output).not.toContain(unexpected);
  });
}

test("every tool has at least one real-world case here", () => {
  const covered = new Set(CASES.map((testCase) => testCase.slug));
  const special = new Set(["uuid-generator", "markdown-preview", "image-to-base64", "qr-generator"]);
  const missing = TOOLS.filter((tool) => !covered.has(tool.slug) && !special.has(tool.slug)).map((tool) => tool.slug);
  expect(missing).toEqual([]);
});

// ------------------------------------------------------------------ Tools with a non-text result

test("uuid-generator: a fresh RFC 4122 v4 UUID on every run", async ({ page }) => {
  const tool = await openTool(page, "uuid-generator");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  // A generator has nothing to wait for, so the page opens with a value already made.
  await expect(page.getByLabel(`${tool.name} output`, { exact: true })).toHaveValue(uuid);
  await run(page);
  const first = await readOutput(page, tool);
  expect(first).toMatch(uuid);
  await run(page);
  const second = await readOutput(page, tool);
  expect(second).toMatch(uuid);
  expect(second).not.toBe(first);
});

test("password-generator: two runs never repeat and avoid look-alike characters", async ({ page }) => {
  const tool = await openTool(page, "password-generator");
  await run(page);
  const first = await readOutput(page, tool);
  await run(page);
  const second = await readOutput(page, tool);
  expect(first).toHaveLength(24);
  expect(second).not.toBe(first);
  expect(first + second).not.toMatch(/[IOl01]/);
  await expect(page.locator(".strength")).toContainText("Very strong");

  // Changing the length is the whole question for a generator, so it answers straight away.
  await setField(page, "Length", "40");
  await expect(page.getByLabel(`${tool.name} output`, { exact: true })).toHaveValue(/^.{40}$/);
});

test("markdown-preview: renders Markdown and strips scripts and handlers", async ({ page }) => {
  const tool = await openTool(page, "markdown-preview");
  await setInput(page, tool, "# Release notes\n\n- **Fast** start\n- `code` sample\n\n<script>window.pwned=1</script><img src=x onerror=\"window.pwned=2\">");
  await run(page);
  const preview = page.getByLabel(`${tool.name} output`, { exact: true });
  await expect(preview.getByRole("heading", { level: 1, name: "Release notes" })).toBeVisible();
  await expect(preview.locator("strong")).toHaveText("Fast");
  await expect(preview.locator("code")).toHaveText("code");
  await expect(preview.locator("script")).toHaveCount(0);
  expect(await preview.locator("img").getAttribute("onerror")).toBeNull();
  expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
});

test("image-to-base64: reads a chosen PNG and reports its type and size", async ({ page }) => {
  const tool = await openTool(page, "image-to-base64");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose image" }).click();
  await (await chooser).setFiles({ name: "pixel.png", mimeType: "image/png", buffer: png });
  await expect(page.getByLabel(`${tool.name} input`, { exact: true })).toHaveValue(/^data:image\/png;base64,iVBOR/);
  await run(page);
  const output = JSON.parse(await readOutput(page, tool));
  expect(output).toMatchObject({ mime: "image/png", base64Bytes: 70 });
});

test("image-to-base64: turns a raw Base64 payload into a data URL", async ({ page }) => {
  const tool = await openTool(page, "image-to-base64");
  await setInput(page, tool, "iVBORw0KGgo=");
  await run(page);
  expect(await readOutput(page, tool)).toBe("data:image/png;base64,iVBORw0KGgo=");
});

test("qr-generator: draws a scannable-size PNG and downloads it", async ({ page }) => {
  const tool = await openTool(page, "qr-generator");
  await setInput(page, tool, "https://utilfoundry.com/tools");
  await run(page);
  const image = page.getByRole("img", { name: "Generated QR code" });
  await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("qr-generator-output.png");
});

test("unix-timestamp-converter: an empty field gives the current time", async ({ page }) => {
  const tool = await openTool(page, "unix-timestamp-converter");
  await setInput(page, tool, "");
  const before = Date.now();
  await run(page);
  const output = JSON.parse(await readOutput(page, tool));
  expect(Math.abs(output.unixMilliseconds - before)).toBeLessThan(10_000);
});

test("jwt-hmac-signer: a token it signs verifies with the same secret", async ({ page }) => {
  const tool = await openTool(page, "jwt-hmac-signer");
  await setField(page, "HMAC secret", "correct horse battery staple");
  await setInput(page, tool, '{"sub":"user-7","scope":"read"}');
  await run(page);
  const token = await readOutput(page, tool);
  expect(token.split(".")).toHaveLength(3);
  await setInput(page, tool, token);
  await choose(page, "Verify");
  await expect(banner(page).locator("strong")).toHaveText("Signature is valid");
});

test("jwt-rs256-verifier: a payload swapped under a valid signature does not verify", async ({ page }) => {
  const tool = await openTool(page, "jwt-rs256-verifier");
  const token = await page.getByLabel(`${tool.name} Token`, { exact: true }).inputValue();
  const jwk = await page.getByLabel(`${tool.name} JWK public key`, { exact: true }).inputValue();
  const [header, , signature] = token.split(".");
  const forged = `${header}.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4OTAwMDAwMH0.${signature}`;
  await setInput(page, tool, `${forged}\n---\n${jwk}`);
  await run(page);
  await expectTone(page, "warning");
  await expect(banner(page).locator("strong")).toHaveText("Signature does not match");
  await expect(runButton(page)).toBeEnabled();
});
