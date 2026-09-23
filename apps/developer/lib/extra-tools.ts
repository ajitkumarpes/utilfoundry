/**
 * An interpreter-based validator rather than Ajv: Ajv compiles schemas with
 * `new Function`, which the production CSP forbids, so the schema tools worked in
 * development and failed on the deployed site.
 */
import { Validator, type OutputUnit } from "@cfworker/json-schema";
import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import QRCode from "qrcode";
import semver from "semver";
import { CronExpressionParser } from "cron-parser";
import Papa from "papaparse";
import { format as formatSqlDocument } from "sql-formatter";
import { parse as parseGraphql, print as printGraphql } from "graphql";
import { load as parseYaml } from "js-yaml";
/* The OpenAPI meta-schemas are plain JSON; only the package's Ajv-based runner is avoided. */
import openapi20 from "openapi-schema-validator/dist/resources/openapi-2.0.json";
import openapi30 from "openapi-schema-validator/dist/resources/openapi-3.0.json";
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
    // "safe" runs filter expressions in the library's own miniature evaluator, which uses
    // neither eval nor Function and so satisfies the CSP. Expressions see only the document:
    // a filter that reaches for anything else fails with "not defined" rather than running.
    eval: "safe",
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

/**
 * Unified-diff style: every line carries its own marker. jsdiff groups consecutive changed
 * lines into one part, so marking only the start of each part left the second of two removed
 * lines looking unchanged — and two one-line inputs ran together as "-before+after".
 */
export function diffText(left: string, right: string) {
  const withNewline = (text: string) => (text.endsWith("\n") ? text : `${text}\n`);
  const lines: string[] = [];
  for (const part of diffLines(withNewline(left), withNewline(right))) {
    const marker = part.added ? "+" : part.removed ? "-" : " ";
    for (const line of part.value.slice(0, -1).split("\n")) lines.push(`${marker}${line}`);
  }
  return lines.join("\n");
}

export function validateXml(value: string) {
  const result = XMLValidator.validate(value);
  if (result === true)
    return JSON.stringify({ valid: true, message: "Valid XML" }, null, 2);
  return JSON.stringify({ valid: false, error: result.err }, null, 2);
}

export function formatXmlDocument(value: string) {
  if (!value.trim()) throw new Error("Enter an XML document to format.");
  // The parser below is lenient and would "format" a broken document into something that
  // looks plausible, so it is checked for well-formedness first and the fault is reported.
  const check = XMLValidator.validate(value);
  if (check !== true)
    throw new Error(`${check.err.msg} (line ${check.err.line}, column ${check.err.col}).`);
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Day 0 of the following month is the last day of this one. `month` is 1-12. */
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Date parsing that refuses a day its month does not have.
 *
 * `new Date("2026-02-29")` does not fail — it rolls forward to 1 March, so a tool
 * asked to validate or convert an impossible date would answer confidently about a
 * different day. Month and day are therefore checked against the calendar first,
 * arithmetically rather than through the parsed result, so a written UTC offset
 * shifting the date is not mistaken for a rollover.
 */
export function parseUserDate(value: string, onInvalid = "Enter a valid date.") {
  const trimmed = value.trim();
  const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (calendar) {
    const year = Number(calendar[1]);
    const month = Number(calendar[2]);
    const day = Number(calendar[3]);
    if (month < 1 || month > 12) throw new Error(`There is no month ${calendar[2]}.`);
    const available = daysInMonth(year, month);
    if (day < 1 || day > available) {
      throw new Error(`${MONTH_NAMES[month - 1]} ${year} has ${available} days, so ${trimmed.slice(0, 10)} is not a real date.`);
    }
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error(onInvalid);
  return date;
}

export function convertTimezone(value: string, timezone: string) {
  const date = parseUserDate(value, "Enter a valid ISO date or timestamp.");
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: timezone,
  }).format(date);
}

/**
 * Query parameters as an object, keeping every value of a repeated key: `?tag=a&tag=b` is
 * `{ tag: ["a", "b"] }`. Object.fromEntries kept only the last one, silently.
 */
export function searchParamsToObject(params: URLSearchParams) {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of params) {
    const existing = result[key];
    result[key] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return result;
}

/** The reverse: an array value becomes the key repeated, the way servers read it back. */
export function objectToSearchParams(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("To build a query string, enter a JSON object such as {\"q\": \"shoes\", \"page\": 2}.");
  const params = new URLSearchParams();
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    for (const item of Array.isArray(field) ? field : [field]) {
      if (item === null || item === undefined) continue;
      params.append(key, typeof item === "object" ? JSON.stringify(item) : String(item));
    }
  }
  return params.toString();
}

export function parseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    // Each engine words this differently ("Invalid URL", "… is not a valid URL"); one message.
    throw new Error("Enter a full URL including its scheme, such as https://example.com/path?q=1.");
  }
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
      query: searchParamsToObject(url.searchParams),
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
  jsonld: "application/ld+json",
  map: "application/json",
  webmanifest: "application/manifest+json",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  ics: "text/calendar",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  wasm: "application/wasm",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

const MIME_NOT_FOUND =
  "MIME type not found. Try an extension such as json, html, png or pdf, or a type such as image/png.";

/** An extension or file name gives its type; a type (anything with a /) gives its extensions. */
export function lookupMime(value: string) {
  const query = value.trim().toLowerCase();
  if (query.includes("/")) {
    const type = query.split(";")[0].trim();
    const extensions = Object.entries(mimeTypes)
      .filter(([, mime]) => mime === type)
      .map(([extension]) => `.${extension}`);
    return extensions.length ? `${type}: ${extensions.join(", ")}` : MIME_NOT_FOUND;
  }
  const key = query.replace(/^\./, "").replace(/^.*\./, "");
  return mimeTypes[key] ? `${key}: ${mimeTypes[key]}` : MIME_NOT_FOUND;
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

/** Past this the arbitrary-precision parse gets slow enough to lock the tab, and no real
 *  value needs it: 4096 hex digits is a 16384-bit key, far beyond anything in use. */
const MAX_NUMBER_DIGITS = 4096;

const BIGINT_PREFIX: Record<number, string> = { 2: "0b", 8: "0o", 10: "", 16: "0x" };

/**
 * Converts one integer between bases.
 *
 * Arbitrary precision, because the values people bring here are routinely wider than a double:
 * a 64-bit id, a card number, a register dump, a key modulus. This used to parse through
 * Number and refuse anything past 2^53, which turned the everyday case of a 16-digit hex word
 * into an error. Every field of the result is therefore a string — 2^64 - 1 has no faithful
 * JSON number form, and a field that is sometimes a number and sometimes a string is worse to
 * consume than one that is always a string.
 */
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
  // Only hexadecimal carries a 0x prefix. Stripping it from every base let "0x10" read as
  // decimal 10 under the decimal setting, which is a wrong answer given confidently.
  const trimmed = value.trim();
  const clean = radix === 16 ? trimmed.replace(/^0x/i, "") : trimmed;
  if (!pattern.test(clean))
    throw new Error(`Enter a valid base-${radix} number.`);
  if (clean.length > MAX_NUMBER_DIGITS)
    throw new Error(`Enter at most ${MAX_NUMBER_DIGITS} digits; this one has ${clean.length}.`);
  const decimal = BigInt(`${BIGINT_PREFIX[radix]}${clean}`);
  return JSON.stringify(
    {
      decimal: decimal.toString(10),
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
  // Both OpenAPI meta-schemas are written against draft-04, whichever spec version
  // they describe. shortCircuit false so every problem is listed, not just the first.
  const validator = new Validator(
    (version === 3 ? openapi30 : openapi20) as object,
    "4",
    false,
  );
  const result = validator.validate(document);
  return JSON.stringify(
    {
      valid: result.valid,
      version: version === 3 ? "3.0" : "2.0",
      errors: result.valid ? [] : readableErrors(result.errors),
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

/** Reads the draft the schema declares, defaulting to the current one. */
function draftOf(schema: unknown): "4" | "7" | "2019-09" | "2020-12" {
  const declared =
    schema && typeof schema === "object" && "$schema" in schema
      ? String((schema as Record<string, unknown>).$schema)
      : "";
  if (declared.includes("draft-04")) return "4";
  if (declared.includes("draft-06") || declared.includes("draft-07")) return "7";
  if (declared.includes("2019-09")) return "2019-09";
  return "2020-12";
}

/** Each failure keeps the instance path that broke it, which is what the tool promises. */
function readableErrors(errors: OutputUnit[]) {
  return errors.map((unit) => ({
    path: unit.instanceLocation,
    keyword: unit.keyword,
    schemaPath: unit.keywordLocation,
    error: unit.error,
  }));
}

export function validateSchema(value: string, schema: string) {
  const parsedSchema = JSON.parse(schema);
  // shortCircuit false so every failure is reported, not only the first.
  const validator = new Validator(parsedSchema, draftOf(parsedSchema), false);
  const result = validator.validate(JSON.parse(value));
  return JSON.stringify(
    {
      valid: result.valid,
      errors: result.valid ? [] : readableErrors(result.errors),
    },
    null,
    2,
  );
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
  const details = serviceNames.map((name) => {
    const service = asRecord(services?.[name]) ?? {};
    return {
      name,
      image: service.image ?? null,
      build: service.build ?? null,
      ports: Array.isArray(service.ports) ? service.ports : [],
      volumes: Array.isArray(service.volumes) ? service.volumes : [],
    };
  });
  return JSON.stringify(
    { valid: errors.length === 0, services: details, errors },
    null,
    2,
  );
}

const gitignoreTemplates: Record<string, string> = {
  Node: "node_modules/\n.next/\ndist/\n.env*\n*.log",
  Python: "__pycache__/\n.venv/\n*.py[cod]\n.env\n.pytest_cache/",
  Java: "target/\n.classpath\n.project\n*.class\n*.log",
  Go: "bin/\n*.exe\n*.test\n*.out\nvendor/",
  Rust: "target/\n**/*.rs.bk",
  Ruby: ".bundle/\nvendor/bundle/\nlog/\ntmp/\n.env",
  PHP: "vendor/\n.env\n*.cache",
  DotNet: "bin/\nobj/\n*.user\n.vs/",
  Terraform: ".terraform/\n*.tfstate\n*.tfstate.*\n.terraform.lock.hcl\n*.tfvars",
  macOS: ".DS_Store\n.AppleDouble\n.LSOverride",
  Windows: "Thumbs.db\nehthumbs.db\nDesktop.ini\n$RECYCLE.BIN/",
  Linux: "*~\n.directory\n.Trash-*",
  VSCode: ".vscode/*\n!.vscode/settings.json\n!.vscode/extensions.json",
  JetBrains: ".idea/\n*.iml\nout/",
};

/** What people actually type for a stack, lower-cased, mapped to the template's name. */
const GITIGNORE_ALIASES: Record<string, string> = {
  "node.js": "Node", nodejs: "Node", js: "Node", javascript: "Node", typescript: "Node",
  ".net": "DotNet", net: "DotNet", csharp: "DotNet", "c#": "DotNet",
  mac: "macOS", osx: "macOS", "vs code": "VSCode", code: "VSCode", intellij: "JetBrains", idea: "JetBrains",
  golang: "Go", py: "Python",
};

export function generateGitignore(value: string) {
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length)
    throw new Error("Enter one or more templates, such as Node or Python.");
  const known = Object.keys(gitignoreTemplates);
  return names
    .map((name) => {
      const lower = name.toLowerCase();
      const match = GITIGNORE_ALIASES[lower] ?? known.find((key) => key.toLowerCase() === lower);
      return match
        ? `# ${match}\n${gitignoreTemplates[match]}`
        : `# No template for "${name}". Known: ${known.join(", ")}.`;
    })
    .join("\n\n");
}

export function formatNginx(value: string) {
  let depth = 0;
  return value
    .replace(/\s*\{\s*/g, " {\n")
    .replace(/\s*\}\s*/g, "\n}\n")
    .replace(/;[ \t]*/g, ";\n")
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
  return new TextDecoder().decode(decodeBase64UrlBytes(value));
}

function decodeBase64UrlBytes(value: string) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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

/**
 * Reads one of a certificate's two validity times.
 *
 * Both DER forms are accepted: UTCTime, whose two-digit year RFC 5280 reads as 1950–2049, and
 * GeneralizedTime, which spells the year out and may carry a fractional second. Seconds are
 * optional in UTCTime, so the value is matched against its shape rather than sliced at fixed
 * offsets — slicing silently produced "2026-09-1T7:Z" for a time without them, and every
 * malformed value ended at `new Date(...).toISOString()`, which answers with a bare
 * "Invalid time value" that names neither the field nor what was wrong with it.
 */
function derTime(bytes: Uint8Array, node: DerNode) {
  const raw = derText(bytes, node).trim();
  const isUtcTime = node.tag === 0x17;
  const shape = isUtcTime
    ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/
    : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?Z$/;
  const parts = shape.exec(raw);
  if (!parts)
    throw new Error(
      `Certificate validity is not a ${isUtcTime ? "UTCTime" : "GeneralizedTime"} in UTC: ${raw || "(empty)"}.`,
    );

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = parts;
  const shortYear = Number(yearText);
  const year = isUtcTime ? shortYear + (shortYear >= 50 ? 1900 : 2000) : shortYear;
  const month = Number(monthText);
  const day = Number(dayText);
  const [hour, minute, second] = [hourText, minuteText, secondText].map(Number);

  if (month < 1 || month > 12)
    throw new Error(`Certificate validity names month ${monthText}, which does not exist.`);
  const available = daysInMonth(year, month);
  if (day < 1 || day > available)
    throw new Error(
      `Certificate validity names ${MONTH_NAMES[month - 1]} ${day}, ${year}, and that month has ${available} days.`,
    );
  if (hour > 23 || minute > 59 || second > 59)
    throw new Error(
      `Certificate validity names the time ${hourText}:${minuteText}:${secondText}, which is not a real time of day.`,
    );

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // Date.UTC reads a year under 100 as 19xx; a GeneralizedTime may legitimately carry one.
  if (year < 100) date.setUTCFullYear(year);
  return date.toISOString();
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
  let certificateError: string | undefined;
  if (match[1] === "CERTIFICATE") {
    try {
      certificate = certificateMetadata(decoded);
    } catch (error) {
      // The envelope facts above are still worth reporting for a certificate this parser
      // cannot read, but the reason has to come with them: swallowing it returned a result
      // that looked entirely healthy and simply had no certificate section, leaving the
      // reader to conclude the file was fine.
      certificateError = error instanceof Error ? error.message : "Unable to read this certificate.";
    }
  }
  return JSON.stringify(
    {
      type: match[1],
      bytes: decoded.length,
      base64Length: body.length,
      completeBlock: true,
      ...(certificate ? { certificate } : {}),
      ...(certificateError ? { certificateError } : {}),
      note: "Metadata only; key and certificate material never leaves this browser.",
    },
    null,
    2,
  );
}

const WEBHOOK_SUMMARY_KEYS = [
  "event", "type", "event_type", "eventType", "action", "topic",
  "id", "event_id", "eventId", "delivery_id", "deliveryId", "webhook_id", "request_id", "requestId",
  "created", "created_at", "createdAt", "timestamp", "occurred_at", "time",
];

/** The fields a reader looks for first — what happened, which event, when — ahead of the body. */
export function formatWebhook(value: string) {
  const payload = JSON.parse(value);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return JSON.stringify(payload, null, 2);
  const summary = Object.fromEntries(
    WEBHOOK_SUMMARY_KEYS.filter((key) => {
      const field = (payload as Record<string, unknown>)[key];
      return field !== undefined && (field === null || typeof field !== "object");
    }).map((key) => [key, (payload as Record<string, unknown>)[key]]),
  );
  if (!Object.keys(summary).length) return JSON.stringify(payload, null, 2);
  return JSON.stringify({ summary, payload }, null, 2);
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
  const lines = value
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return index < 0
        ? line.trim()
        : `${line.slice(0, index).trim()}=${line.slice(index + 1).trim()}`;
    });
  const seen = new Map<string, number>();
  for (const line of lines) {
    const key = line.split("=")[0];
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([key]) => key);
  const body = lines.sort().join("\n");
  return duplicates.length ? `${body}\n\n# Duplicate keys: ${duplicates.join(", ")}` : body;
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

function openApiOperations(document: Record<string, unknown>) {
  const paths = asRecord(document.paths) ?? {};
  const operations = new Map<string, Record<string, unknown>>();
  for (const [path, value] of Object.entries(paths)) {
    const pathItem = asRecord(value);
    if (!pathItem) continue;
    for (const method of [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace",
    ]) {
      const operation = asRecord(pathItem[method]);
      if (operation) operations.set(`${method.toUpperCase()} ${path}`, operation);
    }
  }
  return operations;
}

export function diffOpenApi(left: string, right: string) {
  const before = parseStructuredDocument(left);
  const after = parseStructuredDocument(right);
  const oldOperations = openApiOperations(before);
  const newOperations = openApiOperations(after);
  const breakingChanges: Array<Record<string, unknown>> = [];
  for (const [operation] of oldOperations) {
    if (!newOperations.has(operation))
      breakingChanges.push({ type: "removed-operation", operation });
  }
  for (const [operation, oldValue] of oldOperations) {
    const newValue = newOperations.get(operation);
    if (!newValue) continue;
    const oldParameters = (oldValue.parameters as unknown[]) ?? [];
    const newParameters = (newValue.parameters as unknown[]) ?? [];
    const newParameterKeys = new Set(
      newParameters.map((parameter) => {
        const item = asRecord(parameter);
        return `${item?.in ?? ""}:${item?.name ?? ""}`;
      }),
    );
    for (const parameter of oldParameters) {
      const item = asRecord(parameter);
      const key = `${item?.in ?? ""}:${item?.name ?? ""}`;
      if (item && !newParameterKeys.has(key))
        breakingChanges.push({
          type: "removed-parameter",
          operation,
          parameter: key,
        });
    }
    const oldResponses = asRecord(oldValue.responses) ?? {};
    const newResponses = asRecord(newValue.responses) ?? {};
    for (const status of Object.keys(oldResponses)) {
      if (!(status in newResponses))
        breakingChanges.push({
          type: "removed-response",
          operation,
          status,
        });
    }
  }
  return JSON.stringify(
    {
      breaking: breakingChanges.length > 0,
      breakingChanges,
      summary: `${breakingChanges.length} potentially breaking change(s)`,
    },
    null,
    2,
  );
}

function schemaForValue(value: unknown, depth = 0): Record<string, unknown> {
  if (depth > 12) return { type: "object", description: "Maximum nesting depth reached" };
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    const first = value[0];
    return { type: "array", items: first === undefined ? {} : schemaForValue(first, depth + 1) };
  }
  if (typeof value === "object") {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      properties[key] = schemaForValue(child, depth + 1);
      required.push(key);
    }
    return { type: "object", properties, ...(required.length ? { required } : {}) };
  }
  return { type: typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value };
}

export function generateJsonSchema(value: string) {
  const parsed = JSON.parse(value);
  return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...schemaForValue(parsed) }, null, 2);
}

export async function verifyJwtRsa(token: string, jwkValue: string) {
  const [headerPart, payloadPart, signaturePart] = token.trim().split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("Expected a three-part JWT.");
  const header = JSON.parse(decodeBase64Url(headerPart)) as { alg?: string };
  if (header.alg !== "RS256") throw new Error("Only RS256 verification is supported.");
  const jwk = JSON.parse(jwkValue) as JsonWebKey;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64UrlBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  return JSON.stringify({ valid, header, payload: JSON.parse(decodeBase64Url(payloadPart)) }, null, 2);
}

export function redactSecrets(value: string) {
  let redacted = value;
  const findings: string[] = [];
  const replace = (pattern: RegExp, label: string, replacement: string) => {
    pattern.lastIndex = 0;
    if (pattern.test(redacted)) findings.push(label);
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, replacement);
  };
  replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, "bearer token", "$1[REDACTED]");
  replace(/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, "API key", "$1[REDACTED]");
  replace(/(secret|password|token)\s*[:=]\s*([^\s,;]+)/gi, "credential", "$1=[REDACTED]");
  replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "AWS access key", "[REDACTED_AWS_KEY]");
  replace(/[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi, "email address", "[REDACTED_EMAIL]");
  replace(/\b(?:\d[ -]*?){13,19}\b/g, "card-like number", "[REDACTED_CARD]");
  return JSON.stringify({ redacted, findings: Array.from(new Set(findings)) }, null, 2);
}

function hexBytes(value: string) {
  const clean = value.replace(/0x/gi, "").replace(/[\s,:-]/g, "");
  if (!clean || clean.length % 2 || !/^[0-9a-f]+$/i.test(clean)) throw new Error("Enter even-length hexadecimal bytes.");
  return Uint8Array.from({ length: clean.length / 2 }, (_, index) => parseInt(clean.slice(index * 2, index * 2 + 2), 16));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decodeProtobuf(value: string) {
  const bytes = hexBytes(value);
  const fields: Array<Record<string, unknown>> = [];
  let offset = 0;
  const readVarint = () => {
    let result = 0;
    let multiplier = 1;
    while (offset < bytes.length && multiplier <= 0x20_0000_0000_0000) {
      const byte = bytes[offset++];
      result += (byte & 0x7f) * multiplier;
      if (!(byte & 0x80)) return result;
      multiplier *= 128;
    }
    throw new Error("Invalid or oversized protobuf varint.");
  };
  while (offset < bytes.length && fields.length < 200) {
    const key = readVarint();
    const number = Math.floor(key / 8);
    const wireType = key % 8;
    if (!number) throw new Error("Invalid protobuf field number.");
    if (wireType === 0) fields.push({ number, wireType, value: readVarint().toString() });
    else if (wireType === 1) {
      if (offset + 8 > bytes.length) throw new Error("Truncated protobuf 64-bit field.");
      fields.push({ number, wireType, hex: bytesToHex(bytes.slice(offset, offset + 8)) });
      offset += 8;
    } else if (wireType === 2) {
      const length = Number(readVarint());
      if (!Number.isSafeInteger(length) || offset + length > bytes.length) throw new Error("Truncated protobuf length-delimited field.");
      const data = bytes.slice(offset, offset + length);
      offset += length;
      const text = new TextDecoder().decode(data);
      fields.push({ number, wireType, length, text: /^[\x20-\x7e\r\n\t]*$/.test(text) ? text : undefined, hex: bytesToHex(data) });
    } else if (wireType === 5) {
      if (offset + 4 > bytes.length) throw new Error("Truncated protobuf 32-bit field.");
      fields.push({ number, wireType, hex: bytesToHex(bytes.slice(offset, offset + 4)) });
      offset += 4;
    } else throw new Error(`Unsupported protobuf wire type ${wireType}.`);
  }
  return JSON.stringify({ byteLength: bytes.length, fields, remainingBytes: bytes.length - offset }, null, 2);
}

export function decodeAsn1(value: string) {
  const bytes = hexBytes(value);
  const parseNode = (start: number, depth: number): { node: Record<string, unknown>; next: number } => {
    if (depth > 16 || start >= bytes.length) throw new Error("ASN.1 nesting or offset limit exceeded.");
    let offset = start;
    const tag = bytes[offset++];
    if ((tag & 0x1f) === 0x1f) throw new Error("High-tag-number ASN.1 form is not supported in this local inspector.");
    if (offset >= bytes.length) throw new Error("Truncated ASN.1 length.");
    const lengthByte = bytes[offset++];
    let length = lengthByte;
    if (lengthByte & 0x80) {
      const count = lengthByte & 0x7f;
      if (!count || count > 4 || offset + count > bytes.length) throw new Error("Invalid ASN.1 length.");
      length = 0;
      for (let index = 0; index < count; index++) length = length * 256 + bytes[offset++];
    }
    const end = offset + length;
    if (end > bytes.length) throw new Error("ASN.1 value exceeds the input length.");
    const constructed = Boolean(tag & 0x20);
    const node: Record<string, unknown> = { tag: `0x${tag.toString(16).padStart(2, "0").toUpperCase()}`, constructed, length };
    if (constructed) {
      const children: Record<string, unknown>[] = [];
      while (offset < end) {
        const child = parseNode(offset, depth + 1);
        children.push(child.node);
        offset = child.next;
      }
      node.children = children;
    } else {
      const data = bytes.slice(offset, end);
      node.hex = bytesToHex(data).toUpperCase();
      const text = new TextDecoder().decode(data);
      if (/^[\x20-\x7e\r\n\t]*$/.test(text) && text.trim()) node.text = text;
    }
    return { node, next: end };
  };
  const roots: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const result = parseNode(offset, 0);
    roots.push(result.node);
    offset = result.next;
  }
  return JSON.stringify({ byteLength: bytes.length, nodes: roots }, null, 2);
}

export function safeRegexTest(pattern: string, input: string, flags: string) {
  if (pattern.length > 500) throw new Error("Regex patterns are limited to 500 characters.");
  if (input.length > 100_000) throw new Error("Regex input is limited to 100,000 characters.");
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern) || /(\.[+*]){2,}/.test(pattern))
    throw new Error("Potentially catastrophic backtracking pattern rejected.");
  const safeFlags = Array.from(new Set(flags.replace(/[^dgimsuvy]/g, ""))).join("");
  const regex = new RegExp(pattern, safeFlags.includes("g") ? safeFlags : `${safeFlags}g`);
  const matches = Array.from(input.matchAll(regex)).slice(0, 500).map((match) => ({ match: match[0], index: match.index }));
  return JSON.stringify({ safe: true, count: matches.length, matches }, null, 2);
}
