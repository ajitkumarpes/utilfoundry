/**
 * Turns a run's output into what the result banner and the Result tab say about it.
 *
 * Several tools finish without throwing yet report a negative answer inside their output —
 * a validator's `"valid": false`, a Luhn check that fails, an unknown status code. Those are
 * answers, not tool failures, so they get their own "warning" tone rather than the green
 * success a plain run earns: showing "Completed" in green over an invalid document is the
 * kind of confident wrong answer this app sets out to avoid.
 */

import { successVerb } from "./tool-options";

export type ResultTone = "ready" | "warning";
export type ResultSummary = { tone: ResultTone; title: string; note: string };
export type JsonShape = { objects: number; arrays: number; arrayItems: number };

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function lineCount(value: string): number {
  if (!value) return 0;
  let lines = 1;
  for (let index = 0; index < value.length; index += 1) if (value.charCodeAt(index) === 10) lines += 1;
  return lines;
}

function parseJson(value: string): unknown {
  const start = value.trimStart()[0];
  if (start !== "{" && start !== "[") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** Counts nested objects and arrays when the output is a JSON document, whichever tool made it. */
export function jsonShape(output: string): JsonShape | null {
  const parsed = parseJson(output);
  if (parsed === undefined || parsed === null || typeof parsed !== "object") return null;
  const shape: JsonShape = { objects: 0, arrays: 0, arrayItems: 0 };
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      shape.arrays += 1;
      shape.arrayItems += node.length;
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      shape.objects += 1;
      Object.values(node).forEach(walk);
    }
  };
  walk(parsed);
  return shape;
}

const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : /(?:ch|sh|s|x)$/.test(word) ? `${word}es` : `${word}s`}`;

function record(output: string): Record<string, unknown> | null {
  const parsed = parseJson(output);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

function errorCount(result: Record<string, unknown>) {
  return Array.isArray(result.errors) ? result.errors.length : 0;
}

/** Tools whose output carries a `valid` verdict, and how to phrase each side of it. */
function validity(toolId: string, option: string, result: Record<string, unknown>): ResultSummary | null {
  if (typeof result.valid !== "boolean") return null;
  const valid = result.valid;
  switch (toolId) {
    case "xml-validator": {
      if (valid) return { tone: "ready", title: "Valid XML", note: "The document is well-formed." };
      const error = (result.error ?? {}) as { msg?: string; line?: number; col?: number };
      const where = error.line ? ` (line ${error.line}, column ${error.col ?? 1})` : "";
      return { tone: "warning", title: "Invalid XML", note: `${error.msg ?? "The document is not well-formed."}${where}` };
    }
    case "openapi-validator":
      return valid
        ? { tone: "ready", title: "Valid OpenAPI document", note: `Matches the OpenAPI ${String(result.version ?? "")} schema.` }
        : { tone: "warning", title: "OpenAPI document has problems", note: `${plural(errorCount(result), "problem")} found — each is listed in the output.` };
    case "json-schema":
      return valid
        ? { tone: "ready", title: "Data matches the schema", note: "Every rule in the schema passed." }
        : { tone: "warning", title: "Data does not match the schema", note: `${plural(errorCount(result), "failure")} — each is listed with the path that broke it.` };
    case "docker-compose": {
      const services = Array.isArray(result.services) ? result.services.length : 0;
      if (valid) return { tone: "ready", title: "Compose file looks good", note: `${plural(services, "service")} found.` };
      const first = Array.isArray(result.errors) ? String(result.errors[0] ?? "") : "";
      return { tone: "warning", title: "Compose file has problems", note: first || "See the output for details." };
    }
    case "luhn":
      return valid
        ? { tone: "ready", title: "Passes the Luhn check", note: "The check digit is correct." }
        : { tone: "warning", title: "Fails the Luhn check", note: `For this number the check digit should be ${String(result.checkDigit)}.` };
    case "jwt-sign":
      if (option !== "verify") return null;
      return valid
        ? { tone: "ready", title: "Signature is valid", note: "The token was signed with this secret." }
        : { tone: "warning", title: "Signature does not match", note: "The token was signed with a different secret, or changed after signing." };
    case "jwt-rsa":
      return valid
        ? { tone: "ready", title: "Signature is valid", note: "The token verifies against this public key." }
        : { tone: "warning", title: "Signature does not match", note: "The token was not signed by this key, or changed after signing." };
    default:
      return null;
  }
}

export function summarizeResult(toolId: string, option: string, output: string, elapsedMs: number): ResultSummary {
  const finished = `Finished in ${Math.max(1, Math.round(elapsedMs))} ms.`;
  const result = record(output);

  if (result) {
    const verdict = validity(toolId, option, result);
    if (verdict) return verdict;
  }

  switch (toolId) {
    case "json":
      if (option === "minify") return { tone: "ready", title: "Valid JSON", note: "Minified — every insignificant space removed." };
      if (option === "validate") return { tone: "ready", title: "Valid JSON", note: `The document parses as ${describeType(result)}.` };
      return { tone: "ready", title: "Valid JSON", note: "Great! Your JSON is valid and properly formatted." };
    case "json-validator":
      return { tone: "ready", title: "Valid JSON", note: `The document parses as ${describeType(result)}.` };
    case "json-minifier":
      return { tone: "ready", title: "Valid JSON", note: "Minified — every insignificant space removed." };
    case "regex":
    case "regex-safe": {
      const count = Number(result?.count ?? 0);
      return count
        ? { tone: "ready", title: `${plural(count, "match")} found`, note: finished }
        : { tone: "warning", title: "No matches", note: "The pattern ran but matched nothing. Check the pattern and flags." };
    }
    case "json-diff": {
      const changes = parseJson(output);
      const count = Array.isArray(changes) ? changes.length : 0;
      return count
        ? { tone: "ready", title: `${plural(count, "difference")} found`, note: "Each changed path is listed with its old and new value." }
        : { tone: "ready", title: "No differences", note: "The two documents hold the same data." };
    }
    case "diff": {
      const lines = output.split("\n");
      const added = lines.filter((line) => line.startsWith("+")).length;
      const removed = lines.filter((line) => line.startsWith("-")).length;
      return added || removed
        ? { tone: "ready", title: `${plural(added, "line")} added, ${removed} removed`, note: "Added lines start with +, removed lines with -." }
        : { tone: "ready", title: "No differences", note: "The two snippets are identical." };
    }
    case "openapi-diff": {
      const count = Array.isArray(result?.breakingChanges) ? result.breakingChanges.length : 0;
      return count
        ? { tone: "warning", title: `${plural(count, "breaking change")} found`, note: "Removed operations, parameters or responses may break existing clients." }
        : { tone: "ready", title: "No breaking changes", note: "Nothing a client relies on was removed." };
    }
    case "status":
      return output.startsWith("Unknown status code")
        ? { tone: "warning", title: "Unknown status code", note: "Try a standard three-digit HTTP code such as 404." }
        : { tone: "ready", title: "Status code found", note: output };
    case "mime":
      return output.startsWith("MIME type not found")
        ? { tone: "warning", title: "No match", note: "Try an extension such as json, html, png or pdf, or a type such as image/png." }
        : { tone: "ready", title: "Found", note: output.split("\n")[0] };
    case "log-redactor": {
      const findings = Array.isArray(result?.findings) ? (result.findings as string[]) : [];
      return findings.length
        ? { tone: "ready", title: `Redacted ${plural(findings.length, "kind")} of secret`, note: `Masked: ${findings.join(", ")}.` }
        : { tone: "warning", title: "Nothing redacted", note: "No tokens, keys, emails or card-like numbers matched. Check the log by eye before sharing it." };
    }
    case "semver":
      return { tone: "ready", title: "Compared", note: `${String(result?.left)} vs ${String(result?.right)}: ${String(result?.relation)}.` };
    case "env": {
      const duplicates = output.split("\n").find((line) => line.startsWith("# Duplicate keys"));
      return duplicates
        ? { tone: "warning", title: "Formatted, with duplicate keys", note: duplicates.replace(/^#\s*/, "") }
        : { tone: "ready", title: "Formatted successfully", note: finished };
    }
    default:
      return { tone: "ready", title: `${successVerb(toolId, option)} successfully`, note: finished };
  }
}

function describeType(result: Record<string, unknown> | null) {
  const type = String(result?.type ?? "a value");
  if (type === "a value") return type;
  return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
}
