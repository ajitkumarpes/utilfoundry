/**
 * Advice for getting a good result from each tool, written per category — the level at
 * which the advice actually differs. Kept apart from lib/tools.ts so the registry stays a
 * list of behaviour and this file stays a list of words. Every tip has to be true of this
 * implementation.
 */

import { TOOLS, type ToolCategory, type ToolDefinition } from "./tools";

const TIPS: Record<ToolCategory, string[]> = {
  "Format & validate": [
    "Formatting a document also validates it: if it will not format, it will not parse.",
    "Minify for transport, format again when you need to read it.",
    "Keep inputs under about 2 MB so the tab stays responsive."
  ],
  JSON: [
    "JSONPath starts at $, so $.user.name reads the name inside user.",
    "JSON Diff compares by path, so reordered keys are not reported as changes.",
    "A generated schema is a starting point to edit, not a finished contract."
  ],
  "Encode & decode": [
    "Base64 here is UTF-8 safe, so accented and non-Latin text survives the round trip.",
    "URL encoding escapes a value for one part of a URL, not a whole URL.",
    "Decoding refuses input that is not valid, rather than returning something misleading."
  ],
  Encoding: [
    "Spacing between hex bytes is ignored, so paste a dump as you copied it.",
    "Protobuf without a .proto shows field numbers and wire types, not field names.",
    "DER output nests, so a constructed tag lists the tags it contains."
  ],
  Converters: [
    "Pick the base your number is written in before running the converter.",
    "Timestamps under eleven digits are read as seconds, longer ones as milliseconds.",
    "CSV conversion expects a header row."
  ],
  Text: [
    "Add the g flag to list every match instead of only the first.",
    "Text Diff compares line by line: + marks an added line, - a removed one.",
    "Use the safe regex tester for patterns that might backtrack badly."
  ],
  Code: [
    "Choose the language before formatting; the formatter does not guess.",
    "Formatting never changes behaviour, only layout.",
    "Config files are parsed as well as formatted, so mistakes surface here."
  ],
  Web: [
    "Describe a request as JSON with method, url, headers and body.",
    "A generated command is text: read it before you run it.",
    "Query parsing accepts a full URL or a bare query string."
  ],
  API: [
    "Validation reports the path to each problem, so fix them from the top down.",
    "The diff flags removals, which are what usually break a client.",
    "A summary lists every path and the methods it accepts."
  ],
  Security: [
    "Decoding a token is not verifying it: anyone can read a JWT payload.",
    "Use throwaway secrets and keys here, and clear the page when you finish.",
    "The page warns you when an input looks like a real credential."
  ],
  Payments: [
    "Use documented test numbers such as 4111 1111 1111 1111.",
    "Mask the PAN before pasting anything from a log or a trace.",
    "Fields are parsed positionally, so keep the layout of the original message."
  ],
  Generators: [
    "Run again for a fresh value; nothing is stored between runs.",
    "Generated secrets are only as safe as where you paste them next.",
    "A cron explanation lists the next times the schedule fires."
  ],
  Time: [
    "ISO output is always UTC, which is what most APIs expect.",
    "Enter an IANA name such as Asia/Kolkata rather than an offset.",
    "Daylight saving is applied for the date you enter, not today."
  ],
  Data: [
    "A header row is required to name the columns.",
    "The summary counts rows and shows the first of them.",
    "Convert to JSON when you want to work with the rows in code."
  ]
};

export function tipsFor(tool: ToolDefinition): string[] {
  return TIPS[tool.category];
}

/** Neighbours from the same category, which is what someone usually wants next. */
export function relatedTo(tool: ToolDefinition, limit = 4): ToolDefinition[] {
  const sameCategory = TOOLS.filter((item) => item.category === tool.category && item.id !== tool.id);
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);
  const sameAccent = TOOLS.filter((item) => item.id !== tool.id && item.accent === tool.accent && item.category !== tool.category);
  return [...sameCategory, ...sameAccent].slice(0, limit);
}
