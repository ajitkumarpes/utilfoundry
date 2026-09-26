/**
 * How each tool is driven and described around the editors: the controls in the options
 * bar, the language each pane holds, and the words the result banner uses. Kept apart
 * from lib/tools.ts so the catalog stays a flat list and this file owns the per-tool UI.
 */

export type Choice = { value: string; label: string };
export type OptionField = "option" | "pattern" | "flags" | "secret";

export type OptionControl =
  | { kind: "radio"; field: "option"; label: string; choices: Choice[] }
  | { kind: "select"; field: "option"; label: string; choices: Choice[] }
  | {
      kind: "text";
      field: OptionField;
      label: string;
      placeholder?: string;
      inputType?: "text" | "number" | "password";
      size?: "narrow" | "wide";
      suggestions?: string[];
      min?: number;
      max?: number;
    };

export type ToolOptions = { title: string; controls: OptionControl[] };

const ENCODE_DECODE: Choice[] = [
  { value: "encode", label: "Encode" },
  { value: "decode", label: "Decode" }
];

const COMMON_TIMEZONES = [
  "UTC", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago",
  "America/Los_Angeles", "America/Sao_Paulo", "Asia/Kolkata", "Asia/Dubai",
  "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"
];

const OPTIONS: Record<string, ToolOptions> = {
  json: {
    title: "Output options",
    controls: [{
      kind: "radio", field: "option", label: "Output",
      choices: [
        { value: "pretty", label: "Pretty print" },
        { value: "minify", label: "Minify" },
        { value: "validate", label: "Validate only" }
      ]
    }]
  },
  base64: { title: "Mode", controls: [{ kind: "radio", field: "option", label: "Mode", choices: ENCODE_DECODE }] },
  url: { title: "Mode", controls: [{ kind: "radio", field: "option", label: "Mode", choices: ENCODE_DECODE }] },
  yaml: {
    title: "Direction",
    controls: [{
      kind: "radio", field: "option", label: "Direction",
      choices: [{ value: "decode", label: "YAML → JSON" }, { value: "encode", label: "JSON → YAML" }]
    }]
  },
  csv: {
    title: "Direction",
    controls: [{
      kind: "radio", field: "option", label: "Direction",
      choices: [{ value: "decode", label: "CSV → JSON" }, { value: "encode", label: "JSON → CSV" }]
    }]
  },
  html: {
    title: "Mode",
    controls: [{
      kind: "radio", field: "option", label: "Mode",
      choices: [{ value: "encode", label: "Escape" }, { value: "decode", label: "Unescape" }]
    }]
  },
  hex: {
    title: "Direction",
    controls: [{
      kind: "radio", field: "option", label: "Direction",
      choices: [{ value: "encode", label: "Text → hex" }, { value: "decode", label: "Hex → text" }]
    }]
  },
  // Packing is the only one with a real choice to make, so the filler the payments
  // world actually uses is named rather than hidden.
  bcd: {
    title: "Mode",
    controls: [{
      kind: "radio", field: "option", label: "Mode",
      choices: [
        { value: "encode", label: "Pack (F filler)" },
        { value: "encode-zero", label: "Pack (leading 0)" },
        { value: "decode", label: "Unpack" }
      ]
    }]
  },
  binary: {
    title: "Direction",
    controls: [{
      kind: "radio", field: "option", label: "Direction",
      choices: [{ value: "hex-to-binary", label: "Hex → binary" }, { value: "binary-to-hex", label: "Binary → hex" }]
    }]
  },
  hash: {
    title: "Algorithm",
    controls: [{
      kind: "radio", field: "option", label: "Algorithm",
      choices: ["SHA-256", "SHA-384", "SHA-512", "SHA-1"].map((value) => ({ value, label: value }))
    }]
  },
  number: {
    title: "Input base",
    controls: [{
      kind: "radio", field: "option", label: "Input base",
      choices: [
        { value: "2", label: "Binary" },
        { value: "8", label: "Octal" },
        { value: "10", label: "Decimal" },
        { value: "16", label: "Hex" }
      ]
    }]
  },
  regex: {
    title: "Pattern",
    controls: [
      { kind: "text", field: "pattern", label: "Pattern", placeholder: "\\b\\w+\\b", size: "wide" },
      { kind: "text", field: "flags", label: "Flags", placeholder: "g", size: "narrow" }
    ]
  },
  "regex-safe": {
    title: "Pattern",
    controls: [
      { kind: "text", field: "pattern", label: "Pattern", placeholder: "^a+$", size: "wide" },
      { kind: "text", field: "flags", label: "Flags", placeholder: "g", size: "narrow" }
    ]
  },
  jsonpath: {
    title: "Query",
    controls: [{ kind: "text", field: "option", label: "Path", placeholder: "$.user.name", size: "wide" }]
  },
  timezone: {
    title: "Convert to",
    controls: [{ kind: "text", field: "option", label: "Timezone", placeholder: "Asia/Kolkata", suggestions: COMMON_TIMEZONES }]
  },
  "code-formatter": {
    title: "Language",
    controls: [{
      kind: "select", field: "option", label: "Language",
      choices: [
        { value: "javascript", label: "JavaScript" },
        { value: "typescript", label: "TypeScript" },
        { value: "json", label: "JSON" },
        { value: "css", label: "CSS" },
        { value: "html", label: "HTML" }
      ]
    }]
  },
  password: {
    title: "Options",
    controls: [{ kind: "text", field: "option", label: "Length", inputType: "number", min: 8, max: 128, size: "narrow" }]
  },
  "jwt-sign": {
    title: "Mode",
    controls: [
      { kind: "radio", field: "option", label: "Mode", choices: [{ value: "sign", label: "Sign" }, { value: "verify", label: "Verify" }] },
      { kind: "text", field: "secret", label: "HMAC secret", inputType: "password" }
    ]
  }
};

export function optionsFor(toolId: string): ToolOptions | null {
  return OPTIONS[toolId] ?? null;
}

/** The radio group the "reverse" quick action flips, for tools that convert both ways. */
export function reverseChoice(toolId: string, option: string): Choice | null {
  const control = OPTIONS[toolId]?.controls[0];
  if (!control || control.kind !== "radio" || control.choices.length !== 2) return null;
  if (!["base64", "url", "yaml", "csv", "html", "hex", "binary"].includes(toolId)) return null;
  return control.choices.find((choice) => choice.value !== option) ?? null;
}

/* --------------------------------------------------------------------------
   Pane languages — shown in each editor's status line and used to pick
   syntax colouring and the download extension.
   -------------------------------------------------------------------------- */

const JSON_INPUT = new Set([
  "json", "json-validator", "json-minifier", "jsonpath", "json-diff", "json-schema",
  "json-schema-generator", "webhook", "curl", "api-request"
]);

const INPUT_LANGUAGE: Record<string, string> = {
  xml: "XML", "xml-validator": "XML", sql: "SQL", graphql: "GraphQL", markdown: "Markdown",
  html: "HTML", nginx: "Nginx", "docker-compose": "YAML", "yaml-formatter": "YAML", env: "ENV",
  cert: "PEM", pem: "PEM", jwt: "JWT", "jwt-rsa": "JWT + JWK", "openapi-viewer": "JSON / YAML",
  "openapi-validator": "JSON / YAML", "openapi-diff": "JSON / YAML", cron: "Cron",
  "regex-visualizer": "Regex", protobuf: "Hex", asn1: "Hex", ebcdic: "Hex", "emv-tlv": "Hex",
  "iso-bitmap": "Hex", "image-base64": "Data URL", csv: "CSV", "csv-viewer": "CSV"
};

const CODE_LANGUAGE: Record<string, string> = {
  javascript: "JavaScript", typescript: "TypeScript", json: "JSON", css: "CSS", html: "HTML"
};

export function inputLanguage(toolId: string, option: string): string {
  if (JSON_INPUT.has(toolId)) return "JSON";
  if (toolId === "yaml") return option === "encode" ? "JSON" : "YAML";
  if (toolId === "csv") return option === "encode" ? "JSON" : "CSV";
  if (toolId === "jwt-sign") return option === "verify" ? "JWT" : "JSON";
  if (toolId === "code-formatter") return CODE_LANGUAGE[option] ?? "JavaScript";
  if (toolId === "hex") return option === "decode" ? "Hex" : "Text";
  if (toolId === "binary") return option === "binary-to-hex" ? "Binary" : "Hex";
  return INPUT_LANGUAGE[toolId] ?? "Text";
}

function looksLikeJsonDocument(value: string) {
  const start = value.trimStart()[0];
  if (start !== "{" && start !== "[") return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function outputLanguage(toolId: string, option: string, output: string): string {
  if (toolId === "qr" && output.startsWith("data:image/")) return "PNG";
  if (toolId === "markdown") return "HTML";
  if (toolId === "yaml") return option === "encode" ? "YAML" : "JSON";
  if (toolId === "csv") return option === "encode" ? "CSV" : "JSON";
  if (toolId === "code-formatter") return CODE_LANGUAGE[option] ?? "JavaScript";
  if (looksLikeJsonDocument(output)) return "JSON";
  const fixed: Record<string, string> = {
    "yaml-formatter": "YAML", xml: "XML", sql: "SQL", graphql: "GraphQL", nginx: "Nginx", env: "ENV",
    gitignore: "gitignore", curl: "Shell", jwt: "JSON", diff: "Diff"
  };
  return fixed[toolId] ?? "Text";
}

const EXTENSIONS: Record<string, string> = {
  JSON: "json", YAML: "yaml", XML: "xml", SQL: "sql", GraphQL: "graphql", HTML: "html",
  CSV: "csv", ENV: "env", Nginx: "conf", JavaScript: "js", TypeScript: "ts", CSS: "css",
  Shell: "sh", gitignore: "gitignore", PNG: "png", Markdown: "md", Diff: "diff"
};

/**
 * The ways an output can be looked at, first one shown by default. A JSON document can also be
 * browsed as a tree; Markdown is read rendered, with its HTML a click away. Everything else is
 * text, and gets no switcher at all.
 */
export type OutputView = "code" | "tree" | "preview";

/** Past this, building a tree of every node would stall the tab. */
const TREE_LIMIT = 1_000_000;

export function outputViews(toolId: string, output: string): OutputView[] {
  if (!output) return [];
  if (toolId === "markdown") return ["preview", "code"];
  // The QR code is the picture itself; a data URL made from an image is text to copy, with
  // the picture it encodes one click away.
  if (output.startsWith("data:image/")) return toolId === "qr" ? [] : ["code", "preview"];
  if (output.length <= TREE_LIMIT && looksLikeJsonDocument(output)) return ["code", "tree"];
  return [];
}

/**
 * Tools whose JSON output is the visitor's own data rather than a report about it. Object and
 * array counts describe the former; on a validator's report they would only be noise.
 */
const DATA_OUTPUT = new Set(["json", "json-minifier", "jsonpath", "webhook", "yaml", "csv", "json-schema-generator"]);

export function outputIsData(toolId: string): boolean {
  return DATA_OUTPUT.has(toolId);
}

export function downloadExtension(language: string): string {
  return EXTENSIONS[language] ?? "txt";
}

/* --------------------------------------------------------------------------
   Words around the panes and the result banner.
   -------------------------------------------------------------------------- */

/** "JSON" stays "JSON", "Date or timestamp" reads "date or timestamp" mid-sentence. */
function midSentence(label: string) {
  const [first] = label.split(" ");
  const isAcronymOrName = /[A-Z]/.test(first.slice(1));
  return isAcronymOrName ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

export function inputSubtitle(inputLabel: string): string {
  return `Paste or edit your ${midSentence(inputLabel)}, then click “Run tool”.`;
}

/** What the output pane holds, as a short noun phrase. */
const OUTPUT_NOUN: Record<string, string | Record<string, string>> = {
  json: { pretty: "Formatted JSON", minify: "Minified JSON", validate: "Validation result" },
  base64: { encode: "Base64 text", decode: "Decoded text" },
  url: { encode: "Encoded value", decode: "Decoded value" },
  jwt: "Decoded header and payload",
  hash: "Hex digest",
  uuid: "Generated UUID",
  timestamp: "Converted time",
  regex: "Matches",
  markdown: "Rendered preview",
  yaml: { decode: "Converted JSON", encode: "Converted YAML" },
  curl: "cURL command",
  diff: "Line differences",
  xml: "Formatted XML",
  csv: { decode: "Converted JSON", encode: "Converted CSV" },
  html: { encode: "Escaped text", decode: "Unescaped text" },
  sql: "Formatted SQL",
  graphql: "Formatted GraphQL",
  query: "Parsed parameters",
  number: "Every base",
  color: "Every notation",
  status: "Meaning",
  cron: "Next runs",
  "json-validator": "Validation result",
  "json-minifier": "Minified JSON",
  jsonpath: "Matched values",
  "json-diff": "Changed fields",
  "xml-validator": "Validation result",
  "yaml-formatter": "Formatted YAML",
  password: "Generated password",
  whitespace: "Cleaned text",
  "line-sort": "Sorted lines",
  "line-dedupe": "Unique lines",
  "iso-date": "ISO 8601 timestamp",
  timezone: "Local time",
  "url-parser": "URL components",
  "code-formatter": "Formatted code",
  "csv-viewer": "CSV summary",
  mime: "MIME lookup",
  "openapi-viewer": "API summary",
  "openapi-validator": "Validation result",
  "json-schema": "Validation result",
  "regex-visualizer": "Pattern tokens",
  "docker-compose": "Compose check",
  gitignore: "Ignore rules",
  nginx: "Formatted config",
  "jwt-sign": { sign: "Signed token", verify: "Verification result" },
  cert: "Certificate details",
  pem: "PEM details",
  webhook: "Formatted payload",
  "api-request": "fetch() and cURL",
  "image-base64": "Image details",
  qr: "QR code",
  semver: "Comparison",
  env: "Formatted variables",
  "openapi-diff": "Breaking changes",
  "json-schema-generator": "Draft schema",
  "jwt-rsa": "Verification result",
  "log-redactor": "Redacted log",
  protobuf: "Decoded fields",
  asn1: "DER structure",
  "regex-safe": "Matches",
  hex: { encode: "Hex bytes", decode: "Decoded text" },
  binary: { "hex-to-binary": "Binary digits", "binary-to-hex": "Hex value" },
  bcd: { encode: "Packed BCD", "encode-zero": "Packed BCD", decode: "Unpacked digits" },
  ebcdic: "Decoded text",
  "iso-bitmap": "Enabled data elements",
  iso8583: "Message fields",
  "emv-tlv": "TLV tags",
  luhn: "Luhn result",
  track2: "Track 2 fields"
};

export function outputNoun(toolId: string, option: string): string {
  const noun = OUTPUT_NOUN[toolId];
  if (!noun) return "Result";
  if (typeof noun === "string") return noun;
  return noun[option] ?? Object.values(noun)[0];
}

export function outputSubtitle(toolId: string, option: string): string {
  return `${outputNoun(toolId, option)} (read-only).`;
}

/** Past-tense verb for a plain success, e.g. "Formatted successfully". */
const VERB: Record<string, string | Record<string, string>> = {
  base64: { encode: "Encoded", decode: "Decoded" },
  url: { encode: "Encoded", decode: "Decoded" },
  html: { encode: "Escaped", decode: "Unescaped" },
  hex: { encode: "Encoded", decode: "Decoded" },
  bcd: { encode: "Packed", "encode-zero": "Packed", decode: "Unpacked" },
  yaml: "Converted", csv: "Converted", binary: "Converted", number: "Converted", color: "Converted",
  timestamp: "Converted", "iso-date": "Converted", timezone: "Converted",
  jwt: "Decoded", cert: "Decoded", pem: "Decoded", protobuf: "Decoded", asn1: "Decoded", ebcdic: "Decoded",
  "image-base64": "Decoded",
  hash: "Hashed", uuid: "Generated", password: "Generated", qr: "Generated", gitignore: "Generated",
  "json-schema-generator": "Generated",
  markdown: "Rendered", curl: "Built", "api-request": "Built",
  xml: "Formatted", sql: "Formatted", graphql: "Formatted", "yaml-formatter": "Formatted",
  "code-formatter": "Formatted", nginx: "Formatted", webhook: "Formatted", env: "Formatted",
  query: "Parsed", "url-parser": "Parsed", "iso-bitmap": "Parsed", iso8583: "Parsed", "emv-tlv": "Parsed",
  track2: "Parsed",
  whitespace: "Cleaned", "line-sort": "Sorted", "line-dedupe": "Deduplicated",
  "csv-viewer": "Summarised", "openapi-viewer": "Summarised", "regex-visualizer": "Explained",
  cron: "Explained", mime: "Looked up", status: "Looked up", "jwt-sign": "Signed",
  jsonpath: "Extracted", "json-minifier": "Minified", semver: "Compared"
};

export function successVerb(toolId: string, option: string): string {
  const verb = VERB[toolId];
  if (!verb) return "Completed";
  if (typeof verb === "string") return verb;
  return verb[option] ?? Object.values(verb)[0];
}
