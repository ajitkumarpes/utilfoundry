/**
 * Every tool's handler, keyed by the same id as the catalog. Keeping these out of the
 * component means a test can assert that each catalog entry has a handler without
 * reading JSX, and the workbench stays a thin shell around `runTool`.
 *
 * A handler throws to report bad input; the caller turns that into the error message.
 */

import { load as parseYaml, dump as dumpYaml } from "js-yaml";
import Papa from "papaparse";
import {
  buildApiRequest, cleanWhitespace, compareVersions, convertTimezone, decodeAsn1, decodeProtobuf,
  decodePem, dedupeLines, diffJson, diffOpenApi, diffText, explainCron, explainRegex,
  extractJsonPath, formatCode, formatXmlDocument, formatEnv, formatGraphql, formatSql, formatNginx,
  renderMarkdown, convertNumber, convertColor, generateGitignore, generateJsonSchema,
  generatePassword, generateQr, imageToBase64, lookupMime, parseUrl, redactSecrets, safeRegexTest,
  signJwtHmac, sortLines, summarizeCsv, summarizeOpenApi, validateCompose, validateJson,
  validateOpenApi, validateSchema, validateXml, verifyJwtHmac, verifyJwtRsa, formatWebhook
} from "./extra-tools";
import {
  binaryToHex, decodeBcd, decodeEbcdic, decodeHex, encodeBcd, encodeHex, hexToBinary, luhn,
  parseBitmap, parseEmvTlv, parseIso8583, parseTrack2
} from "./payments-tools";

export type RunContext = {
  input: string;
  /** The tool's single dropdown or text option, where it has one. */
  option: string;
  pattern: string;
  flags: string;
  secret: string;
};

type Handler = (ctx: RunContext) => string | Promise<string>;

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
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(compact) || compact.length % 4 === 1) {
    throw new Error("Input is not valid Base64.");
  }
  const normalized = compact
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(compact.length / 4) * 4, "=");
  const binary = atob(normalized);
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function parseCsv(value: string) {
  const parsed = Papa.parse<Record<string, string>>(value, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  if (!parsed.data.length) throw new Error("CSV needs a header row and at least one data row.");
  return parsed.data;
}

function jsonToCsv(value: string) {
  const rows = JSON.parse(value);
  if (!Array.isArray(rows) || !rows.length || typeof rows[0] !== "object") {
    throw new Error("Enter a JSON array of objects.");
  }
  return Papa.unparse(rows);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

function unescapeHtml(value: string) {
  return value.replace(/&quot;|&#39;|&lt;|&gt;|&amp;/g, (entity) =>
    ({ "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">", "&amp;": "&" })[entity] ?? entity);
}

/** Splits the two-document tools on their --- line. */
function pair(input: string, message: string): [string, string] {
  const [left, right] = input.split(/\r?\n---\r?\n/);
  if (right === undefined || right === "") throw new Error(message);
  return [left, right];
}

const STATUS_CODES: Record<string, string> = {
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
  "511": "Network Authentication Required"
};

export const HANDLERS: Record<string, Handler> = {
  json: ({ input }) => prettyJson(input),
  base64: ({ input, option }) => (option === "decode" ? decodeBase64Utf8(input) : encodeBase64(input)),
  url: ({ input, option }) => (option === "decode" ? decodeURIComponent(input) : encodeURIComponent(input)),
  jwt: ({ input }) => {
    const parts = input.trim().split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error("A compact JWT must contain header.payload.signature.");
    const decode = (part: string) => JSON.parse(decodeBase64Utf8(part));
    return JSON.stringify({ header: decode(parts[0]), payload: decode(parts[1]) }, null, 2);
  },
  hash: async ({ input, option }) => {
    const digest = await crypto.subtle.digest(option, new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  },
  uuid: () => crypto.randomUUID(),
  timestamp: ({ input }) => {
    const raw = input.trim();
    const date = raw
      ? /^-?\d+$/.test(raw)
        ? new Date(Number(raw) * (raw.replace("-", "").length <= 10 ? 1000 : 1))
        : new Date(raw)
      : new Date();
    if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date or leave the field empty for now.");
    return JSON.stringify(
      { unixSeconds: Math.floor(date.getTime() / 1000), unixMilliseconds: date.getTime(), iso: date.toISOString() },
      null,
      2
    );
  },
  regex: ({ input, pattern, flags }) => {
    const globalRegex = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
    const matches = Array.from(input.matchAll(globalRegex)).map((match, index) => ({
      index: index + 1,
      match: match[0],
      position: match.index,
      groups: match.slice(1)
    }));
    return JSON.stringify(
      { count: matches.length, matches: flags.includes("g") ? matches : matches.slice(0, 1), global: flags.includes("g") },
      null,
      2
    );
  },
  markdown: ({ input }) => renderMarkdown(input),
  yaml: ({ input, option }) =>
    option === "decode" ? JSON.stringify(parseYaml(input), null, 2) : dumpYaml(JSON.parse(input)),
  curl: ({ input }) => (JSON.parse(buildApiRequest(input)) as { curl: string }).curl,
  diff: ({ input }) => {
    const [left, right] = pair(input, "Separate the two snippets with a line containing ---.");
    return diffText(left, right);
  },
  xml: ({ input }) => formatXmlDocument(input),
  csv: ({ input, option }) => (option === "decode" ? JSON.stringify(parseCsv(input), null, 2) : jsonToCsv(input)),
  html: ({ input, option }) => (option === "decode" ? unescapeHtml(input) : escapeHtml(input)),
  sql: ({ input }) => formatSql(input),
  graphql: ({ input }) => formatGraphql(input),
  query: ({ input }) => {
    if (/^https?:\/\//i.test(input)) {
      return JSON.stringify(Object.fromEntries(new URL(input).searchParams.entries()), null, 2);
    }
    if (/^[^\s=]+=[\s\S]*/.test(input.trim())) {
      return JSON.stringify(Object.fromEntries(new URLSearchParams(input.trim().replace(/^\?/, "")).entries()), null, 2);
    }
    return new URLSearchParams(JSON.parse(input)).toString();
  },
  number: ({ input, option }) => convertNumber(input, option),
  color: ({ input }) => convertColor(input),
  status: ({ input }) => STATUS_CODES[input.trim()] ?? "Unknown status code. Try a standard 3-digit HTTP code.",
  cron: ({ input }) => explainCron(input),
  "json-validator": ({ input }) => validateJson(input),
  "json-minifier": ({ input }) => JSON.stringify(JSON.parse(input)),
  jsonpath: ({ input, option }) => JSON.stringify(extractJsonPath(input, option), null, 2),
  "json-diff": ({ input }) => {
    const [left, right] = pair(input, "Separate JSON documents with a line containing ---.");
    return diffJson(left, right);
  },
  "xml-validator": ({ input }) => validateXml(input),
  "yaml-formatter": ({ input }) => dumpYaml(parseYaml(input)),
  password: ({ option }) => generatePassword(option),
  whitespace: ({ input }) => cleanWhitespace(input),
  "line-sort": ({ input }) => sortLines(input),
  "line-dedupe": ({ input }) => dedupeLines(input),
  "iso-date": ({ input }) => {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date.");
    return date.toISOString();
  },
  timezone: ({ input, option }) => convertTimezone(input, option),
  "url-parser": ({ input }) => parseUrl(input),
  "code-formatter": ({ input, option }) => formatCode(input, option),
  "csv-viewer": ({ input }) => summarizeCsv(input),
  mime: ({ input }) => lookupMime(input),
  "openapi-viewer": ({ input }) => summarizeOpenApi(input),
  "openapi-validator": ({ input }) => validateOpenApi(input),
  "openapi-diff": ({ input }) => {
    const [before, after] = pair(input, "Separate the old and new OpenAPI documents with a line containing ---.");
    return diffOpenApi(before, after);
  },
  "json-schema": ({ input }) => {
    const [data, schema] = pair(input, "Separate JSON data and schema with a line containing ---.");
    return validateSchema(data, schema);
  },
  "regex-visualizer": ({ input }) => JSON.stringify(explainRegex(input), null, 2),
  "json-schema-generator": ({ input }) => generateJsonSchema(input),
  "jwt-rsa": ({ input }) => {
    const [token, jwk] = pair(input, "Separate the JWT and JWK JSON with a line containing ---.");
    return verifyJwtRsa(token, jwk);
  },
  "log-redactor": ({ input }) => redactSecrets(input),
  protobuf: ({ input }) => decodeProtobuf(input),
  asn1: ({ input }) => decodeAsn1(input),
  "regex-safe": ({ input, pattern, flags }) => safeRegexTest(pattern, input, flags),
  "docker-compose": ({ input }) => validateCompose(input),
  gitignore: ({ input }) => generateGitignore(input),
  nginx: ({ input }) => formatNginx(input),
  "jwt-sign": ({ input, option, secret }) =>
    option === "verify" ? verifyJwtHmac(input, secret) : signJwtHmac(input, secret),
  cert: ({ input }) => decodePem(input),
  pem: ({ input }) => decodePem(input),
  webhook: ({ input }) => formatWebhook(input),
  "api-request": ({ input }) => buildApiRequest(input),
  "image-base64": ({ input }) => imageToBase64(input),
  qr: ({ input }) => generateQr(input),
  semver: ({ input }) => compareVersions(input),
  env: ({ input }) => formatEnv(input),
  hex: ({ input, option }) => (option === "decode" ? decodeHex(input) : encodeHex(input)),
  binary: ({ input, option }) => (option === "binary-to-hex" ? binaryToHex(input) : hexToBinary(input)),
  bcd: ({ input, option }) => (option === "decode" ? decodeBcd(input) : encodeBcd(input)),
  ebcdic: ({ input }) => decodeEbcdic(input),
  "iso-bitmap": ({ input }) => parseBitmap(input),
  iso8583: ({ input }) => parseIso8583(input),
  "emv-tlv": ({ input }) => parseEmvTlv(input),
  luhn: ({ input }) => luhn(input),
  track2: ({ input }) => parseTrack2(input)
};

/** An image data URL is far larger than pasted text, so it gets its own ceiling. */
export function maxInputLength(id: string) {
  return id === "image-base64" ? 14_000_000 : 2_000_000;
}

/** Warns before a paste that looks like a real credential is processed. */
export function detectSensitiveInput(value: string) {
  const findings: string[] = [];
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value)) findings.push("private key");
  if (/(?:AKIA|ASIA)[A-Z0-9]{16}/.test(value)) findings.push("AWS access key");
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value)) findings.push("JWT");
  if (/\b(?:\d[ -]*?){13,19}\b/.test(value)) findings.push("card-like number");
  return findings;
}

export async function runTool(id: string, ctx: RunContext): Promise<string> {
  const handler = HANDLERS[id];
  if (!handler) throw new Error("This tool is not available.");
  const limit = maxInputLength(id);
  if (ctx.input.length > limit) {
    throw new Error(`Input is too large. Keep it under ${Math.round(limit / 1_000_000)} MB for a responsive browser session.`);
  }
  return handler(ctx);
}
