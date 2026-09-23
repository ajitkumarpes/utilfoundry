import {
  ArrowDownAZ, ArrowUpDown, BadgeCheck, Binary, BookOpen, Boxes, Braces, Calculator, CalendarClock, CalendarDays,
  CheckCheck, Clock3, Code2, CodeXml, Container, Cpu, CreditCard, Database, Diff, Earth, Eraser, EyeOff, FileCheck2,
  FileCode2, FileDigit, FileKey2, FileType, Fingerprint, GitBranch, GitCompare, GitCompareArrows, Grid3x3, Hash,
  Hexagon, Image, KeyRound, Layers, Link, Link2, ListChecks, ListTree, ListX, LockKeyhole, Minimize2, Network, Nfc,
  Palette, QrCode, Regex, ScrollText, Send, Server, Sheet, ShieldAlert, ShieldCheck, ShieldHalf, Sigma, SquareM,
  Stamp, Table2, Tags, Terminal, TextSearch, AlignLeft, Variable, Wallet, Wand2, Waypoints, Webhook, Workflow,
  type LucideIcon
} from "lucide-react";

/** Keyed by tool id, matching lib/tools.ts. */
const ICONS: Record<string, LucideIcon> = {
  json: Braces, base64: FileDigit, url: Link2, jwt: KeyRound, hash: Hash, uuid: Fingerprint,
  timestamp: Clock3, regex: Regex, markdown: SquareM, yaml: ArrowUpDown, curl: Terminal, diff: GitCompare,
  xml: FileCode2, csv: Sheet, html: CodeXml, sql: Database, graphql: Waypoints, query: ListTree,
  number: Calculator, color: Palette, status: Server, cron: CalendarClock, "json-validator": BadgeCheck,
  "json-minifier": Minimize2, jsonpath: TextSearch, "json-diff": Diff, "xml-validator": FileCheck2,
  "yaml-formatter": AlignLeft, password: LockKeyhole, whitespace: Eraser, "line-sort": ArrowDownAZ,
  "line-dedupe": ListX, "iso-date": CalendarDays, timezone: Earth, "url-parser": Link,
  "code-formatter": Code2, "csv-viewer": Table2, mime: FileType, "openapi-viewer": BookOpen,
  "openapi-validator": ShieldCheck, "json-schema": ListChecks, "regex-visualizer": Workflow,
  "docker-compose": Container, gitignore: GitBranch, nginx: Network, "jwt-sign": Stamp,
  cert: ScrollText, pem: FileKey2, webhook: Webhook, "api-request": Send,
  "image-base64": Image, qr: QrCode, semver: Tags, env: Variable, "openapi-diff": GitCompareArrows,
  "json-schema-generator": Wand2, "jwt-rsa": ShieldHalf, "log-redactor": EyeOff,
  protobuf: Boxes, asn1: Layers, "regex-safe": ShieldAlert, hex: Hexagon, binary: Binary, bcd: Sigma,
  ebcdic: Cpu, "iso-bitmap": Grid3x3, iso8583: CreditCard, "emv-tlv": Nfc,
  luhn: CheckCheck, track2: Wallet
};

/**
 * The accent each tool carries through its sidebar glyph and hero tile. `color` is a CSS
 * variable each theme sets to a shade that reads on its own background; the tile keeps a
 * pale `tint` with a deep `ink` glyph in both themes, the way the hero tile is drawn.
 */
export const ACCENTS: Record<string, { color: string; tint: string; ink: string }> = Object.fromEntries(
  ["violet", "blue", "cyan", "amber", "rose", "green", "orange", "indigo", "slate", "teal", "pink", "lime"].map(
    (name) => [name, { color: `var(--acc-${name})`, tint: `var(--acc-${name}-tint)`, ink: `var(--acc-${name}-ink)` }]
  )
);

export function ToolIcon({ id, size = 18, strokeWidth = 1.9 }: { id: string; size?: number; strokeWidth?: number }) {
  const Icon = ICONS[id] ?? Code2;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}
