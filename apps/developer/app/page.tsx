"use client";
/* QR data URLs are generated locally and intentionally rendered as a native image. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { load as parseYaml, dump as dumpYaml } from "js-yaml";
import Papa from "papaparse";
import {
  buildApiRequest,
  cleanWhitespace,
  compareVersions,
  convertTimezone,
  decodeAsn1,
  decodeProtobuf,
  decodePem,
  dedupeLines,
  diffJson,
  diffOpenApi,
  diffText,
  explainCron,
  explainRegex,
  extractJsonPath,
  formatCode,
  formatXmlDocument,
  formatEnv,
  formatGraphql,
  formatSql,
  formatNginx,
  renderMarkdown,
  convertNumber,
  convertColor,
  generateGitignore,
  generateJsonSchema,
  generatePassword,
  generateQr,
  imageToBase64,
  lookupMime,
  parseUrl,
  redactSecrets,
  safeRegexTest,
  signJwtHmac,
  sortLines,
  summarizeCsv,
  summarizeOpenApi,
  validateCompose,
  validateJson,
  validateOpenApi,
  validateSchema,
  validateXml,
  verifyJwtHmac,
  verifyJwtRsa,
  formatWebhook,
} from "../lib/extra-tools";
import {
  binaryToHex,
  decodeBcd,
  decodeEbcdic,
  decodeHex,
  encodeBcd,
  encodeHex,
  hexToBinary,
  luhn,
  parseBitmap,
  parseEmvTlv,
  parseIso8583,
  parseTrack2,
} from "../lib/payments-tools";
import {
  ArrowRight,
  Braces,
  Check,
  Clock3,
  Code2,
  Copy,
  Hash,
  KeyRound,
  Menu,
  Globe2,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Type,
  X,
} from "lucide-react";

type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: typeof Braces;
  phase: 1 | 2;
  accent: string;
};

const tools: Tool[] = [
  {
    id: "json",
    name: "JSON Formatter",
    description: "Format, validate and minify JSON",
    category: "Format & validate",
    icon: Braces,
    phase: 1,
    accent: "violet",
  },
  {
    id: "base64",
    name: "Base64 Encoder",
    description: "Encode and decode text privately",
    category: "Encode & decode",
    icon: Code2,
    phase: 1,
    accent: "blue",
  },
  {
    id: "url",
    name: "URL Encoder",
    description: "Safely encode URL components",
    category: "Encode & decode",
    icon: ArrowRight,
    phase: 1,
    accent: "cyan",
  },
  {
    id: "jwt",
    name: "JWT Decoder",
    description: "Inspect a token locally",
    category: "Security",
    icon: KeyRound,
    phase: 1,
    accent: "amber",
  },
  {
    id: "hash",
    name: "Hash Generator",
    description: "Create SHA-256 and SHA-1 hashes",
    category: "Security",
    icon: Hash,
    phase: 1,
    accent: "rose",
  },
  {
    id: "uuid",
    name: "UUID Generator",
    description: "Generate cryptographically strong UUIDs",
    category: "Generators",
    icon: Sparkles,
    phase: 1,
    accent: "green",
  },
  {
    id: "timestamp",
    name: "Unix Timestamp",
    description: "Convert dates and timestamps",
    category: "Converters",
    icon: Clock3,
    phase: 1,
    accent: "orange",
  },
  {
    id: "regex",
    name: "Regex Tester",
    description: "Test patterns with live matches",
    category: "Text",
    icon: Terminal,
    phase: 2,
    accent: "indigo",
  },
  {
    id: "markdown",
    name: "Markdown Preview",
    description: "Write and preview Markdown",
    category: "Text",
    icon: Type,
    phase: 2,
    accent: "slate",
  },
  {
    id: "yaml",
    name: "YAML ↔ JSON",
    description: "Convert configuration formats",
    category: "Format & validate",
    icon: Braces,
    phase: 2,
    accent: "teal",
  },
  {
    id: "curl",
    name: "cURL Builder",
    description: "Build requests from method and headers",
    category: "Web",
    icon: Terminal,
    phase: 2,
    accent: "pink",
  },
  {
    id: "diff",
    name: "Text Diff",
    description: "Compare two text snippets",
    category: "Text",
    icon: Code2,
    phase: 2,
    accent: "lime",
  },
  {
    id: "xml",
    name: "XML Formatter",
    description: "Format and inspect XML documents",
    category: "Format & validate",
    icon: Braces,
    phase: 2,
    accent: "blue",
  },
  {
    id: "csv",
    name: "CSV ↔ JSON",
    description: "Convert tabular data instantly",
    category: "Converters",
    icon: Code2,
    phase: 2,
    accent: "green",
  },
  {
    id: "html",
    name: "HTML Escape",
    description: "Escape or unescape HTML entities",
    category: "Encode & decode",
    icon: Type,
    phase: 2,
    accent: "orange",
  },
  {
    id: "sql",
    name: "SQL Formatter",
    description: "Make SQL readable and consistent",
    category: "Format & validate",
    icon: Terminal,
    phase: 2,
    accent: "indigo",
  },
  {
    id: "graphql",
    name: "GraphQL Formatter",
    description: "Format queries and mutations",
    category: "Web",
    icon: Code2,
    phase: 2,
    accent: "pink",
  },
  {
    id: "query",
    name: "Query String Parser",
    description: "Parse and build URL parameters",
    category: "Web",
    icon: ArrowRight,
    phase: 2,
    accent: "cyan",
  },
  {
    id: "number",
    name: "Base Converter",
    description: "Convert binary, decimal and hex",
    category: "Converters",
    icon: Hash,
    phase: 2,
    accent: "violet",
  },
  {
    id: "color",
    name: "Color Converter",
    description: "Convert HEX, RGB and HSL",
    category: "Converters",
    icon: Sparkles,
    phase: 2,
    accent: "rose",
  },
  {
    id: "status",
    name: "HTTP Status Codes",
    description: "Look up HTTP meanings quickly",
    category: "Web",
    icon: ShieldCheck,
    phase: 2,
    accent: "slate",
  },
  {
    id: "cron",
    name: "Cron Explainer",
    description: "Explain five-field cron schedules",
    category: "Generators",
    icon: Clock3,
    phase: 2,
    accent: "teal",
  },
  {
    id: "json-validator",
    name: "JSON Validator",
    description: "Validate JSON and inspect its type",
    category: "Format & validate",
    icon: Braces,
    phase: 1,
    accent: "violet",
  },
  {
    id: "json-minifier",
    name: "JSON Minifier",
    description: "Minify JSON for transport",
    category: "Format & validate",
    icon: Braces,
    phase: 1,
    accent: "blue",
  },
  {
    id: "jsonpath",
    name: "JSONPath Extractor",
    description: "Extract nested values with JSONPath",
    category: "JSON",
    icon: Braces,
    phase: 1,
    accent: "cyan",
  },
  {
    id: "json-diff",
    name: "JSON Diff",
    description: "Compare two JSON documents",
    category: "JSON",
    icon: Code2,
    phase: 1,
    accent: "indigo",
  },
  {
    id: "xml-validator",
    name: "XML Validator",
    description: "Validate XML syntax locally",
    category: "Format & validate",
    icon: Braces,
    phase: 1,
    accent: "blue",
  },
  {
    id: "yaml-formatter",
    name: "YAML Formatter",
    description: "Normalize YAML configuration",
    category: "Format & validate",
    icon: Braces,
    phase: 1,
    accent: "teal",
  },
  {
    id: "password",
    name: "Password Generator",
    description: "Generate strong passwords locally",
    category: "Security",
    icon: KeyRound,
    phase: 1,
    accent: "rose",
  },
  {
    id: "whitespace",
    name: "Whitespace Cleaner",
    description: "Normalize spaces and blank lines",
    category: "Text",
    icon: Type,
    phase: 1,
    accent: "slate",
  },
  {
    id: "line-sort",
    name: "Line Sorter",
    description: "Sort lines naturally or alphabetically",
    category: "Text",
    icon: Type,
    phase: 1,
    accent: "orange",
  },
  {
    id: "line-dedupe",
    name: "Line Deduplicator",
    description: "Remove duplicate lines",
    category: "Text",
    icon: Type,
    phase: 1,
    accent: "green",
  },
  {
    id: "iso-date",
    name: "ISO Date Converter",
    description: "Convert dates to ISO 8601",
    category: "Time",
    icon: Clock3,
    phase: 1,
    accent: "orange",
  },
  {
    id: "timezone",
    name: "Timezone Converter",
    description: "Render a date in any timezone",
    category: "Time",
    icon: Clock3,
    phase: 1,
    accent: "amber",
  },
  {
    id: "url-parser",
    name: "URL Parser",
    description: "Inspect every URL component",
    category: "Web",
    icon: ArrowRight,
    phase: 1,
    accent: "cyan",
  },
  {
    id: "code-formatter",
    name: "Code Formatter",
    description: "Format JSON, HTML, CSS and JS",
    category: "Code",
    icon: Code2,
    phase: 1,
    accent: "indigo",
  },
  {
    id: "csv-viewer",
    name: "CSV Viewer",
    description: "Inspect rows and columns quickly",
    category: "Data",
    icon: Code2,
    phase: 1,
    accent: "green",
  },
  {
    id: "mime",
    name: "MIME Type Lookup",
    description: "Find a file's content type",
    category: "API",
    icon: Globe2,
    phase: 1,
    accent: "slate",
  },
  {
    id: "openapi-viewer",
    name: "OpenAPI Viewer",
    description: "Summarize endpoints and metadata",
    category: "API",
    icon: Code2,
    phase: 1,
    accent: "pink",
  },
  {
    id: "openapi-validator",
    name: "OpenAPI Validator",
    description: "Check required OpenAPI fields",
    category: "API",
    icon: ShieldCheck,
    phase: 2,
    accent: "pink",
  },
  {
    id: "json-schema",
    name: "JSON Schema Validator",
    description: "Validate JSON against a schema",
    category: "Format & validate",
    icon: ShieldCheck,
    phase: 2,
    accent: "violet",
  },
  {
    id: "regex-visualizer",
    name: "Regex Visualizer",
    description: "Break a pattern into readable tokens",
    category: "Text",
    icon: Terminal,
    phase: 2,
    accent: "indigo",
  },
  {
    id: "docker-compose",
    name: "Docker Compose Validator",
    description: "Inspect services in a Compose file",
    category: "Code",
    icon: Terminal,
    phase: 2,
    accent: "blue",
  },
  {
    id: "gitignore",
    name: ".gitignore Generator",
    description: "Generate starter ignore rules",
    category: "Code",
    icon: Code2,
    phase: 2,
    accent: "slate",
  },
  {
    id: "nginx",
    name: "Nginx Formatter",
    description: "Format Nginx configuration",
    category: "Code",
    icon: Terminal,
    phase: 2,
    accent: "green",
  },
  {
    id: "jwt-sign",
    name: "JWT HMAC Signer",
    description: "Sign and verify HS256 tokens locally",
    category: "Security",
    icon: KeyRound,
    phase: 2,
    accent: "amber",
  },
  {
    id: "cert",
    name: "Certificate Decoder",
    description: "Inspect PEM certificate metadata",
    category: "Security",
    icon: ShieldCheck,
    phase: 2,
    accent: "rose",
  },
  {
    id: "pem",
    name: "PEM Inspector",
    description: "Identify PEM block types and size",
    category: "Security",
    icon: KeyRound,
    phase: 2,
    accent: "rose",
  },
  {
    id: "webhook",
    name: "Webhook Formatter",
    description: "Pretty-print webhook payloads",
    category: "Web",
    icon: Code2,
    phase: 2,
    accent: "pink",
  },
  {
    id: "api-request",
    name: "API Request Builder",
    description: "Create fetch and cURL requests",
    category: "Web",
    icon: Terminal,
    phase: 2,
    accent: "cyan",
  },
  {
    id: "image-base64",
    name: "Image to Base64",
    description: "Inspect an image data URL locally",
    category: "Converters",
    icon: Code2,
    phase: 2,
    accent: "orange",
  },
  {
    id: "qr",
    name: "QR Generator",
    description: "Generate a QR image locally",
    category: "Generators",
    icon: Sparkles,
    phase: 2,
    accent: "violet",
  },
  {
    id: "semver",
    name: "Version Comparator",
    description: "Compare semantic versions",
    category: "Generators",
    icon: Hash,
    phase: 2,
    accent: "lime",
  },
  {
    id: "env",
    name: "Environment Formatter",
    description: "Normalize and sort env variables",
    category: "Code",
    icon: Terminal,
    phase: 2,
    accent: "teal",
  },
  {
    id: "openapi-diff",
    name: "OpenAPI Diff",
    description: "Detect potentially breaking API changes",
    category: "API",
    icon: ShieldCheck,
    phase: 2,
    accent: "pink",
  },
  {
    id: "json-schema-generator",
    name: "JSON Schema Generator",
    description: "Generate a draft schema from JSON",
    category: "JSON",
    icon: Braces,
    phase: 2,
    accent: "violet",
  },
  {
    id: "jwt-rsa",
    name: "JWT RS256 Verifier",
    description: "Verify JWTs with a local JWK",
    category: "Security",
    icon: KeyRound,
    phase: 2,
    accent: "amber",
  },
  {
    id: "log-redactor",
    name: "Log Secret Redactor",
    description: "Remove common secrets from logs",
    category: "Security",
    icon: ShieldCheck,
    phase: 2,
    accent: "rose",
  },
  {
    id: "protobuf",
    name: "Protobuf Wire Decoder",
    description: "Inspect protobuf bytes without a schema",
    category: "Encoding",
    icon: Braces,
    phase: 2,
    accent: "blue",
  },
  {
    id: "asn1",
    name: "ASN.1 DER Inspector",
    description: "Inspect DER TLV structure locally",
    category: "Encoding",
    icon: Braces,
    phase: 2,
    accent: "orange",
  },
  {
    id: "regex-safe",
    name: "Safe Regex Tester",
    description: "Test patterns with abuse safeguards",
    category: "Text",
    icon: Terminal,
    phase: 2,
    accent: "indigo",
  },
  {
    id: "hex",
    name: "Hex Encoder / Decoder",
    description: "Convert text and protocol hexadecimal bytes",
    category: "Payments",
    icon: Hash,
    phase: 1,
    accent: "blue",
  },
  {
    id: "binary",
    name: "Binary / Bitfield",
    description: "Inspect binary values and bits",
    category: "Encoding",
    icon: Hash,
    phase: 1,
    accent: "indigo",
  },
  {
    id: "bcd",
    name: "BCD Encoder / Decoder",
    description: "Pack and unpack numeric BCD",
    category: "Payments",
    icon: Hash,
    phase: 2,
    accent: "amber",
  },
  {
    id: "ebcdic",
    name: "EBCDIC Decoder",
    description: "Decode common host bytes locally",
    category: "Payments",
    icon: Code2,
    phase: 2,
    accent: "teal",
  },
  {
    id: "iso-bitmap",
    name: "ISO 8583 Bitmap",
    description: "Show enabled data elements",
    category: "Payments",
    icon: Braces,
    phase: 2,
    accent: "violet",
  },
  {
    id: "iso8583",
    name: "ISO 8583 Inspector",
    description: "Inspect MTI, bitmap and fields",
    category: "Payments",
    icon: ShieldCheck,
    phase: 2,
    accent: "pink",
  },
  {
    id: "emv-tlv",
    name: "EMV TLV Parser",
    description: "Parse BER-TLV payment tags",
    category: "Payments",
    icon: Braces,
    phase: 2,
    accent: "orange",
  },
  {
    id: "luhn",
    name: "Luhn / PAN Check",
    description: "Validate and mask account numbers",
    category: "Payments",
    icon: ShieldCheck,
    phase: 2,
    accent: "rose",
  },
  {
    id: "track2",
    name: "Track 2 Inspector",
    description: "Parse masked Track 2 data",
    category: "Payments",
    icon: ShieldCheck,
    phase: 2,
    accent: "rose",
  },
];

const starterValues: Record<string, string> = {
  json: '{"project":"UtilFoundry","private":true,"tools":["json","jwt"]}',
  base64: "UtilFoundry developer tools",
  url: "https://utilfoundry.com/tools?q=hello world",
  jwt: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwicm9sZSI6ImRldmVsb3BlciJ9.",
  hash: "Hash this text locally",
  uuid: "",
  timestamp: "",
  regex: "The quick brown fox jumps over the lazy dog.",
  markdown: "# Hello, developer\n\nWrite Markdown and see a **live preview**.",
  yaml: "name: UtilFoundry\nprivate: true\ntools:\n  - json\n  - jwt",
  curl: '{"method":"GET","url":"https://api.example.com/users"}',
  diff: "before\n---\nafter",
  xml: "<project><name>UtilFoundry</name><private>true</private></project>",
  csv: "name,phase,private\nJSON,1,true\nJWT,1,true",
  html: '<section class="hero">UtilFoundry & tools</section>',
  sql: "select id, email from users where active = true order by created_at desc;",
  graphql: "query User($id: ID!) { user(id: $id) { id email } }",
  query: "https://utilfoundry.com/tools?category=security&phase=1&private=true",
  number: "255",
  color: "#4263EB",
  status: "404",
  cron: "*/15 9-17 * * 1-5",
  "json-validator": '{"ok":true}',
  "json-minifier": '{\n  "ok": true,\n  "items": [1, 2, 3]\n}',
  jsonpath: '{"user":{"name":"Asha","roles":["admin"]}}',
  "json-diff": '{"name":"before"}\n---\n{"name":"after","active":true}',
  "xml-validator": "<root><item>Valid</item></root>",
  "yaml-formatter": "name: UtilFoundry\nprivate: true\ntools:\n  - json\n  - jwt",
  password: "",
  whitespace: "hello   world\n\n\nnext line  ",
  "line-sort": "zebra\napple\nBanana\napple",
  "line-dedupe": "apple\nbanana\napple\ncarrot",
  "iso-date": "2026-09-05 14:30",
  timezone: "2026-09-05T14:30:00Z",
  "url-parser": "https://api.utilfoundry.com:443/v1/users?active=true#top",
  "code-formatter": "function hello(name){return {message:'Hello '+name};}",
  "csv-viewer": "name,role\nAsha,admin\nDev,member",
  mime: "application/json",
  "openapi-viewer":
    '{"openapi":"3.0.3","info":{"title":"Demo API","version":"1.0.0"},"paths":{"/users":{"get":{}}}}',
  "openapi-validator":
    '{"openapi":"3.0.3","info":{"title":"Demo API","version":"1.0.0"},"paths":{}}',
  "json-schema": '{"name":"Asha","age":30}',
  "regex-visualizer": "^(?<user>[a-z]+)@(example\\.com)$",
  "docker-compose":
    "services:\n  api:\n    image: node:22\n  db:\n    image: postgres:16",
  gitignore: "Node, macOS",
  nginx: "server { listen 80; location / { proxy_pass http://api; } }",
  "jwt-sign": '{"sub":"user-123","role":"developer"}',
  cert: "",
  pem: "",
  webhook: '{"event":"deployment.completed","id":"evt_123"}',
  "api-request":
    '{"method":"POST","url":"https://api.example.com/users","headers":{"content-type":"application/json"},"body":{"name":"Asha"}}',
  "image-base64": "data:image/svg+xml;base64,PHN2Zy8+",
  qr: "https://utilfoundry.com",
  semver: "1.4.0 1.3.9",
  env: "PORT=3000\nNODE_ENV=production\n# comment\nAPI_URL=https://api.example.com",
  "openapi-diff":
    '{"openapi":"3.0.3","info":{"title":"Demo","version":"1"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"},"404":{"description":"missing"}}}}}}\n---\n{"openapi":"3.0.3","info":{"title":"Demo","version":"2"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"}}}}}}',
  "json-schema-generator": '{"name":"Asha","age":30,"active":true}',
  "jwt-rsa": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature\n---\n{\"kty\":\"RSA\",\"n\":\"\",\"e\":\"AQAB\"}",
  "log-redactor": "INFO authorization: Bearer eyJhbGciOiJub25lIn0.secret\nuser email=a@example.com api_key=sk_live_example",
  protobuf: "08 96 01 12 05 48 65 6C 6C 6F",
  asn1: "30 0A 02 01 05 04 05 48 65 6C 6C 6F",
  "regex-safe": "aaaaaaaaaaaaaaaaaaaaaaaa",
  hex: "UtilFoundry payments",
  binary: "4A 53 4F 4E",
  bcd: "1234567890",
  ebcdic: "C1 C2 C3 40 F1 F2 F3",
  "iso-bitmap": "7220000000000000",
  iso8583:
    "MTI=0200\nBITMAP=7220000000000000\n2=411111******1111\n3=000000\n4=000000001000",
  "emv-tlv": "9F2608A1B2C3D4E5F60708 9F270180 9F100706010A03A00000",
  luhn: "4111111111111111",
  track2: "411111******1111=25122010000012345678",
};

function prettyJson(value: string) {
  return JSON.stringify(JSON.parse(value), null, 2);
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Utf8(value: string) {
  const compact = value.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(compact) || compact.length % 4 === 1)
    throw new Error("Input is not valid Base64.");
  const normalized = compact
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(compact.length / 4) * 4, "=");
  const binary = atob(normalized);
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

function parseCsv(value: string) {
  const parsed = Papa.parse<Record<string, string>>(value, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  if (!parsed.data.length)
    throw new Error("CSV needs a header row and at least one data row.");
  return parsed.data;
}

function jsonToCsv(value: string) {
  const rows = JSON.parse(value);
  if (!Array.isArray(rows) || !rows.length || typeof rows[0] !== "object")
    throw new Error("Enter a JSON array of objects.");
  return Papa.unparse(rows);
}

const statusCodes: Record<string, string> = {
  "100": "Continue",
  "101": "Switching Protocols",
  "103": "Early Hints",
  "200": "OK — request succeeded",
  "201": "Created — resource created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content — succeeded without a body",
  "205": "Reset Content",
  "206": "Partial Content",
  "301": "Moved Permanently",
  "302": "Found — temporary redirect",
  "304": "Not Modified",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized — authentication required",
  "403": "Forbidden — server understood but refuses",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "412": "Precondition Failed",
  "415": "Unsupported Media Type",
  "418": "I'm a teapot",
  "421": "Misdirected Request",
  "422": "Unprocessable Content",
  "425": "Too Early",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "431": "Request Header Fields Too Large",
  "429": "Too Many Requests",
  "451": "Unavailable For Legal Reasons",
  "500": "Internal Server Error",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "507": "Insufficient Storage",
  "511": "Network Authentication Required",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ] ?? char,
  );
}

function detectSensitiveInput(value: string) {
  const findings: string[] = [];
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value))
    findings.push("private key");
  if (/(?:AKIA|ASIA)[A-Z0-9]{16}/.test(value)) findings.push("AWS access key");
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value))
    findings.push("JWT");
  if (/\b(?:\d[ -]*?){13,19}\b/.test(value)) findings.push("card-like number");
  return findings;
}

function getRequestedToolId() {
  if (typeof window === "undefined") return "json";
  const requestedTool = new URLSearchParams(window.location.search).get("tool");
  return requestedTool && tools.some((tool) => tool.id === requestedTool)
    ? requestedTool
    : "json";
}

export default function Home() {
  const [selectedId, setSelectedId] = useState(getRequestedToolId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All tools");
  const [input, setInput] = useState(
    () => starterValues[getRequestedToolId()] ?? starterValues.json,
  );
  const [output, setOutput] = useState("");
  const [notice, setNotice] = useState("");
  const [option, setOption] = useState("encode");
  const [pattern, setPattern] = useState("\\b[A-Z][a-z]+\\b");
  const [flags, setFlags] = useState("g");
  const [secret, setSecret] = useState("change-me-locally");
  const [securityWarning, setSecurityWarning] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const workspaceFileRef = useRef<HTMLInputElement>(null);
  const selected = tools.find((tool) => tool.id === selectedId) ?? tools[0];

  const categories = [
    "All tools",
    ...Array.from(new Set(tools.map((tool) => tool.category))),
  ];
  const filteredTools = useMemo(
    () =>
      tools.filter((tool) => {
        const matchesQuery = `${tool.name} ${tool.description}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesCategory =
          category === "All tools" || tool.category === category;
        return matchesQuery && matchesCategory;
      }),
    [category, query],
  );
  const visibleTools =
    showAll || category !== "All tools" || query
      ? filteredTools
      : filteredTools.slice(0, 12);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectTool(id: string) {
    setSelectedId(id);
    setInput(starterValues[id] ?? "");
    setOutput("");
    setNotice("");
    setSecurityWarning("");
    window.history.replaceState(null, "", `?tool=${encodeURIComponent(id)}`);
    setOption(
      id === "hash"
        ? "SHA-256"
        : id === "number"
          ? "10"
          : id === "jsonpath"
            ? "$.user.name"
            : id === "timezone"
              ? "Asia/Kolkata"
              : id === "code-formatter"
                ? "javascript"
                : id === "password"
                  ? "24"
                  : id === "jwt-sign"
                    ? "sign"
                    : id === "hex"
                      ? "encode"
                      : id === "bcd"
                        ? "encode"
                        : id === "binary"
                          ? "hex-to-binary"
                          : "encode",
    );
    setPattern("\\b[A-Z][a-z]+\\b");
    setFlags("g");
    setSecret("change-me-locally");
    setMobileOpen(false);
  }

  async function runTool() {
    setNotice("");
    const findings = detectSensitiveInput(input);
    setSecurityWarning(
      findings.length
        ? `Potentially sensitive ${findings.join(", ")} detected. Use masked test data only and clear this page when finished.`
        : "",
    );
    try {
      const maxInputLength =
        selectedId === "image-base64" ? 14_000_000 : 2_000_000;
      if (input.length > maxInputLength)
        throw new Error(
          `Input is too large. Keep it under ${Math.round(maxInputLength / 1_000_000)} MB for a responsive browser session.`,
        );
      if (selectedId === "json") setOutput(prettyJson(input));
      else if (selectedId === "base64")
        setOutput(
          option === "decode" ? decodeBase64Utf8(input) : encodeBase64(input),
        );
      else if (selectedId === "url")
        setOutput(
          option === "decode"
            ? decodeURIComponent(input)
            : encodeURIComponent(input),
        );
      else if (selectedId === "jwt") {
        const parts = input.trim().split(".");
        if (parts.length !== 3 || !parts[0] || !parts[1])
          throw new Error(
            "A compact JWT must contain header.payload.signature.",
          );
        const decode = (part: string) => JSON.parse(decodeBase64Utf8(part));
        setOutput(
          JSON.stringify(
            { header: decode(parts[0]), payload: decode(parts[1]) },
            null,
            2,
          ),
        );
      } else if (selectedId === "hash") {
        const bytes = new TextEncoder().encode(input);
        const digest = await crypto.subtle.digest(option, bytes);
        setOutput(
          Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
        );
      } else if (selectedId === "uuid") setOutput(crypto.randomUUID());
      else if (selectedId === "timestamp") {
        const rawTimestamp = input.trim();
        const date = rawTimestamp
          ? /^-?\d+$/.test(rawTimestamp)
            ? new Date(
                Number(rawTimestamp) *
                  (rawTimestamp.replace("-", "").length <= 10 ? 1000 : 1),
              )
            : new Date(rawTimestamp)
          : new Date();
        if (Number.isNaN(date.getTime()))
          throw new Error(
            "Enter a valid date or leave the field empty for now.",
          );
        setOutput(
          JSON.stringify(
            {
              unixSeconds: Math.floor(date.getTime() / 1000),
              unixMilliseconds: date.getTime(),
              iso: date.toISOString(),
            },
            null,
            2,
          ),
        );
      } else if (selectedId === "regex") {
        const globalRegex = new RegExp(
          pattern,
          flags.includes("g") ? flags : `${flags}g`,
        );
        const matches = Array.from(input.matchAll(globalRegex)).map(
          (match, index) => ({
            index: index + 1,
            match: match[0],
            position: match.index,
            groups: match.slice(1),
          }),
        );
        setOutput(
          JSON.stringify(
            {
              count: matches.length,
              matches: flags.includes("g") ? matches : matches.slice(0, 1),
              global: flags.includes("g"),
            },
            null,
            2,
          ),
        );
      } else if (selectedId === "markdown") setOutput(renderMarkdown(input));
      else if (selectedId === "yaml")
        setOutput(
          option === "decode"
            ? JSON.stringify(parseYaml(input), null, 2)
            : dumpYaml(JSON.parse(input)),
        );
      else if (selectedId === "curl") {
        const built = JSON.parse(buildApiRequest(input)) as { curl: string };
        setOutput(built.curl);
      } else if (selectedId === "diff") {
        const [left, right] = input.split(/\r?\n---\r?\n/);
        if (right === undefined)
          throw new Error(
            "Separate the two snippets with a line containing ---.",
          );
        setOutput(diffText(left, right));
      } else if (selectedId === "xml") setOutput(formatXmlDocument(input));
      else if (selectedId === "csv")
        setOutput(
          option === "decode"
            ? JSON.stringify(parseCsv(input), null, 2)
            : jsonToCsv(input),
        );
      else if (selectedId === "html")
        setOutput(
          option === "decode"
            ? input.replace(
                /&quot;|&#39;|&lt;|&gt;|&amp;/g,
                (entity) =>
                  ({
                    "&quot;": '"',
                    "&#39;": "'",
                    "&lt;": "<",
                    "&gt;": ">",
                    "&amp;": "&",
                  })[entity] ?? entity,
              )
            : escapeHtml(input),
        );
      else if (selectedId === "sql") setOutput(formatSql(input));
      else if (selectedId === "graphql") setOutput(formatGraphql(input));
      else if (selectedId === "query") {
        if (/^https?:\/\//i.test(input))
          setOutput(
            JSON.stringify(
              Object.fromEntries(new URL(input).searchParams.entries()),
              null,
              2,
            ),
          );
        else if (/^[^\s=]+=[\s\S]*/.test(input.trim()))
          setOutput(
            JSON.stringify(
              Object.fromEntries(
                new URLSearchParams(input.trim().replace(/^\?/, "")).entries(),
              ),
              null,
              2,
            ),
          );
        else setOutput(new URLSearchParams(JSON.parse(input)).toString());
      } else if (selectedId === "number")
        setOutput(convertNumber(input, option));
      else if (selectedId === "color") setOutput(convertColor(input));
      else if (selectedId === "status")
        setOutput(
          statusCodes[input.trim()] ??
            "Unknown status code. Try a standard 3-digit HTTP code.",
        );
      else if (selectedId === "cron") {
        setOutput(explainCron(input));
      } else if (selectedId === "json-validator")
        setOutput(validateJson(input));
      else if (selectedId === "json-minifier")
        setOutput(JSON.stringify(JSON.parse(input)));
      else if (selectedId === "jsonpath")
        setOutput(JSON.stringify(extractJsonPath(input, option), null, 2));
      else if (selectedId === "json-diff") {
        const [left, right] = input.split(/\r?\n---\r?\n/);
        if (!right)
          throw new Error(
            "Separate JSON documents with a line containing ---.",
          );
        setOutput(diffJson(left, right));
      } else if (selectedId === "xml-validator") setOutput(validateXml(input));
      else if (selectedId === "yaml-formatter")
        setOutput(dumpYaml(parseYaml(input)));
      else if (selectedId === "password") {
        setOutput(generatePassword(option));
      } else if (selectedId === "whitespace") setOutput(cleanWhitespace(input));
      else if (selectedId === "line-sort") setOutput(sortLines(input));
      else if (selectedId === "line-dedupe") setOutput(dedupeLines(input));
      else if (selectedId === "iso-date") {
        const date = new Date(input);
        if (Number.isNaN(date.getTime()))
          throw new Error("Enter a valid date.");
        setOutput(date.toISOString());
      } else if (selectedId === "timezone")
        setOutput(convertTimezone(input, option));
      else if (selectedId === "url-parser") setOutput(parseUrl(input));
      else if (selectedId === "code-formatter")
        setOutput(await formatCode(input, option));
      else if (selectedId === "csv-viewer") setOutput(summarizeCsv(input));
      else if (selectedId === "mime") setOutput(lookupMime(input));
      else if (selectedId === "openapi-viewer")
        setOutput(summarizeOpenApi(input));
      else if (selectedId === "openapi-diff") {
        const [before, after] = input.split(/\r?\n---\r?\n/);
        if (!after) throw new Error("Separate the old and new OpenAPI documents with a line containing ---.");
        setOutput(diffOpenApi(before, after));
      }
      else if (selectedId === "openapi-validator")
        setOutput(await validateOpenApi(input));
      else if (selectedId === "json-schema") {
        const [data, schema] = input.split(/\r?\n---\r?\n/);
        if (!schema)
          throw new Error(
            "Separate JSON data and schema with a line containing ---.",
          );
        setOutput(validateSchema(data, schema));
      } else if (selectedId === "regex-visualizer")
        setOutput(JSON.stringify(explainRegex(input), null, 2));
      else if (selectedId === "json-schema-generator")
        setOutput(generateJsonSchema(input));
      else if (selectedId === "jwt-rsa") {
        const [token, jwk] = input.split(/\r?\n---\r?\n/);
        if (!jwk) throw new Error("Separate the JWT and JWK JSON with a line containing ---.");
        setOutput(await verifyJwtRsa(token, jwk));
      } else if (selectedId === "log-redactor") setOutput(redactSecrets(input));
      else if (selectedId === "protobuf") setOutput(decodeProtobuf(input));
      else if (selectedId === "asn1") setOutput(decodeAsn1(input));
      else if (selectedId === "regex-safe")
        setOutput(safeRegexTest(pattern, input, flags));
      else if (selectedId === "docker-compose")
        setOutput(validateCompose(input));
      else if (selectedId === "gitignore") setOutput(generateGitignore(input));
      else if (selectedId === "nginx") setOutput(formatNginx(input));
      else if (selectedId === "jwt-sign")
        setOutput(
          option === "verify"
            ? await verifyJwtHmac(input, secret)
            : await signJwtHmac(input, secret),
        );
      else if (selectedId === "cert" || selectedId === "pem")
        setOutput(decodePem(input));
      else if (selectedId === "webhook") setOutput(formatWebhook(input));
      else if (selectedId === "api-request") setOutput(buildApiRequest(input));
      else if (selectedId === "image-base64") setOutput(imageToBase64(input));
      else if (selectedId === "qr") setOutput(await generateQr(input));
      else if (selectedId === "semver") setOutput(compareVersions(input));
      else if (selectedId === "env") setOutput(formatEnv(input));
      else if (selectedId === "hex")
        setOutput(option === "decode" ? decodeHex(input) : encodeHex(input));
      else if (selectedId === "binary")
        setOutput(
          option === "binary-to-hex" ? binaryToHex(input) : hexToBinary(input),
        );
      else if (selectedId === "bcd")
        setOutput(option === "decode" ? decodeBcd(input) : encodeBcd(input));
      else if (selectedId === "ebcdic") setOutput(decodeEbcdic(input));
      else if (selectedId === "iso-bitmap") setOutput(parseBitmap(input));
      else if (selectedId === "iso8583") setOutput(parseIso8583(input));
      else if (selectedId === "emv-tlv") setOutput(parseEmvTlv(input));
      else if (selectedId === "luhn") setOutput(luhn(input));
      else if (selectedId === "track2") setOutput(parseTrack2(input));
      setNotice("Done locally in your browser");
    } catch (error) {
      setOutput(
        error instanceof Error ? error.message : "Unable to process input.",
      );
      setNotice("Check your input");
    }
  }

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setNotice("Copied to clipboard");
    } catch {
      setNotice("Clipboard unavailable; select the output and copy manually");
    }
  }

  function downloadOutput() {
    if (!output) return;
    const link = document.createElement("a");
    const isImage = output.startsWith("data:image/");
    const objectUrl = isImage
      ? undefined
      : URL.createObjectURL(
          new Blob([output], { type: "text/plain;charset=utf-8" }),
        );
    link.href = isImage ? output : (objectUrl ?? "");
    link.download = `${selected.id}-output.${isImage ? "png" : "txt"}`;
    link.click();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setNotice("Downloaded locally");
  }

  function workspaceSnapshot() {
    return JSON.stringify(
      {
        version: 1,
        tool: selectedId,
        input,
        option,
        pattern,
        flags,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  function saveWorkspace() {
    try {
      localStorage.setItem("utilfoundry-dev-workspace", workspaceSnapshot());
      setNotice("Workspace saved locally");
    } catch {
      setNotice("Local workspace storage is unavailable");
    }
  }

  function exportWorkspace() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([workspaceSnapshot()], { type: "application/json" }),
    );
    link.download = "utilfoundry-workspace.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("Workspace exported locally");
  }

  function importWorkspace(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const saved = JSON.parse(String(reader.result)) as Record<string, unknown>;
        const tool = typeof saved.tool === "string" && tools.some((item) => item.id === saved.tool)
          ? saved.tool
          : "json";
        setSelectedId(tool);
        setInput(typeof saved.input === "string" ? saved.input : starterValues[tool] ?? "");
        if (typeof saved.option === "string") setOption(saved.option);
        if (typeof saved.pattern === "string") setPattern(saved.pattern);
        if (typeof saved.flags === "string") setFlags(saved.flags);
        setNotice("Workspace imported locally");
      } catch {
        setNotice("Workspace file is not valid JSON");
      }
    };
    reader.readAsText(file);
  }

  function loadImageFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice("Images are limited to 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInput(typeof reader.result === "string" ? reader.result : "");
      setOutput("");
      setNotice("Image loaded locally");
    };
    reader.onerror = () => setNotice("Unable to read that image");
    reader.readAsDataURL(file);
  }

  return (
    <main className="shell">
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="brand">
          <BrandMark />
          <span>UtilFoundry</span>
          <span className="brand-pill">DEV</span>
        </div>
        <div className="sidebar-heading">Workspace</div>
        <div
          className="workspace-select"
          role="status"
          aria-label="Current workspace: Browser tools"
        >
          <span className="workspace-dot" /> Browser tools
        </div>
        <div className="sidebar-heading tools-heading">Tools</div>
        <nav className="tool-nav">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
              <span>
                {item === "All tools"
                  ? tools.length
                  : tools.filter((tool) => tool.category === item).length}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={16} />
          <span>
            Private by default
            <br />
            <small>Nothing leaves your browser</small>
          </span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close tools menu" : "Open tools menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumb">
            Developer tools <span>/</span> {selected.name}
          </div>
          <div className="topbar-actions">
            <span className="status-dot" /> All systems local{" "}
            <div className="avatar" aria-label="Local browser session">
              A
            </div>
          </div>
        </header>
        <div className="page-body">
          <div className="hero">
            <div>
              <p className="eyebrow">
                <Sparkles size={14} /> Built for focused work
              </p>
              <h1>
                Small tools. <em>Big momentum.</em>
              </h1>
              <p className="hero-copy">
                A fast, private toolbox for the everyday moments between idea
                and deploy.
              </p>
            </div>
            <div className="hero-stats">
              <div>
                <strong>{tools.length}</strong>
                <span>tools available</span>
              </div>
              <div>
                <strong>0</strong>
                <span>uploads required</span>
              </div>
            </div>
          </div>

          <div className="search-row">
            <div className="search-box">
              <Search size={18} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools..."
                aria-label="Search developer tools"
              />
              <kbd>⌘ K</kbd>
            </div>
            <div className="phase-tabs">
              <button
                className={category === "All tools" ? "selected" : ""}
                onClick={() => setCategory("All tools")}
              >
                All
              </button>
              <button onClick={() => setCategory("Security")}>Security</button>
              <button onClick={() => setCategory("Text")}>Text</button>
            </div>
          </div>

          <div className="tool-grid">
            {visibleTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  data-tool-id={tool.id}
                  className={`tool-card ${selectedId === tool.id ? "selected" : ""}`}
                  onClick={() => selectTool(tool.id)}
                  aria-pressed={selectedId === tool.id}
                >
                  <div className={`tool-icon ${tool.accent}`}>
                    <Icon size={19} />
                  </div>
                  <div className="tool-card-copy">
                    <div className="tool-card-title">
                      {tool.name}
                      <span className="phase-label">P{tool.phase}</span>
                    </div>
                    <p>{tool.description}</p>
                  </div>
                  <ArrowRight size={17} className="card-arrow" />
                </button>
              );
            })}
          </div>
          {category === "All tools" && !query && (
            <div className="tool-grid-meta">
              <span>
                {showAll
                  ? `Showing all ${visibleTools.length} tools`
                  : `Showing ${visibleTools.length} featured tools`}
              </span>
              <button onClick={() => setShowAll((current) => !current)}>
                {showAll ? "Show featured" : `View all ${tools.length} tools`}
              </button>
            </div>
          )}

          <section className="workbench">
            <div className="workbench-header">
              <div>
                <p className="eyebrow">Workbench</p>
                <h2>{selected.name}</h2>
                <p className="workbench-description">{selected.description}</p>
              </div>
              <div className="workbench-actions">
                {notice && (
                  <span className="notice" role="status" aria-live="polite">
                    <Check size={14} /> {notice}
                  </span>
                )}
                <button
                  className="ghost-button"
                  onClick={() => {
                    setInput("");
                    setOutput("");
                    setNotice("");
                  }}
                >
                  Clear
                </button>
                <button className="ghost-button" onClick={saveWorkspace}>
                  Save local
                </button>
                <button className="ghost-button" onClick={exportWorkspace}>
                  Export
                </button>
                <button
                  className="ghost-button"
                  onClick={() => workspaceFileRef.current?.click()}
                >
                  Import
                </button>
                <input
                  ref={workspaceFileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => importWorkspace(event.target.files?.[0])}
                />
                <button className="primary-button" onClick={runTool}>
                  Run tool <ArrowRight size={16} />
                </button>
              </div>
            </div>
            {selected.category === "Payments" && (
                  <div className="security-note">
                <ShieldCheck size={15} />
                <span>
                  Use masked test data only. PANs, Track 2, PIN blocks and
                  production keys must never be pasted here.
                </span>
              </div>
            )}
            {securityWarning && (
              <div className="security-warning" role="alert">
                <ShieldCheck size={15} />
                <span>{securityWarning}</span>
              </div>
            )}
            <div className="tool-options">
              {["base64", "url", "yaml", "csv", "html", "hex", "bcd"].includes(
                selectedId,
              ) && (
                <label>
                  Mode
                  <select
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  >
                    <option value="encode">Encode / convert</option>
                    <option value="decode">Decode / convert</option>
                  </select>
                </label>
              )}
              {selectedId === "binary" && (
                <label>
                  Mode
                  <select
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  >
                    <option value="hex-to-binary">Hex → binary</option>
                    <option value="binary-to-hex">Binary → hex</option>
                  </select>
                </label>
              )}
              {selectedId === "hash" && (
                <label>
                  Algorithm
                  <select
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  >
                    <option>SHA-256</option>
                    <option>SHA-1</option>
                  </select>
                </label>
              )}
              {(selectedId === "regex" || selectedId === "regex-safe") && (
                <>
                  <label>
                    Pattern
                    <input
                      value={pattern}
                      onChange={(event) => setPattern(event.target.value)}
                    />
                  </label>
                  <label>
                    Flags
                    <input
                      value={flags}
                      onChange={(event) => setFlags(event.target.value)}
                    />
                  </label>
                </>
              )}
              {selectedId === "number" && (
                <label>
                  Input base
                  <select
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  >
                    <option value="2">Binary (2)</option>
                    <option value="8">Octal (8)</option>
                    <option value="10">Decimal (10)</option>
                    <option value="16">Hex (16)</option>
                  </select>
                </label>
              )}
              {selectedId === "jsonpath" && (
                <label>
                  Path
                  <input
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  />
                </label>
              )}
              {selectedId === "timezone" && (
                <label>
                  Timezone
                  <input
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  />
                </label>
              )}
              {selectedId === "code-formatter" && (
                <label>
                  Language
                  <select
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="json">JSON</option>
                    <option value="css">CSS</option>
                    <option value="html">HTML</option>
                  </select>
                </label>
              )}
              {selectedId === "password" && (
                <label>
                  Length
                  <input
                    type="number"
                    min="8"
                    max="128"
                    value={option}
                    onChange={(event) => setOption(event.target.value)}
                  />
                </label>
              )}
              {selectedId === "jwt-sign" && (
                <>
                  <label>
                    Mode
                    <select
                      value={option}
                      onChange={(event) => setOption(event.target.value)}
                    >
                      <option value="sign">Sign payload</option>
                      <option value="verify">Verify token</option>
                    </select>
                  </label>
                  <label>
                    HMAC secret
                    <input
                      type="password"
                      value={secret}
                      onChange={(event) => setSecret(event.target.value)}
                    />
                  </label>
                </>
              )}
              {selectedId === "image-base64" && (
                <label className="file-picker">
                  Choose image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => loadImageFile(event.target.files?.[0])}
                  />
                </label>
              )}
            </div>
            <div className="panes">
              <div className="pane">
                <div className="pane-label">
                  Input <span>{selected.id === "json" ? "JSON" : "Text"}</span>
                </div>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  spellCheck={false}
                  aria-label={`${selected.name} input`}
                />
              </div>
              <div className="pane">
                <div className="pane-label">
                  Output{" "}
                  <span className="output-actions">
                    <button
                      className="copy-button"
                      onClick={copyOutput}
                      disabled={!output}
                    >
                      <Copy size={14} /> Copy
                    </button>
                    <button
                      className="copy-button"
                      onClick={downloadOutput}
                      disabled={!output}
                    >
                      Download
                    </button>
                  </span>
                </div>
                {selected.id === "markdown" && output ? (
                  <div
                    className="preview"
                    dangerouslySetInnerHTML={{ __html: output }}
                  />
                ) : selected.id === "qr" && output.startsWith("data:image/") ? (
                  <div className="image-preview">
                    <img src={output} alt="Generated QR code" />
                  </div>
                ) : (
                  <pre
                    className={output ? "has-output" : ""}
                    aria-live="polite"
                  >
                    {output || "Run the tool to see the result here."}
                  </pre>
                )}
              </div>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={15} />
              <span>
                Processed locally in your browser. Your input is never uploaded.
              </span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
