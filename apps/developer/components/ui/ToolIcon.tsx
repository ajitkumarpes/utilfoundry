import {
  ArrowRight, Braces, Clock3, Code2, Globe2, Hash, KeyRound, ShieldCheck, Sparkles,
  Terminal, Type, type LucideIcon
} from "lucide-react";

/** Keyed by tool id, matching lib/tools.ts. */
const ICONS: Record<string, LucideIcon> = {
  json: Braces, base64: Code2, url: ArrowRight, jwt: KeyRound, hash: Hash, uuid: Sparkles,
  timestamp: Clock3, regex: Terminal, markdown: Type, yaml: Braces, curl: Terminal, diff: Code2,
  xml: Braces, csv: Code2, html: Type, sql: Terminal, graphql: Code2, query: ArrowRight,
  number: Hash, color: Sparkles, status: ShieldCheck, cron: Clock3, "json-validator": Braces,
  "json-minifier": Braces, jsonpath: Braces, "json-diff": Code2, "xml-validator": Braces,
  "yaml-formatter": Braces, password: KeyRound, whitespace: Type, "line-sort": Type,
  "line-dedupe": Type, "iso-date": Clock3, timezone: Clock3, "url-parser": ArrowRight,
  "code-formatter": Code2, "csv-viewer": Code2, mime: Globe2, "openapi-viewer": Code2,
  "openapi-validator": ShieldCheck, "json-schema": ShieldCheck, "regex-visualizer": Terminal,
  "docker-compose": Terminal, gitignore: Code2, nginx: Terminal, "jwt-sign": KeyRound,
  cert: ShieldCheck, pem: KeyRound, webhook: Code2, "api-request": Terminal,
  "image-base64": Code2, qr: Sparkles, semver: Hash, env: Terminal, "openapi-diff": ShieldCheck,
  "json-schema-generator": Braces, "jwt-rsa": KeyRound, "log-redactor": ShieldCheck,
  protobuf: Braces, asn1: Braces, "regex-safe": Terminal, hex: Hash, binary: Hash, bcd: Hash,
  ebcdic: Code2, "iso-bitmap": Braces, iso8583: ShieldCheck, "emv-tlv": Braces,
  luhn: ShieldCheck, track2: ShieldCheck
};

/** The accent each tool carries through its card, sidebar glyph and hero tile. */
export const ACCENTS: Record<string, { color: string; tint: string }> = {
  violet: { color: "#7956dd", tint: "#eeeaff" },
  blue: { color: "#4576d8", tint: "#e9f1ff" },
  cyan: { color: "#2495ad", tint: "#e7f8fb" },
  amber: { color: "#b98215", tint: "#fff5dc" },
  rose: { color: "#d35a76", tint: "#ffebf0" },
  green: { color: "#3c9b5e", tint: "#e9f8ee" },
  orange: { color: "#d17836", tint: "#fff0e5" },
  indigo: { color: "#5b6fcb", tint: "#edf0ff" },
  slate: { color: "#67717d", tint: "#eef0f2" },
  teal: { color: "#30947d", tint: "#e6f8f4" },
  pink: { color: "#bf569e", tint: "#fceafa" },
  lime: { color: "#679c3a", tint: "#eef8df" }
};

export function ToolIcon({ id, size = 18, strokeWidth = 1.9 }: { id: string; size?: number; strokeWidth?: number }) {
  const Icon = ICONS[id] ?? Code2;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}
