import Ajv from "ajv";
import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import QRCode from "qrcode";
import semver from "semver";
import { CronExpressionParser } from "cron-parser";
import Papa from "papaparse";
import { format as formatSqlDocument } from "sql-formatter";
import { parse as parseGraphql, print as printGraphql } from "graphql";
import { load as parseYaml } from "js-yaml";
import OpenApiSchemaValidator from "openapi-schema-validator";
import type { OpenAPI } from "openapi-types";
import { JSONPath } from "jsonpath-plus";
import { RegExpParser, visitRegExpAST, type AST } from "regexpp";
import { marked } from "marked";
import createDOMPurify from "dompurify";
import { diffLines } from "diff";

export function validateJson(value: string) {
  const parsed = JSON.parse(value);
  return JSON.stringify(
    {
      valid: true,
      type: Array.isArray(parsed) ? "array" : typeof parsed,
      message: "Valid JSON",
    },
    null,
    2,
  );
}

export function extractJsonPath(value: string, path: string) {
  const root = JSON.parse(value);
  if (!path.trim())
    throw new Error(
      "Enter a JSONPath expression such as $.user.name or $..id.",
    );
  const matches = JSONPath({
    path,
    json: root,
    wrap: true,
    eval: false,
  }) as unknown[];
  if (!matches.length) throw new Error("JSONPath returned no matches.");
  return JSON.stringify(matches.length === 1 ? matches[0] : matches, null, 2);
}

export function diffJson(left: string, right: string) {
  const a = JSON.parse(left),
    b = JSON.parse(right);
  const changes: Array<{ path: string; left?: unknown; right?: unknown }> = [];
  const walk = (first: unknown, second: unknown, path: string) => {
    if (JSON.stringify(first) === JSON.stringify(second)) return;
    if (
      first &&
      second &&
      typeof first === "object" &&
      typeof second === "object" &&
      !Array.isArray(first) &&
      !Array.isArray(second)
    ) {
      const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
      keys.forEach((key) =>
        walk(
          (first as Record<string, unknown>)[key],
          (second as Record<string, unknown>)[key],
          `${path}.${key}`,
        ),
      );
    } else
      changes.push({
        path: path ? `$${path}` : "$",
        left: first,
        right: second,
      });
  };
  walk(a, b, "");
  return JSON.stringify(changes, null, 2);
}

export function diffText(left: string, right: string) {
  return diffLines(left, right)
    .map(
      (part) => `${part.added ? "+" : part.removed ? "-" : " "}${part.value}`,
    )
    .join("");
}

export function validateXml(value: string) {
  const result = XMLValidator.validate(value);
  if (result === true)
    return JSON.stringify({ valid: true, message: "Valid XML" }, null, 2);
  return JSON.stringify({ valid: false, error: result.err }, null, 2);
}

export function formatXmlDocument(value: string) {
  if (!value.trim()) throw new Error("Enter an XML document to format.");
  const options = {
    ignoreAttributes: false,
    preserveOrder: true,
    format: true,
    indentBy: "  ",
  };
  const parsed = new XMLParser(options).parse(value);
  return new XMLBuilder(options).build(parsed);
}

export function cleanWhitespace(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/[ \t]+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sortLines(value: string) {
  return value
    .split(/\r?\n/)
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    )
    .join("\n");
}

export function dedupeLines(value: string) {
  return Array.from(new Set(value.split(/\r?\n/))).join("\n");
}

export function convertTimezone(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("Enter a valid ISO date or timestamp.");
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: timezone,
  }).format(date);
}

export function parseUrl(value: string) {
  const url = new URL(value);
  return JSON.stringify(
    {
      href: url.href,
      protocol: url.protocol,
      username: url.username,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      hash: url.hash,
      query: Object.fromEntries(url.searchParams.entries()),
    },
    null,
    2,
  );
}

const mimeTypes: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  ts: "text/typescript",
  json: "application/json",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  csv: "text/csv",
  pdf: "application/pdf",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
  wasm: "application/wasm",
};

export function lookupMime(value: string) {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/^\./, "")
    .replace(/^.*\./, "");
  return mimeTypes[key]
    ? `${key}: ${mimeTypes[key]}`
    : "MIME type not found. Try an extension such as json, html, png, or pdf.";
}

export async function formatCode(value: string, language: string) {
  const prettier = await import("prettier/standalone");
  const [babel, estree, typescript, html, postcss] = await Promise.all([
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
    import("prettier/plugins/typescript"),
    import("prettier/plugins/html"),
    import("prettier/plugins/postcss"),
  ]);
  const parser =
    language === "json"
      ? "json"
      : language === "css"
        ? "css"
        : language === "html"
          ? "html"
          : language === "typescript"
            ? "typescript"
            : "babel";
  return prettier.format(value, {
    parser,
    plugins: [babel, estree, typescript, html, postcss],
    printWidth: 100,
    semi: true,
    singleQuote: false,
  });
}

export function summarizeCsv(value: string) {
  const parsed = Papa.parse<string[]>(value, {
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  const rows = parsed.data;
  return JSON.stringify(
    {
      columns: rows[0]?.length ?? 0,
      rows: Math.max(0, rows.length - 1),
      headers: rows[0] ?? [],
      preview: rows.slice(0, 6),
    },
    null,
    2,
  );
}

export function formatSql(value: string) {
  if (!value.trim()) throw new Error("Enter a SQL statement to format.");
  return formatSqlDocument(value, {
    language: "sql",
    keywordCase: "upper",
    tabWidth: 2,
    useTabs: false,
  });
}

export function formatGraphql(value: string) {
  if (!value.trim()) throw new Error("Enter a GraphQL document to format.");
  return printGraphql(parseGraphql(value));
}

export function renderMarkdown(value: string) {
  const html = marked.parse(value, { gfm: true, breaks: true });
  const rendered = typeof html === "string" ? html : "";
  if (typeof window !== "undefined")
    return createDOMPurify(window).sanitize(rendered, {
      USE_PROFILES: { html: true },
    });
  return rendered
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
}

export function convertNumber(value: string, base: string) {
  const radix = Number(base);
  if (![2, 8, 10, 16].includes(radix))
    throw new Error("Choose a supported input base.");
  const pattern =
    radix === 2
      ? /^[01]+$/
      : radix === 8
        ? /^[0-7]+$/
        : radix === 10
          ? /^\d+$/
          : /^[0-9a-f]+$/i;
  const clean = value.trim().replace(/^0x/i, "");
  if (!pattern.test(clean))
    throw new Error(`Enter a valid base-${radix} number.`);
  const decimal = Number.parseInt(clean, radix);
  if (!Number.isSafeInteger(decimal))
    throw new Error("Enter a value within JavaScript's safe integer range.");
  return JSON.stringify(
    {
      decimal,
      binary: decimal.toString(2),
      octal: decimal.toString(8),
      hexadecimal: decimal.toString(16).toUpperCase(),
    },
    null,
    2,
  );
}

export function convertColor(value: string) {
  const input = value.trim();
  let red: number;
  let green: number;
  let blue: number;
  let alpha = 1;
  const hex = input.replace(/^#/, "");
  if (/^[0-9a-f]{3,4}$/i.test(hex) || /^[0-9a-f]{6,8}$/i.test(hex)) {
    const expanded =
      hex.length === 3 || hex.length === 4
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    red = parseInt(expanded.slice(0, 2), 16);
    green = parseInt(expanded.slice(2, 4), 16);
    blue = parseInt(expanded.slice(4, 6), 16);
    if (expanded.length === 8) alpha = parseInt(expanded.slice(6), 16) / 255;
  } else {
    const hslMatch = input.match(
      /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%(?:\s*,\s*(1|0(?:\.\d+)?))?\s*\)$/i,
    );
    if (hslMatch) {
      const hue = (((Number(hslMatch[1]) % 360) + 360) % 360) / 360;
      const saturationPercent = Number(hslMatch[2]);
      const lightnessPercent = Number(hslMatch[3]);
      if (saturationPercent > 100 || lightnessPercent > 100)
        throw new Error("HSL saturation and lightness must be 0–100%.");
      const saturation = saturationPercent / 100;
      const lightness = lightnessPercent / 100;
      alpha = hslMatch[4] === undefined ? 1 : Number(hslMatch[4]);
      const hueToChannel = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return 6 * t;
        if (t < 1 / 2) return 1;
        if (t < 2 / 3) return (2 / 3 - t) * 6;
        return 0;
      };
      const q =
        lightness < 0.5
          ? lightness * (1 + saturation)
          : lightness + saturation - lightness * saturation;
      const p = 2 * lightness - q;
      red = Math.round(
        255 *
          (saturation === 0
            ? lightness
            : p + (q - p) * hueToChannel(hue + 1 / 3)),
      );
      green = Math.round(
        255 * (saturation === 0 ? lightness : p + (q - p) * hueToChannel(hue)),
      );
      blue = Math.round(
        255 *
          (saturation === 0
            ? lightness
            : p + (q - p) * hueToChannel(hue - 1 / 3)),
      );
    } else {
      const rgbMatch = input.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(1|0(?:\.\d+)?))?\s*\)$/i,
      );
      if (!rgbMatch)
        throw new Error(
          "Enter a HEX color (#4263EB), short HEX (#fff), or rgb()/rgba() value.",
        );
      [red, green, blue] = rgbMatch.slice(1, 4).map(Number);
      if ([red, green, blue].some((channel) => channel > 255))
        throw new Error("RGB channels must be between 0 and 255.");
      alpha = rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]);
    }
  }
  const max = Math.max(red, green, blue) / 255;
  const min = Math.min(red, green, blue) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red / 255) hue = 60 * (((green - blue) / 255 / delta) % 6);
    else if (max === green / 255) hue = 60 * ((blue - red) / 255 / delta + 2);
    else hue = 60 * ((red - green) / 255 / delta + 4);
  }
  if (hue < 0) hue += 360;
  const hexValue = [red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const alphaValue = Number(alpha.toFixed(3));
  const alphaText = alphaValue.toString();
  return JSON.stringify(
    {
      hex: `#${hexValue}`,
      ...(alphaValue < 1
        ? {
            hex8: `#${hexValue}${Math.round(alphaValue * 255)
              .toString(16)
              .padStart(2, "0")
              .toUpperCase()}`,
          }
        : {}),
      rgb:
        alphaValue < 1
          ? `rgba(${red}, ${green}, ${blue}, ${alphaText})`
          : `rgb(${red}, ${green}, ${blue})`,
      hsl:
        alphaValue < 1
          ? `hsla(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%, ${alphaText})`
          : `hsl(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)`,
      alpha: alphaValue,
    },
    null,
    2,
  );
}

export function summarizeOpenApi(value: string) {
  const document = parseStructuredDocument(value);
  const info = asRecord(document.info);
  const pathsDocument = asRecord(document.paths) ?? {};
  const paths = Object.entries(pathsDocument).flatMap(([path, operations]) =>
    operations && typeof operations === "object"
      ? Object.keys(operations)
          .filter((method) =>
            [
              "get",
              "put",
              "post",
              "delete",
              "options",
              "head",
              "patch",
              "trace",
            ].includes(method),
          )
          .map((method) => `${method.toUpperCase()} ${path}`)
      : [],
  );
  return JSON.stringify(
    {
      openapi: document.openapi ?? document.swagger ?? "unknown",
      title: info?.title ?? "Untitled API",
      version: info?.version ?? "unknown",
      endpointCount: paths.length,
      endpoints: paths,
    },
    null,
    2,
  );
}

export function validateOpenApi(value: string) {
  const document = parseStructuredDocument(value);
  const version = document.openapi ? 3 : 2;
  const validator = new OpenApiSchemaValidator({ version });
  const result = validator.validate(document as OpenAPI.Document);
  return JSON.stringify(
    {
      valid: result.errors.length === 0,
      version: version === 3 ? "3.0" : "2.0",
      errors: result.errors,
    },
    null,
    2,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseStructuredDocument(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Document root must be an object.");
    return parsed as Record<string, unknown>;
  } catch (jsonError) {
    try {
      const parsed = parseYaml(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Document root must be an object.");
      return parsed as Record<string, unknown>;
    } catch {
      throw jsonError;
    }
  }
}

export function validateSchema(value: string, schema: string) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const valid = ajv.compile(JSON.parse(schema))(JSON.parse(value));
  return JSON.stringify({ valid, errors: valid ? [] : ajv.errors }, null, 2);
}

export function explainRegex(value: string) {
  const parser = new RegExpParser({ ecmaVersion: 2022 });
  const ast = parser.parsePattern(value);
  const nodes: Array<{
    type: string;
    raw: string;
    start: number;
    end: number;
    details?: Record<string, unknown>;
  }> = [];
  const add = (node: AST.Node) => {
    const details: Record<string, unknown> = {};
    if (node.type === "Character") details.value = node.value;
    if (node.type === "CharacterSet") details.kind = node.kind;
    if (node.type === "CharacterClass") details.negate = node.negate;
    if (node.type === "CharacterClassRange") {
      details.min = node.min.value;
      details.max = node.max.value;
    }
    if (node.type === "Quantifier") {
      details.min = node.min;
      details.max = node.max;
      details.greedy = node.greedy;
    }
    if (node.type === "CapturingGroup") details.name = node.name;
    if (node.type === "Assertion") {
      details.kind = node.kind;
      if ("negate" in node) details.negate = node.negate;
    }
    if (node.type === "Backreference") details.ref = node.ref;
    nodes.push({
      type: node.type,
      raw: node.raw,
      start: node.start,
      end: node.end,
      details: Object.keys(details).length ? details : undefined,
    });
  };
  visitRegExpAST(ast, {
    onAlternativeEnter: add,
    onAssertionEnter: add,
    onBackreferenceEnter: add,
    onCapturingGroupEnter: add,
    onCharacterEnter: add,
    onCharacterClassEnter: add,
    onCharacterClassRangeEnter: add,
    onCharacterSetEnter: add,
    onGroupEnter: add,
    onPatternEnter: add,
    onQuantifierEnter: add,
  });
  return nodes;
}

export function validateCompose(value: string) {
  let document: Record<string, unknown> | null;
  try {
    document = asRecord(parseYaml(value));
  } catch (error) {
    return JSON.stringify(
      {
        valid: false,
        services: [],
        errors: [error instanceof Error ? error.message : "Invalid YAML"],
      },
      null,
      2,
    );
  }
  const services = asRecord(document?.services);
  const serviceNames = services ? Object.keys(services) : [];
  const errors: string[] = [];
  if (!services)
    errors.push("A Compose document should define a services mapping.");
  if (services)
    for (const name of serviceNames) {
      const service = asRecord(services[name]);
      if (!service) errors.push(`${name}: service must be a mapping.`);
      else if (!service.image && !service.build)
        errors.push(`${name}: define image or build.`);
    }
  return JSON.stringify(
    { valid: errors.length === 0, services: serviceNames, errors },
    null,
    2,
  );
}

const gitignoreTemplates: Record<string, string> = {
  Node: "node_modules/\n.next/\ndist/\n.env*\n*.log",
  Java: "target/\n.classpath\n.project\n*.log",
  Python: "__pycache__/\n.venv/\n*.py[cod]\n.env",
  macOS: ".DS_Store\n.AppleDouble\n.LSOverride",
};

export function generateGitignore(value: string) {
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length)
    throw new Error("Enter one or more templates, such as Node or Python.");
  return names
    .map((name) => gitignoreTemplates[name] ?? `# ${name}`)
    .join("\n\n");
}

export function formatNginx(value: string) {
  let depth = 0;
  return value
    .replace(/[{};]/g, (token) =>
      token === "{" ? "{\n" : token === "}" ? "\n}" : ";\n",
    )
    .split("\n")
    .map((line) => {
      const text = line.trim();
      if (!text) return "";
      if (text.startsWith("}")) depth = Math.max(0, depth - 1);
      const result = `${"  ".repeat(depth)}${text}`;
      if (text.endsWith("{")) depth += 1;
      return result;
    })
    .filter(Boolean)
    .join("\n");
}

function base64FromUtf8(value: string) {
  let binary = "";
  for (const byte of new TextEncoder().encode(value))
    binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(value: string) {
  return base64FromUtf8(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function bytesBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

export async function signJwtHmac(payload: string, secret: string) {
  const parsedPayload = JSON.parse(payload);
  if (
    !parsedPayload ||
    typeof parsedPayload !== "object" ||
    Array.isArray(parsedPayload)
  )
    throw new Error("JWT payload must be a JSON object.");
  if (!secret) throw new Error("Enter a non-empty HMAC secret.");
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(parsedPayload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${bytesBase64Url(new Uint8Array(signature))}`;
}

export async function verifyJwtHmac(token: string, secret: string) {
  if (!secret) throw new Error("Enter a non-empty HMAC secret.");
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature)
    throw new Error("Expected a three-part JWT.");
  const decodedHeader = JSON.parse(decodeBase64Url(header)) as {
    alg?: string;
    typ?: string;
  };
  if (decodedHeader.alg !== "HS256")
    throw new Error(
      "Only HS256 verification is supported; no algorithm downgrades are allowed.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const normalizedSignature = signature
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(signature.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(normalizedSignature), (char) =>
    char.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(`${header}.${body}`),
  );
  const payload = JSON.parse(decodeBase64Url(body));
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("JWT payload must be a JSON object.");
  return JSON.stringify(
    {
      valid,
      header: decodedHeader,
      payload,
    },
    null,
    2,
  );
}

type DerNode = {
  tag: number;
  start: number;
  contentStart: number;
  contentEnd: number;
  end: number;
};

function readDerNode(bytes: Uint8Array, offset: number): DerNode {
  if (offset >= bytes.length) throw new Error("ASN.1 value is truncated.");
  const start = offset;
  const tag = bytes[offset++];
  if (offset >= bytes.length) throw new Error("ASN.1 length is truncated.");
  const firstLength = bytes[offset++];
  let length = firstLength;
  if (firstLength & 0x80) {
    const count = firstLength & 0x7f;
    if (!count || count > 4 || offset + count > bytes.length)
      throw new Error("ASN.1 length is invalid.");
    length = 0;
    for (let index = 0; index < count; index += 1)
      length = length * 256 + bytes[offset++];
  }
  const contentStart = offset;
  const contentEnd = contentStart + length;
  if (contentEnd > bytes.length) throw new Error("ASN.1 value is truncated.");
  return { tag, start, contentStart, contentEnd, end: contentEnd };
}

function derChildren(bytes: Uint8Array, node: DerNode) {
  const children: DerNode[] = [];
  let offset = node.contentStart;
  while (offset < node.contentEnd) {
    const child = readDerNode(bytes, offset);
    children.push(child);
    offset = child.end;
  }
  if (offset !== node.contentEnd)
    throw new Error("ASN.1 child boundary is invalid.");
  return children;
}

function derOid(bytes: Uint8Array, node: DerNode) {
  const values: number[] = [];
  let value = 0;
  for (let index = node.contentStart; index < node.contentEnd; index += 1) {
    const byte = bytes[index];
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      values.push(value);
      value = 0;
    }
  }
  if (value) throw new Error("ASN.1 OID is truncated.");
  const first = values.shift() ?? 0;
  return `${Math.min(2, Math.floor(first / 40))}.${first < 80 ? first % 40 : first - 80}${values.length ? `.${values.join(".")}` : ""}`;
}

function derText(bytes: Uint8Array, node: DerNode) {
  if (node.tag === 0x1e) {
    let text = "";
    for (let index = node.contentStart; index + 1 < node.contentEnd; index += 2)
      text += String.fromCharCode(bytes[index] * 256 + bytes[index + 1]);
    return text;
  }
  return new TextDecoder().decode(
    bytes.slice(node.contentStart, node.contentEnd),
  );
}

function derName(bytes: Uint8Array, node: DerNode) {
  const labels: Record<string, string> = {
    "2.5.4.3": "CN",
    "2.5.4.6": "C",
    "2.5.4.7": "L",
    "2.5.4.8": "ST",
    "2.5.4.10": "O",
    "2.5.4.11": "OU",
  };
  return derChildren(bytes, node)
    .flatMap((set) => derChildren(bytes, set))
    .map((sequence) => {
      const [oid, value] = derChildren(bytes, sequence);
      return `${labels[derOid(bytes, oid)] ?? derOid(bytes, oid)}=${derText(bytes, value)}`;
    })
    .join(", ");
}

function derTime(bytes: Uint8Array, node: DerNode) {
  const raw = derText(bytes, node).replace(/Z$/, "");
  const year =
    node.tag === 0x17
      ? Number(raw.slice(0, 2)) + (Number(raw.slice(0, 2)) >= 50 ? 1900 : 2000)
      : Number(raw.slice(0, 4));
  const start = node.tag === 0x17 ? 2 : 4;
  const iso = `${String(year).padStart(4, "0")}-${raw.slice(start, start + 2)}-${raw.slice(start + 2, start + 4)}T${raw.slice(start + 4, start + 6)}:${raw.slice(start + 6, start + 8)}:${raw.slice(start + 8, start + 10)}Z`;
  return new Date(iso).toISOString();
}

function certificateMetadata(bytes: Uint8Array) {
  const certificate = readDerNode(bytes, 0);
  const [tbs] = derChildren(bytes, certificate);
  const fields = derChildren(bytes, tbs);
  let index = fields[0]?.tag === 0xa0 ? 1 : 0;
  const serial = fields[index++];
  const signature = fields[index++];
  const issuer = fields[index++];
  const validity = fields[index++];
  const subject = fields[index++];
  const subjectPublicKey = fields[index++];
  const validityFields = derChildren(bytes, validity);
  const signatureOid = derOid(bytes, derChildren(bytes, signature)[0]);
  const publicKeyOid = derOid(bytes, derChildren(bytes, subjectPublicKey)[0]);
  return {
    serialNumber: Array.from(
      bytes.slice(serial.contentStart, serial.contentEnd),
      (byte) => byte.toString(16).padStart(2, "0"),
    )
      .join("")
      .toUpperCase(),
    signatureAlgorithm: signatureOid,
    issuer: derName(bytes, issuer),
    subject: derName(bytes, subject),
    notBefore: derTime(bytes, validityFields[0]),
    notAfter: derTime(bytes, validityFields[1]),
    publicKeyAlgorithm: publicKeyOid,
  };
}

export function decodePem(value: string) {
  const match = value.match(
    /-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/,
  );
  if (!match)
    throw new Error(
      "Paste a complete PEM block with matching BEGIN and END labels.",
    );
  const body = match[2].replace(/\s/g, "");
  if (!body || !/^[A-Za-z0-9+/]*={0,2}$/.test(body) || body.length % 4 === 1)
    throw new Error("PEM body is not valid Base64.");
  let decoded: Uint8Array;
  try {
    decoded = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  } catch {
    throw new Error("PEM body is not valid Base64.");
  }
  let certificate: Record<string, unknown> | undefined;
  if (match[1] === "CERTIFICATE") {
    try {
      certificate = certificateMetadata(decoded);
    } catch {
      certificate = undefined;
    }
  }
  return JSON.stringify(
    {
      type: match[1],
      bytes: decoded.length,
      base64Length: body.length,
      completeBlock: true,
      ...(certificate ? { certificate } : {}),
      note: "Metadata only; key and certificate material never leaves this browser.",
    },
    null,
    2,
  );
}

export function formatWebhook(value: string) {
  return JSON.stringify(JSON.parse(value), null, 2);
}

export function buildApiRequest(value: string) {
  const request = JSON.parse(value);
  if (!request || typeof request !== "object" || Array.isArray(request))
    throw new Error("Request must be a JSON object.");
  if (typeof request.url !== "string" || !/^https?:\/\//i.test(request.url))
    throw new Error("Request URL must be an absolute HTTP(S) URL.");
  const method = String(request.method ?? "GET").toUpperCase();
  if (!/^[A-Z][A-Z0-9-]*$/.test(method))
    throw new Error("Request method must be a safe HTTP token.");
  const requestHeaders = request.headers ?? {};
  if (
    typeof requestHeaders !== "object" ||
    Array.isArray(requestHeaders) ||
    Object.entries(requestHeaders).some(
      ([key, value]) =>
        !key.trim() ||
        /[\r\n]/.test(key) ||
        (typeof value !== "string" &&
          typeof value !== "number" &&
          typeof value !== "boolean") ||
        /[\r\n]/.test(String(value)),
    )
  )
    throw new Error("Headers must be a JSON object with safe scalar values.");
  const shellQuote = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
  const headers = Object.entries(requestHeaders)
    .map(([key, val]) => `-H ${shellQuote(`${key}: ${String(val)}`)}`)
    .join(" ");
  const body =
    request.body === undefined
      ? undefined
      : typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body);
  return JSON.stringify(
    {
      fetch: `fetch(${JSON.stringify(request.url)}, { method: ${JSON.stringify(method)}, headers: ${JSON.stringify(requestHeaders)}, body: ${body === undefined ? "undefined" : JSON.stringify(body)} })`,
      curl: `curl -X ${method} ${headers} ${shellQuote(request.url)}${body === undefined ? "" : ` --data-raw ${shellQuote(body)}`}`,
    },
    null,
    2,
  );
}

export function imageToBase64(value: string) {
  const input = value.trim();
  const dataUrl = input.match(
    /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/i,
  );
  if (dataUrl) {
    const body = dataUrl[2];
    if (!body || body.length % 4 === 1)
      throw new Error("Image data URL contains invalid Base64.");
    let decodedLength = 0;
    try {
      decodedLength = atob(body).length;
    } catch {
      throw new Error("Image data URL contains invalid Base64.");
    }
    return JSON.stringify(
      {
        dataUrl: input,
        mime: dataUrl[1],
        base64Bytes: decodedLength,
      },
      null,
      2,
    );
  }
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) && normalized.length >= 4) {
    try {
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
      return `data:image/png;base64,${normalized}`;
    } catch {
      // Fall through to the user-facing validation error below.
    }
  }
  throw new Error("Paste a valid image data URL or a Base64 image payload.");
}

export async function generateQr(value: string) {
  if (!value.trim()) throw new Error("Enter text to encode in the QR code.");
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}

export function compareVersions(value: string) {
  const versions = value.split(/\s+/).filter(Boolean);
  if (versions.length !== 2)
    throw new Error("Enter two semantic versions separated by a space.");
  return JSON.stringify(
    {
      left: versions[0],
      right: versions[1],
      comparison: semver.compare(versions[0], versions[1]),
      relation: semver.gt(versions[0], versions[1])
        ? "left is newer"
        : semver.lt(versions[0], versions[1])
          ? "right is newer"
          : "equal",
    },
    null,
    2,
  );
}

export function formatEnv(value: string) {
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return index < 0
        ? line.trim()
        : `${line.slice(0, index).trim()}=${line.slice(index + 1).trim()}`;
    })
    .sort()
    .join("\n");
}

export function generatePassword(lengthValue: string) {
  const length = Math.min(128, Math.max(8, Number(lengthValue) || 24));
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-";
  const limit = Math.floor(0x1_0000_0000 / alphabet.length) * alphabet.length;
  const output: string[] = [];
  while (output.length < length) {
    const random = new Uint32Array((length - output.length) * 2);
    crypto.getRandomValues(random);
    for (const value of random)
      if (value < limit && output.length < length)
        output.push(alphabet[value % alphabet.length]);
  }
  return output.join("");
}

export function explainCron(value: string) {
  const expression = CronExpressionParser.parse(value.trim());
  const nextRuns = Array.from({ length: 5 }, () =>
    expression.next().toISOString(),
  );
  return JSON.stringify(
    {
      expression: value.trim(),
      nextRuns,
      note: "Next runs use the browser's current timezone.",
    },
    null,
    2,
  );
}
