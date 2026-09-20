import { describe, expect, it } from "vitest";
import { locateJsonError } from "../lib/json-error";

/** Cross-checks every case against the real parser: whenever JSON.parse accepts an
 *  input, locateJsonError must say null; whenever it throws, locateJsonError must
 *  find *some* location, since that's the only thing it's for. */
function expectAgreesWithNativeParser(input: string) {
  let nativeAccepts = true;
  try {
    JSON.parse(input);
  } catch {
    nativeAccepts = false;
  }
  const located = locateJsonError(input);
  if (nativeAccepts) expect(located).toBeNull();
  else expect(located).not.toBeNull();
}

describe("locateJsonError", () => {
  it("returns null for valid JSON of every kind", () => {
    for (const input of [
      "{}", "[]", "true", "false", "null", "0", "-12.5", "1e10", '"a string"',
      '{"a":1,"b":[1,2,3],"c":{"d":null,"e":true}}',
      '{\n  "a": 1,\n  "b": 2\n}'
    ]) {
      expect(locateJsonError(input)).toBeNull();
    }
  });

  it("locates a trailing comma before a closing bracket — the case the native message drops position for", () => {
    // The native V8 message for this one is "Unexpected token ']', ... is not valid JSON",
    // with no position anywhere in it, which is the whole reason this exists.
    const location = locateJsonError('{\n  "a": 1,\n  "b": [1, 2,]\n}');
    expect(location).toEqual({ line: 3, column: 14, offset: 25 });
  });

  it("locates a missing colon", () => {
    const location = locateJsonError('{"a" 1}');
    expect(location).toEqual({ line: 1, column: 6, offset: 5 });
  });

  it("locates an unterminated string", () => {
    const location = locateJsonError('{"a": "unterminated}');
    expect(location?.offset).toBe(20);
  });

  it("locates trailing content after an otherwise-valid document", () => {
    const location = locateJsonError("{} extra");
    expect(location).toEqual({ line: 1, column: 4, offset: 3 });
  });

  it("locates an empty document", () => {
    expect(locateJsonError("")).toEqual({ line: 1, column: 1, offset: 0 });
  });

  it("reports the line a multi-line error is actually on", () => {
    const location = locateJsonError('{\n  "a": 1,\n  "b": ,\n  "c": 3\n}');
    expect(location?.line).toBe(3);
  });

  it("agrees with the native parser across a spread of valid and broken inputs", () => {
    const cases = [
      "{}", "[1,2,3]", '{"a":1}', "{,}", "[1,2,]", '{"a" "b"}', "{'a':1}", "undefined",
      '{"a":1,}', "[", "{", '"unterminated', "01", "1.", ".1", "1e", "--1"
    ];
    for (const input of cases) expectAgreesWithNativeParser(input);
  });
});
