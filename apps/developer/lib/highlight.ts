/**
 * A small JSON tokenizer for the editor's colour layer.
 *
 * Every character of the input comes back in exactly one token, in order, so the coloured
 * layer drawn under the textarea lines up with the text in it character for character.
 * Anything the pattern does not recognise — an unterminated string, a stray word — is kept
 * as plain text rather than dropped, which is what keeps a half-typed document aligned.
 */

export type TokenType = "key" | "string" | "number" | "boolean" | "null" | "punct" | "plain";
export type Token = { type: TokenType; text: string };

/** Past this the colour layer costs more than it is worth on every keystroke. */
export const HIGHLIGHT_LIMIT = 60_000;

const JSON_TOKEN = /("(?:[^"\\\n]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],:])/g;

export function tokenizeJson(source: string): Token[] {
  const tokens: Token[] = [];
  const push = (type: TokenType, text: string) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === type && (type === "plain" || type === "punct")) last.text += text;
    else tokens.push({ type, text });
  };

  let cursor = 0;
  JSON_TOKEN.lastIndex = 0;
  for (let match = JSON_TOKEN.exec(source); match; match = JSON_TOKEN.exec(source)) {
    push("plain", source.slice(cursor, match.index));
    const [, string, colon, number, boolean, nil, punct] = match;
    if (string !== undefined) {
      push(colon ? "key" : "string", string);
      if (colon) push("punct", colon);
    } else if (number !== undefined) push("number", number);
    else if (boolean !== undefined) push("boolean", boolean);
    else if (nil !== undefined) push("null", nil);
    else if (punct !== undefined) push("punct", punct);
    cursor = match.index + match[0].length;
  }
  push("plain", source.slice(cursor));
  return tokens;
}
