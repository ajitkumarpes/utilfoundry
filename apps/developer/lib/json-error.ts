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

class ParseFailure {
  constructor(public offset: number) {}
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
  throw new ParseFailure(start);
}

function parseObject(input: string, pos: number): number {
  let i = skipWhitespace(input, pos + 1);
  if (input[i] === "}") return i + 1;
  for (;;) {
    i = skipWhitespace(input, i);
    if (input[i] !== '"') throw new ParseFailure(i);
    i = parseString(input, i);
    i = skipWhitespace(input, i);
    if (input[i] !== ":") throw new ParseFailure(i);
    i = parseValue(input, i + 1);
    i = skipWhitespace(input, i);
    if (input[i] === ",") {
      i += 1;
      continue;
    }
    if (input[i] === "}") return i + 1;
    throw new ParseFailure(i);
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
    throw new ParseFailure(i);
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
    if (char === "\n") throw new ParseFailure(i);
    i += 1;
  }
  throw new ParseFailure(i);
}

function parseNumber(input: string, pos: number): number {
  let i = pos;
  if (input[i] === "-") i += 1;
  if (input[i] === "0") {
    i += 1;
  } else if (isDigit(input[i])) {
    while (isDigit(input[i])) i += 1;
  } else {
    throw new ParseFailure(i);
  }
  if (input[i] === ".") {
    i += 1;
    if (!isDigit(input[i])) throw new ParseFailure(i);
    while (isDigit(input[i])) i += 1;
  }
  if (input[i] === "e" || input[i] === "E") {
    i += 1;
    if (input[i] === "+" || input[i] === "-") i += 1;
    if (!isDigit(input[i])) throw new ParseFailure(i);
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

/** Returns where JSON.parse(input) would fail, or null if `input` is actually valid JSON. */
export function locateJsonError(input: string): JsonErrorLocation | null {
  try {
    const end = skipWhitespace(input, parseValue(input, 0));
    if (end !== input.length) throw new ParseFailure(end);
    return null;
  } catch (error) {
    return error instanceof ParseFailure ? offsetToLocation(input, error.offset) : null;
  }
}
