/**
 * The explanatory copy around each tool: why to use it and how to get a good
 * result. Kept apart from lib/tools.ts so the registry stays a list of behaviour
 * and this file stays a list of words.
 *
 * Every claim here has to be true of this implementation. These tools all run in
 * the browser with no account and no upload, so those claims are shared; the rest
 * is written per category, which is the level at which the advice actually differs.
 */

import { TOOLS, type ToolCategory, type ToolDefinition } from "./tools";

export type ReasonIcon = "shield" | "lock" | "zap" | "eye" | "clock" | "code" | "key" | "card" | "braces";
export type Tone = "green" | "blue" | "purple" | "amber";

export type Reason = { icon: ReasonIcon; tone: Tone; title: string; note: string };

const FREE: Reason = { icon: "shield", tone: "green", title: "100% Free", note: "No account, no sign-up, no limits" };
const LOCAL: Reason = { icon: "lock", tone: "blue", title: "Nothing is uploaded", note: "The tool runs in this browser tab" };
const INSTANT: Reason = { icon: "zap", tone: "purple", title: "Immediate result", note: "Press Run and read the output beside your input" };

/** The fourth reason, and the tips, are what actually differ between categories. */
const BY_CATEGORY: Record<ToolCategory, { reason: Reason; tips: string[] }> = {
  "Format & validate": {
    reason: { icon: "braces", tone: "amber", title: "Errors in plain words", note: "A broken document reports what stopped the parser" },
    tips: [
      "Formatting a document also validates it: if it will not format, it will not parse.",
      "Minify for transport, format again when you need to read it.",
      "Keep inputs under about 2 MB so the tab stays responsive."
    ]
  },
  JSON: {
    reason: { icon: "braces", tone: "amber", title: "Built for nested data", note: "Reach into deep structures without scrolling" },
    tips: [
      "JSONPath starts at $, so $.user.name reads the name inside user.",
      "The diff tools take two documents separated by a line containing ---.",
      "A generated schema is a starting point to edit, not a finished contract."
    ]
  },
  "Encode & decode": {
    reason: { icon: "code", tone: "amber", title: "Both directions", note: "Switch Mode to reverse the conversion" },
    tips: [
      "Base64 here is UTF-8 safe, so accented and non-Latin text survives the round trip.",
      "URL encoding escapes a value for one part of a URL, not a whole URL.",
      "Decoding refuses input that is not valid, rather than returning something misleading."
    ]
  },
  Encoding: {
    reason: { icon: "code", tone: "amber", title: "Reads raw bytes", note: "Inspect wire formats without a schema" },
    tips: [
      "Spacing between hex bytes is ignored, so paste a dump as you copied it.",
      "Protobuf without a .proto shows field numbers and wire types, not field names.",
      "DER output nests, so a constructed tag lists the tags it contains."
    ]
  },
  Converters: {
    reason: { icon: "zap", tone: "amber", title: "One paste, every form", note: "See the equivalent values side by side" },
    tips: [
      "Pick the base your number is written in before running the converter.",
      "Timestamps under eleven digits are read as seconds, longer ones as milliseconds.",
      "CSV conversion expects a header row."
    ]
  },
  Text: {
    reason: { icon: "eye", tone: "amber", title: "See what changed", note: "Matches and differences are listed, not just highlighted" },
    tips: [
      "Add the g flag to list every match instead of only the first.",
      "The diff tools take two snippets separated by a line containing ---.",
      "Use the safe regex tester for patterns that might backtrack badly."
    ]
  },
  Code: {
    reason: { icon: "code", tone: "amber", title: "Consistent formatting", note: "The same output every time, whoever runs it" },
    tips: [
      "Choose the language before formatting; the formatter does not guess.",
      "Formatting never changes behaviour, only layout.",
      "Config files are parsed as well as formatted, so mistakes surface here."
    ]
  },
  Web: {
    reason: { icon: "code", tone: "amber", title: "Request-shaped", note: "Built around what you actually send and receive" },
    tips: [
      "Describe a request as JSON with method, url, headers and body.",
      "A generated command is text: read it before you run it.",
      "Query parsing accepts a full URL or a bare query string."
    ]
  },
  API: {
    reason: { icon: "shield", tone: "amber", title: "Specification-aware", note: "Checked against the OpenAPI schema, not a guess" },
    tips: [
      "Validation reports the path to each problem, so fix them from the top down.",
      "The diff flags removals, which are what usually break a client.",
      "A summary lists every path and the methods it accepts."
    ]
  },
  Security: {
    reason: { icon: "key", tone: "amber", title: "Secrets stay in this tab", note: "Nothing you paste is sent anywhere" },
    tips: [
      "Decoding a token is not verifying it: anyone can read a JWT payload.",
      "Use throwaway secrets and keys here, and clear the page when you finish.",
      "The page warns you when an input looks like a real credential."
    ]
  },
  Payments: {
    reason: { icon: "card", tone: "amber", title: "Test data only", note: "Built for masked samples, never production traffic" },
    tips: [
      "Use documented test numbers such as 4111 1111 1111 1111.",
      "Mask the PAN before pasting anything from a log or a trace.",
      "Fields are parsed positionally, so keep the layout of the original message."
    ]
  },
  Generators: {
    reason: { icon: "shield", tone: "amber", title: "Cryptographic randomness", note: "Values come from the browser's secure random source" },
    tips: [
      "Run again for a fresh value; nothing is stored between runs.",
      "Generated secrets are only as safe as where you paste them next.",
      "A cron explanation lists the next times the schedule fires."
    ]
  },
  Time: {
    reason: { icon: "clock", tone: "amber", title: "Timezone accurate", note: "Uses the browser's own IANA timezone data" },
    tips: [
      "ISO output is always UTC, which is what most APIs expect.",
      "Enter an IANA name such as Asia/Kolkata rather than an offset.",
      "Daylight saving is applied for the date you enter, not today."
    ]
  },
  Data: {
    reason: { icon: "eye", tone: "amber", title: "Read before you load", note: "See the shape of a file without opening a spreadsheet" },
    tips: [
      "A header row is required to name the columns.",
      "The summary counts rows and shows the first of them.",
      "Convert to JSON when you want to work with the rows in code."
    ]
  }
};

export function reasonsFor(tool: ToolDefinition): Reason[] {
  return [FREE, LOCAL, INSTANT, BY_CATEGORY[tool.category].reason];
}

export function tipsFor(tool: ToolDefinition): string[] {
  return BY_CATEGORY[tool.category].tips;
}

/** Neighbours from the same category, which is what someone usually wants next. */
export function relatedTo(tool: ToolDefinition, limit = 4): ToolDefinition[] {
  const sameCategory = TOOLS.filter((item) => item.category === tool.category && item.id !== tool.id);
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);
  const sameAccent = TOOLS.filter((item) => item.id !== tool.id && item.accent === tool.accent && item.category !== tool.category);
  return [...sameCategory, ...sameAccent].slice(0, limit);
}
