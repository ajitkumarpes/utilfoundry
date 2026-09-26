/**
 * The tools that compare or check one document against another. Their handlers in
 * lib/run-tool.ts still take a single string with the two halves separated by a `---` line,
 * but the page gives each half its own editor, so nobody has to know about the separator.
 * The workbench keeps the joined string as its one input value, which keeps saved
 * workspaces, the example and the sensitive-data check working unchanged.
 */

export type SplitInput = {
  first: string;
  second: string;
  /** Shown in each editor's empty state. */
  firstPlaceholder: string;
  secondPlaceholder: string;
};

const SPLIT: Record<string, SplitInput> = {
  diff: {
    first: "Original",
    second: "Changed",
    firstPlaceholder: "Paste the original text here.",
    secondPlaceholder: "Paste the changed text here."
  },
  "json-diff": {
    first: "Original JSON",
    second: "Changed JSON",
    firstPlaceholder: "Paste the original JSON document.",
    secondPlaceholder: "Paste the changed JSON document."
  },
  "json-schema": {
    first: "JSON data",
    second: "JSON Schema",
    firstPlaceholder: "Paste the JSON document to check.",
    secondPlaceholder: 'Paste the JSON Schema it must satisfy, e.g. {"type":"object","required":["name"]}.'
  },
  "openapi-diff": {
    first: "Old document",
    second: "New document",
    firstPlaceholder: "Paste the old OpenAPI document (JSON or YAML).",
    secondPlaceholder: "Paste the new OpenAPI document (JSON or YAML)."
  },
  "jwt-rsa": {
    first: "Token",
    second: "JWK public key",
    firstPlaceholder: "Paste the RS256 token.",
    secondPlaceholder: "Paste the JWK public key as JSON."
  }
};

export function splitInputFor(toolId: string): SplitInput | null {
  return SPLIT[toolId] ?? null;
}

const SEPARATOR = /\r?\n---\r?\n/;

/** Splits on the first separator, as the tool handlers do, so both views agree. */
export function splitDocuments(value: string): [string, string] {
  const match = SEPARATOR.exec(value);
  if (!match) return [value, ""];
  return [value.slice(0, match.index), value.slice(match.index + match[0].length)];
}

/** Two empty editors are an empty input, not a lone separator. */
export function joinDocuments(first: string, second: string): string {
  if (!first && !second) return "";
  return `${first}\n---\n${second}`;
}
