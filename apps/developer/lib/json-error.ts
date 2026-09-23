/**
 * Finds where in `input` JSON parsing breaks, so the workbench can jump the input
 * editor to that exact spot. Deliberately not built on the native JSON.parse error
 * message: V8's own wording for that varies by the kind of mistake — some include
 * "at position N (line L column C)", but a common one (an extra comma before a
 * closing bracket) instead reads `Unexpected token ']', "...2,] }" is not valid
 * JSON` with no position anywhere in it. A small hand-written validator, following
 * the JSON grammar itself rather than guessing at engine-specific text, gives an
 * exact offset for every malformed input instead of only some of them.
 */

export type JsonErrorLocation = { line: number; column: number; offset: number };

type FailureReason =
  | "expected-value" | "expected-key" | "expected-colon" | "expected-comma-or-brace"
  | "expected-comma-or-bracket" | "unterminated-string" | "bad-number" | "trailing-content";

class ParseFailure {
  constructor(public offset: number, public reason: FailureReason) {}
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function skipWhitespace(input: string, pos: number): number {
  let i = pos;
  while (i < input.length && /\s/.test(input[i])) i += 1;
  return i;
}

function parseValue(input: string, pos: number): number {
  const start = skipWhitespace(input, pos);
  const char = input[start];
  if (char === "{") return parseObject(input, start);
  if (char === "[") return parseArray(input, start);
  if (char === '"') return parseString(input, start);
  if (char === "-" || isDigit(char)) return parseNumber(input, start);
  if (input.startsWith("true", start)) return start + 4;
  if (input.startsWith("false", start)) return start + 5;
  if (input.startsWith("null", start)) return start + 4;
  throw new ParseFailure(start, "expected-value");
}

function parseObject(input: string, pos: number): number {
  let i = skipWhitespace(input, pos + 1);
  if (input[i] === "}") return i + 1;
  for (;;) {
    i = skipWhitespace(input, i);
    if (input[i] !== '"') throw new ParseFailure(i, "expected-key");
    i = parseString(input, i);
    i = skipWhitespace(input, i);
    if (input[i] !== ":") throw new ParseFailure(i, "expected-colon");
    i = parseValue(input, i + 1);
    i = skipWhitespace(input, i);
    if (input[i] === ",") {
      i += 1;
      continue;
    }
    if (input[i] === "}") return i + 1;
    throw new ParseFailure(i, "expected-comma-or-brace");
  }
}

function parseArray(input: string, pos: number): number {
  let i = skipWhitespace(input, pos + 1);
  if (input[i] === "]") return i + 1;
  for (;;) {
    i = parseValue(input, i);
    i = skipWhitespace(input, i);
    if (input[i] === ",") {
      i += 1;
      continue;
    }
    if (input[i] === "]") return i + 1;
    throw new ParseFailure(i, "expected-comma-or-bracket");
  }
}

function parseString(input: string, pos: number): number {
  let i = pos + 1;
  while (i < input.length) {
    const char = input[i];
    if (char === '"') return i + 1;
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === "\n") throw new ParseFailure(i, "unterminated-string");
    i += 1;
  }
  throw new ParseFailure(i, "unterminated-string");
}

function parseNumber(input: string, pos: number): number {
  let i = pos;
  if (input[i] === "-") i += 1;
  if (input[i] === "0") {
    i += 1;
  } else if (isDigit(input[i])) {
    while (isDigit(input[i])) i += 1;
  } else {
    throw new ParseFailure(i, "bad-number");
  }
  if (input[i] === ".") {
    i += 1;
    if (!isDigit(input[i])) throw new ParseFailure(i, "bad-number");
    while (isDigit(input[i])) i += 1;
  }
  if (input[i] === "e" || input[i] === "E") {
    i += 1;
    if (input[i] === "+" || input[i] === "-") i += 1;
    if (!isDigit(input[i])) throw new ParseFailure(i, "bad-number");
    while (isDigit(input[i])) i += 1;
  }
  return i;
}

function offsetToLocation(input: string, offset: number): JsonErrorLocation {
  const end = Math.min(offset, input.length);
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < end; i += 1) {
    if (input[i] === "\n") {
      line += 1;
      lastNewline = i;
    }
  }
  return { line, column: end - lastNewline, offset: end };
}

function findFailure(input: string): ParseFailure | null {
  try {
    const end = skipWhitespace(input, parseValue(input, 0));
    if (end !== input.length) throw new ParseFailure(end, "trailing-content");
    return null;
  } catch (error) {
    return error instanceof ParseFailure ? error : null;
  }
}

/** Returns where JSON.parse(input) would fail, or null if `input` is actually valid JSON. */
export function locateJsonError(input: string): JsonErrorLocation | null {
  const failure = findFailure(input);
  return failure ? offsetToLocation(input, failure.offset) : null;
}

const startsValue = (char: string | undefined) => char !== undefined && /["{[\-\dtfn]/.test(char);

/**
 * Says in plain words why `input` is not JSON, using what the parser was expecting at the
 * failure point rather than the engine's message — V8's reads like `Unexpected token ']',
 * ..."dev",]... is not valid JSON`, which names the symptom and not the mistake.
 */
export function explainJsonError(input: string): string | null {
  const failure = findFailure(input);
  if (!failure) return null;
  const { offset, reason } = failure;
  const char = input[offset];
  let back = offset - 1;
  while (back >= 0 && /\s/.test(input[back])) back -= 1;
  const previous = back >= 0 ? input[back] : "";
  const atEnd = offset >= input.length;
  const shown = char === "\n" ? "a line break" : `'${char}'`;

  if (!input.trim()) return "The input is empty. Paste a JSON document to check.";
  if (char === "/" && (input[offset + 1] === "/" || input[offset + 1] === "*")) return "JSON does not allow comments. Remove them and run again.";
  if (char === "'") return "JSON strings and property names need double quotes (\"), not single quotes.";

  switch (reason) {
    case "expected-value":
      if (atEnd) return "The document ends where a value was expected. Something is missing at the end.";
      if ((char === "]" || char === "}") && previous === ",") return `Trailing comma before ${shown}. JSON does not allow a comma after the last item.`;
      if (/[A-Za-z_]/.test(char)) {
        const word = /^[A-Za-z_][\w]*/.exec(input.slice(offset))?.[0] ?? char;
        return `${word} is not a JSON value. Text needs double quotes; the only bare words JSON allows are true, false and null.`;
      }
      return `A value was expected here, but the parser found ${shown}.`;
    case "expected-key":
      if (atEnd) return "The object is not finished: the document ends inside it.";
      if (char === "}" && previous === ",") return "Trailing comma before '}'. JSON does not allow a comma after the last property.";
      if (/[A-Za-z_$]/.test(char)) return "Property names must be wrapped in double quotes, like \"name\": \"value\".";
      return `A property name in double quotes was expected here, but the parser found ${shown}.`;
    case "expected-colon":
      return "A colon (:) is missing between the property name and its value.";
    case "expected-comma-or-brace":
      if (atEnd) return "The object is not closed: a '}' is missing at the end.";
      if (startsValue(char)) return "A comma is missing between two properties.";
      return `Expected a comma or '}' after this value, but the parser found ${shown}.`;
    case "expected-comma-or-bracket":
      if (atEnd) return "The array is not closed: a ']' is missing at the end.";
      if (startsValue(char)) return "A comma is missing between two array items.";
      return `Expected a comma or ']' after this item, but the parser found ${shown}.`;
    case "unterminated-string":
      return "A string is not closed: its closing double quote is missing.";
    case "bad-number":
      return "This number is not written the way JSON requires: a digit must follow '.' or 'e', and there is no leading '+'.";
    case "trailing-content":
      return "There is extra text after the end of the JSON document. A document holds exactly one value — wrap several in [ ].";
  }
}
