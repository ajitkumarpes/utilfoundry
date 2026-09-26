/**
 * The "Details" the Result panel lists under the size and line count: the few facts about
 * this particular output that a person would otherwise have to read it to find — when a token
 * expires, how strong a password is, which colour a hex code is, when a cron job next runs.
 *
 * Every value is read from the output the tool actually produced (or, for size comparisons,
 * from the input it was given), never recomputed a second way, so the panel cannot disagree
 * with the editor beside it. A tool with nothing worth adding returns an empty list.
 */

import { PASSWORD_ALPHABET } from "./extra-tools";

export type InsightTone = "good" | "warn" | "bad";
export type Insight = {
  label: string;
  value: string;
  tone?: InsightTone;
  /** A CSS colour to show as a swatch beside the value. */
  swatch?: string;
  /** Values that are identifiers or code, drawn in the monospace face. */
  mono?: boolean;
  /** 0–1, for a value that reads best as a bar, such as password strength. */
  meter?: number;
};

type Json = Record<string, unknown>;

function parse(output: string): unknown {
  const start = output.trimStart()[0];
  if (start !== "{" && start !== "[" && start !== '"') return undefined;
  try {
    return JSON.parse(output);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

const text = (value: unknown) => (value === undefined || value === null || value === "" ? null : String(value));
const count = (value: unknown) => (Array.isArray(value) ? value.length : null);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600], ["month", 30 * 24 * 3600], ["week", 7 * 24 * 3600],
  ["day", 24 * 3600], ["hour", 3600], ["minute", 60], ["second", 1]
];

/** "in 3 days", "2 hours ago": the unit is the largest one the gap fills at least once. */
export function relativeTime(epochMs: number, now: number): string {
  const seconds = Math.round((epochMs - now) / 1000);
  const size = Math.abs(seconds);
  for (const [unit, unitSeconds] of UNITS) {
    if (size >= unitSeconds || unit === "second") return RELATIVE.format(Math.round(seconds / unitSeconds), unit);
  }
  return RELATIVE.format(seconds, "second");
}

function claimTime(label: string, seconds: unknown, now: number, expiry = false): Insight | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  const ms = seconds * 1000;
  const insight: Insight = { label, value: relativeTime(ms, now) };
  if (expiry) insight.tone = ms < now ? "bad" : "good";
  return insight;
}

function tokenInsights(decoded: Json, now: number): Insight[] {
  const header = asRecord(decoded.header) ?? {};
  const payload = asRecord(decoded.payload) ?? {};
  const alg = text(header.alg);
  const list: Array<Insight | null> = [
    alg ? { label: "Algorithm", value: alg, tone: alg === "none" ? "warn" : undefined, mono: true } : null,
    text(payload.sub) ? { label: "Subject", value: String(payload.sub), mono: true } : null,
    text(payload.iss) ? { label: "Issuer", value: String(payload.iss), mono: true } : null,
    claimTime("Issued", payload.iat, now),
    claimTime("Expires", payload.exp, now, true)
  ];
  if (payload.exp === undefined && Object.keys(payload).length) list.push({ label: "Expires", value: "Never (no exp claim)", tone: "warn" });
  return list.filter((item): item is Insight => item !== null);
}

function decodeJwtSegments(token: string): Json | null {
  const [header, payload] = token.trim().split(".");
  if (!header || !payload) return null;
  const decode = (part: string) => {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))) as unknown;
  };
  try {
    return { header: decode(header), payload: decode(payload) };
  } catch {
    return null;
  }
}

function passwordInsights(password: string): Insight[] {
  const bits = Math.round(password.length * Math.log2(PASSWORD_ALPHABET.length));
  const strength: [string, InsightTone] =
    bits >= 100 ? ["Very strong", "good"] : bits >= 75 ? ["Strong", "good"] : bits >= 60 ? ["Fair", "warn"] : ["Weak", "bad"];
  return [
    { label: "Length", value: plural(password.length, "character") },
    { label: "Entropy", value: `≈ ${bits} bits` },
    { label: "Strength", value: strength[0], tone: strength[1], meter: Math.min(1, bits / 128) }
  ];
}

function sizeChange(input: string, output: string): Insight[] {
  const bytes = (value: string) => new TextEncoder().encode(value).length;
  if (!input) return [];
  return [{ label: "Bytes in → out", value: `${bytes(input)} → ${bytes(output)}` }];
}

function lineChange(input: string, output: string, what: string): Insight[] {
  const lines = (value: string) => (value ? value.split("\n").length : 0);
  const before = lines(input);
  const after = lines(output);
  const list: Insight[] = [{ label: "Lines in → out", value: `${before} → ${after}` }];
  if (before > after) list.push({ label: what, value: String(before - after) });
  return list;
}

const STATUS_CLASS: Record<string, [string, InsightTone | undefined]> = {
  "1": ["Informational", undefined], "2": ["Success", "good"], "3": ["Redirection", undefined],
  "4": ["Client error", "warn"], "5": ["Server error", "bad"]
};

/** The facts worth surfacing about one successful run. */
export function insightsFor(toolId: string, option: string, input: string, output: string, now = Date.now()): Insight[] {
  const parsed = parse(output);
  const data = asRecord(parsed);

  switch (toolId) {
    case "jwt":
    case "jwt-rsa":
      return data ? tokenInsights(data, now) : [];
    case "jwt-sign": {
      if (option === "verify") return [];
      const decoded = decodeJwtSegments(output);
      return decoded ? tokenInsights(decoded, now) : [];
    }
    case "hash":
      return [
        { label: "Algorithm", value: option, mono: true },
        { label: "Digest", value: `${output.trim().length * 4} bits · ${output.trim().length} hex characters` }
      ];
    case "uuid": {
      const value = output.trim();
      return [
        { label: "Version", value: `v${value[14] ?? "?"} (random)` },
        { label: "Variant", value: /^[89ab]$/i.test(value[19] ?? "") ? "RFC 9562" : "Other" },
        { label: "Unique", value: "122 random bits" }
      ];
    }
    case "password":
      return passwordInsights(output.trim());
    case "timestamp": {
      const ms = Number(data?.unixMilliseconds);
      return Number.isFinite(ms)
        ? [{ label: "Relative", value: relativeTime(ms, now) }, { label: "Unix seconds", value: String(data?.unixSeconds), mono: true }]
        : [];
    }
    case "iso-date": {
      const ms = Date.parse(output.trim());
      return Number.isFinite(ms) ? [{ label: "Relative", value: relativeTime(ms, now) }] : [];
    }
    case "timezone":
      return option ? [{ label: "Timezone", value: option, mono: true }] : [];
    case "regex":
    case "regex-safe": {
      const matches = Array.isArray(data?.matches) ? (data.matches as Json[]) : [];
      const groups = Array.isArray(matches[0]?.groups) ? (matches[0].groups as unknown[]).length : 0;
      const list: Insight[] = [{ label: "Matches", value: String(data?.count ?? matches.length) }];
      if (groups) list.push({ label: "Capture groups", value: String(groups) });
      if (toolId === "regex-safe") list.push({ label: "Backtracking", value: data?.safe === false ? "Stopped at the step limit" : "Within limits", tone: data?.safe === false ? "bad" : "good" });
      return list;
    }
    case "color": {
      const hex = text(data?.hex);
      return hex
        ? [
            { label: "Colour", value: hex, swatch: hex, mono: true },
            { label: "RGB", value: String(data?.rgb), mono: true },
            { label: "HSL", value: String(data?.hsl), mono: true }
          ]
        : [];
    }
    case "number":
      return data
        ? [
            { label: "Decimal", value: String(data.decimal), mono: true },
            { label: "Hex", value: String(data.hexadecimal), mono: true },
            { label: "Bits", value: String(String(data.binary).length) }
          ]
        : [];
    case "cron": {
      const runs = Array.isArray(data?.nextRuns) ? (data.nextRuns as string[]) : [];
      const next = runs[0] ? Date.parse(runs[0]) : NaN;
      return Number.isFinite(next)
        ? [
            { label: "Next run", value: relativeTime(next, now) },
            { label: "At", value: new Date(next).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) }
          ]
        : [];
    }
    case "csv": {
      if (option === "encode") return [{ label: "Rows", value: String(Math.max(0, output.trim().split("\n").length - 1)) }];
      const rows = Array.isArray(parsed) ? parsed : [];
      const columns = asRecord(rows[0]) ? Object.keys(rows[0] as Json).length : 0;
      return [{ label: "Rows", value: String(rows.length) }, { label: "Columns", value: String(columns) }];
    }
    case "csv-viewer":
      return data ? [{ label: "Rows", value: String(data.rows) }, { label: "Columns", value: String(data.columns) }] : [];
    case "url-parser": {
      if (!data) return [];
      const params = Object.keys(asRecord(data.query) ?? {}).length;
      return [
        { label: "Protocol", value: String(data.protocol).replace(/:$/, ""), tone: data.protocol === "https:" ? "good" : "warn" },
        { label: "Host", value: String(data.host), mono: true },
        { label: "Parameters", value: String(params) }
      ];
    }
    case "query":
      return data ? [{ label: "Parameters", value: String(Object.keys(data).length) }] : [];
    case "json-validator":
      return data ? [{ label: "Top-level type", value: String(data.type) }] : [];
    case "json":
      return option === "validate" && data ? [{ label: "Top-level type", value: String(data.type) }] : [];
    case "json-diff":
      return [{ label: "Differences", value: String(count(parsed) ?? 0) }];
    case "diff": {
      const lines = output.split("\n");
      return [
        { label: "Added", value: String(lines.filter((line) => line.startsWith("+")).length), tone: "good" },
        { label: "Removed", value: String(lines.filter((line) => line.startsWith("-")).length), tone: "bad" }
      ];
    }
    case "json-schema":
      return data ? [{ label: "Failures", value: String(count(data.errors) ?? 0), tone: data.valid ? "good" : "bad" }] : [];
    case "openapi-viewer":
      return data
        ? [
            { label: "API", value: `${String(data.title)} ${String(data.version)}` },
            { label: "OpenAPI", value: String(data.openapi), mono: true },
            { label: "Endpoints", value: String(data.endpointCount) }
          ]
        : [];
    case "openapi-validator":
      return data ? [{ label: "Spec version", value: String(data.version) }, { label: "Problems", value: String(count(data.errors) ?? 0), tone: data.valid ? "good" : "bad" }] : [];
    case "openapi-diff":
      return data ? [{ label: "Breaking changes", value: String(count(data.breakingChanges) ?? 0), tone: data.breaking ? "bad" : "good" }] : [];
    case "docker-compose":
      return data ? [{ label: "Services", value: String(count(data.services) ?? 0) }, { label: "Problems", value: String(count(data.errors) ?? 0), tone: data.valid ? "good" : "bad" }] : [];
    case "cert":
    case "pem": {
      const certificate = asRecord(data?.certificate);
      const list: Insight[] = data ? [{ label: "Block", value: String(data.type), mono: true }] : [];
      if (certificate) {
        const until = Date.parse(String(certificate.notAfter));
        if (text(certificate.subject)) list.push({ label: "Subject", value: String(certificate.subject), mono: true });
        if (Number.isFinite(until)) list.push({ label: "Expires", value: relativeTime(until, now), tone: until < now ? "bad" : "good" });
      }
      return list;
    }
    case "semver":
      return data ? [{ label: "Result", value: String(data.relation) }] : [];
    case "log-redactor": {
      const findings = Array.isArray(data?.findings) ? (data.findings as string[]) : [];
      return [{ label: "Masked", value: findings.length ? findings.join(", ") : "Nothing", tone: findings.length ? "good" : "warn" }];
    }
    case "protobuf":
      return data ? [{ label: "Fields", value: String(count(data.fields) ?? 0) }, { label: "Bytes", value: String(data.byteLength) }] : [];
    case "asn1":
      return data ? [{ label: "Top-level nodes", value: String(count(data.nodes) ?? 0) }, { label: "Bytes", value: String(data.byteLength) }] : [];
    case "hex":
      return data ? [{ label: "Bytes", value: String(data.byteLength) }] : [];
    case "iso-bitmap":
      return data ? [{ label: "Data elements", value: String(count(data.enabledDataElements) ?? 0) }, { label: "Secondary bitmap", value: data.secondaryBitmap ? "Yes" : "No" }] : [];
    case "iso8583":
      return data ? [{ label: "MTI", value: String(data.mti), mono: true }, { label: "Fields", value: String(Object.keys(asRecord(data.fields) ?? {}).length) }] : [];
    case "emv-tlv":
      return [{ label: "Tags", value: String(count(parsed) ?? 0) }];
    case "luhn":
      return data ? [{ label: "Check digit", value: String(data.checkDigit), mono: true }, { label: "Masked", value: String(data.masked), mono: true }] : [];
    case "track2": {
      const expiry = text(data?.expiryYYMM);
      const list: Insight[] = [];
      if (expiry && /^\d{4}$/.test(expiry)) {
        const year = 2000 + Number(expiry.slice(0, 2));
        const month = Number(expiry.slice(2));
        const endOfMonth = Date.UTC(year, month, 1) - 1;
        list.push({ label: "Expiry", value: `${String(month).padStart(2, "0")}/${year}`, tone: endOfMonth < now ? "bad" : "good" });
      }
      if (text(data?.serviceCode)) list.push({ label: "Service code", value: String(data?.serviceCode), mono: true });
      return list;
    }
    case "image-base64":
      return data ? [{ label: "Type", value: String(data.mime), mono: true }, { label: "Size", value: `${String(data.base64Bytes)} bytes` }] : [];
    case "status": {
      const code = input.trim().slice(0, 3);
      const kind = STATUS_CLASS[code[0] ?? ""];
      return kind && /^\d{3}$/.test(code) ? [{ label: "Class", value: `${code[0]}xx · ${kind[0]}`, tone: kind[1] }] : [];
    }
    case "webhook": {
      const summary = asRecord(data?.summary) ?? {};
      return Object.entries(summary).slice(0, 3).map(([key, value]) => ({ label: key.charAt(0).toUpperCase() + key.slice(1), value: String(value), mono: true }));
    }
    case "gitignore":
      return [{ label: "Rules", value: String(output.split("\n").filter((line) => line.trim() && !line.startsWith("#")).length) }];
    case "env":
      return [{ label: "Variables", value: String(output.split("\n").filter((line) => /^[A-Za-z_][\w.]*=/.test(line)).length) }];
    case "line-dedupe":
      return lineChange(input, output, "Duplicates removed");
    case "line-sort":
      return lineChange(input, output, "Lines removed");
    case "whitespace":
      return sizeChange(input, output);
    case "base64":
    case "url":
    case "html":
    case "bcd":
    case "ebcdic":
      return sizeChange(input, output);
    default:
      return [];
  }
}
