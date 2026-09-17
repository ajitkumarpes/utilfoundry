import { describe, expect, it } from "vitest";
import {
  buildApiRequest,
  decodeAsn1,
  decodeProtobuf,
  cleanWhitespace,
  compareVersions,
  convertTimezone,
  diffJson,
  diffOpenApi,
  diffText,
  parseUserDate,
  decodePem,
  dedupeLines,
  extractJsonPath,
  explainCron,
  formatEnv,
  formatCode,
  formatGraphql,
  formatNginx,
  formatSql,
  formatXmlDocument,
  convertColor,
  convertNumber,
  explainRegex,
  formatWebhook,
  generateGitignore,
  generateJsonSchema,
  generateQr,
  generatePassword,
  imageToBase64,
  lookupMime,
  sortLines,
  renderMarkdown,
  redactSecrets,
  safeRegexTest,
  summarizeCsv,
  summarizeOpenApi,
  signJwtHmac,
  verifyJwtHmac,
  verifyJwtRsa,
  validateCompose,
  validateOpenApi,
  parseUrl,
  validateJson,
  validateSchema,
  validateXml,
} from "../lib/extra-tools";
import {
  decodeHex,
  decodeBcd,
  decodeEbcdic,
  encodeBcd,
  encodeHex,
  luhn,
  maskPan,
  parseBitmap,
  parseEmvTlv,
  parseIso8583,
  parseTrack2,
} from "../lib/payments-tools";

describe("developer tool processors", () => {
  it("validates JSON and extracts a JSONPath value", () => {
    expect(JSON.parse(validateJson('{"ok":true}')).valid).toBe(true);
    expect(extractJsonPath('{"user":{"name":"Asha"}}', "$.user.name")).toBe(
      '"Asha"',
    );
    expect(extractJsonPath('{"items":[{"id":1},{"id":2}]}', "$..id")).toBe(
      "[\n  1,\n  2\n]",
    );
  });

  it("reports JSON differences", () => {
    const changes = JSON.parse(diffJson('{"a":1}', '{"a":2}'));
    expect(changes[0]).toMatchObject({ path: "$.a", left: 1, right: 2 });
    expect(diffText("a\nb\n", "a\nc\n")).toContain("-b");
  });

  it("validates XML and JSON Schema", () => {
    expect(JSON.parse(validateXml("<root />")).valid).toBe(true);
    expect(
      JSON.parse(
        validateSchema('{"age":4}', '{"type":"object","required":["age"]}'),
      ).valid,
    ).toBe(true);
    expect(formatXmlDocument('<root a="1"><item>ok</item></root>')).toContain(
      "\n  <item>ok</item>",
    );
  });

  it("normalizes text and environment variables", () => {
    expect(cleanWhitespace("a   b\n\n\nc  ")).toBe("a b\n\nc");
    expect(formatEnv("Z=2\nA=1\n# comment")).toBe("A=1\nZ=2");
    expect(sortLines("z\na\nB")).toBe("a\nB\nz");
    expect(dedupeLines("a\na\nb")).toBe("a\nb");
  });

  it("parses web and infrastructure formats", () => {
    expect(JSON.parse(parseUrl("https://example.com/a?x=1")).query.x).toBe("1");
    expect(formatNginx("server { listen 80; }")).toContain("server {");
    expect(
      JSON.parse(validateCompose("services:\n  api:\n    image: node:22"))
        .valid,
    ).toBe(true);
  });

  it("compares semantic versions", () => {
    expect(JSON.parse(compareVersions("1.2.0 1.1.9")).relation).toBe(
      "left is newer",
    );
    expect(() => compareVersions("1.2.0 1.1.9 1.0.0")).toThrow();
  });

  it("exercises every remaining non-network processor", async () => {
    expect(convertTimezone("2026-09-05T14:30:00Z", "UTC")).toContain("2026");
    expect(lookupMime(".json")).toContain("application/json");
    expect(
      JSON.parse(
        summarizeOpenApi(
          '{"openapi":"3.0.3","info":{"title":"Demo","version":"1"},"paths":{"/users":{"get":{}}}}',
        ),
      ).endpointCount,
    ).toBe(1);
    expect(JSON.parse(explainCron("*/15 * * * *")).nextRuns).toHaveLength(5);
    expect(generateGitignore("Node")).toContain("node_modules/");
    expect(() => generateGitignore("   ")).toThrow();
    expect(formatNginx("server { listen 80; }")).toContain("listen 80");
    expect(
      JSON.parse(
        decodePem("-----BEGIN TEST-----\nSGVsbG8=\n-----END TEST-----"),
      ).bytes,
    ).toBe(5);
    expect(formatWebhook('{"event":"ok"}')).toContain('"event"');
    expect(
      buildApiRequest(
        `{"url":"https://example.com","method":"GET","headers":{"x-test":"O'Reilly"}}`,
      ),
    ).toContain("curl");
    expect(() => buildApiRequest('{"url":"/relative"}')).toThrow();
    expect(() =>
      buildApiRequest('{"url":"https://example.com","headers":{"x":"a\\nb"}}'),
    ).toThrow();
    expect(imageToBase64("data:image/png;base64,AAAA")).toContain("dataUrl");
    expect(() => imageToBase64("not!base64")).toThrow();
    expect(
      (await generateQr("hello")).startsWith("data:image/png;base64,"),
    ).toBe(true);
    await expect(generateQr("   ")).rejects.toThrow();
  });

  it("uses the real browser-capable formatter", async () => {
    const formatted = await formatCode("const x={a:1}", "javascript");
    expect(formatted).toContain("const x = { a: 1 };");
  });

  it("formats SQL and GraphQL with standards-aware parsers", () => {
    expect(formatSql("select id,email from users where active=true")).toContain(
      "SELECT",
    );
    expect(formatGraphql("query User { user { id email } }")).toContain(
      "query User",
    );
    expect(
      JSON.parse(summarizeCsv('name,note\nAsha,"hello, world"')).preview[1][1],
    ).toBe("hello, world");
  });

  it("uses real Markdown, regex, number, and color processors", () => {
    expect(renderMarkdown("# Safe\n\n<script>alert(1)</script>")).toContain(
      "<h1>Safe</h1>",
    );
    expect(renderMarkdown("# Safe\n\n<script>alert(1)</script>")).not.toContain(
      "<script>",
    );
    expect(
      explainRegex("^(?<user>[a-z]+)$").some(
        (node) => node.type === "CapturingGroup",
      ),
    ).toBe(true);
    expect(JSON.parse(convertNumber("ff", "16")).decimal).toBe("255");
    expect(() => convertNumber("12z", "10")).toThrow();
    expect(JSON.parse(convertColor("rgb(66, 99, 235)")).hex).toBe("#4263EB");
    expect(JSON.parse(convertColor("#4263EB80"))).toMatchObject({
      hex8: "#4263EB80",
      alpha: expect.closeTo(0.502, 3),
    });
    expect(JSON.parse(convertColor("hsl(231, 81%, 59%)")).rgb).toMatch(
      /^rgb\(/,
    );
  });

  it("validates OpenAPI with the official schema family", async () => {
    const result = JSON.parse(
      await validateOpenApi(
        '{"openapi":"3.0.3","info":{"title":"Demo","version":"1.0.0"},"paths":{}}',
      ),
    );
    expect(result.valid).toBe(true);
    expect(result.version).toBe("3.0");
  });

  it("signs and verifies UTF-8 JWT payloads locally", async () => {
    const token = await signJwtHmac(
      JSON.stringify({ name: "नमस्ते" }),
      "test-secret",
    );
    expect(JSON.parse(await verifyJwtHmac(token, "test-secret"))).toMatchObject(
      { valid: true, payload: { name: "नमस्ते" } },
    );
    await expect(signJwtHmac("[]", "test-secret")).rejects.toThrow();
    await expect(signJwtHmac("{}", "")).rejects.toThrow();
  });

  it("covers enterprise API, security, and wire-format utilities", async () => {
    const oldSpec = '{"openapi":"3.0.3","info":{"title":"A","version":"1"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"},"404":{"description":"missing"}}}}}}';
    const newSpec = '{"openapi":"3.0.3","info":{"title":"A","version":"2"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"}}}}}}';
    expect(JSON.parse(diffOpenApi(oldSpec, newSpec)).breaking).toBe(true);
    expect(JSON.parse(generateJsonSchema('{"name":"Asha","age":3}')).required).toEqual(["name", "age"]);
    expect(JSON.parse(redactSecrets("authorization: Bearer abc api_key=secret")).redacted).toContain("[REDACTED]");
    expect(JSON.parse(decodeProtobuf("08 96 01 12 05 48 65 6C 6C 6F")).fields).toHaveLength(2);
    expect(JSON.parse(decodeAsn1("30 0A 02 01 05 04 05 48 65 6C 6C 6F")).nodes[0].constructed).toBe(true);
    expect(JSON.parse(safeRegexTest("a+", "aaaa", "g")).count).toBe(1);
    expect(() => safeRegexTest("(a+)+", "aaaa", "g")).toThrow();
    await expect(verifyJwtRsa("bad", "{}")).rejects.toThrow();
  });

  it("generates bounded passwords with a cryptographic source", () => {
    const password = generatePassword("32");
    expect(password).toHaveLength(32);
    expect(generatePassword("2")).toHaveLength(8);
  });

  it("covers payment protocol primitives without network calls", () => {
    expect(JSON.parse(encodeHex("ABC")).hexSpaced).toBe("41 42 43");
    expect(JSON.parse(decodeHex("41 42 43")).text).toBe("ABC");
    expect(() => decodeHex("GG")).toThrow();
    expect(decodeEbcdic("C1 C2 C3 40 F1 F2 F3")).toBe("ABC 123");
    expect(decodeBcd("12 34 5F")).toBe("12345");
    expect(JSON.parse(luhn("4111111111111111"))).toMatchObject({
      valid: true,
      checkDigit: 1,
    });
    expect(maskPan("411111******1111")).toBe("411111••••••1111");
    expect(
      JSON.parse(parseTrack2("411111******1111=25122010000012345678")).pan,
    ).toBe("411111••••••1111");
    expect(() => parseTrack2("411111******1111=2512")).toThrow();
    expect(
      JSON.parse(parseBitmap("7220000000000000")).enabledDataElements,
    ).toContain(2);
    expect(() => parseBitmap("F220000000000000")).toThrow();
    const iso = JSON.parse(
      parseIso8583(
        "020072200000000000001641111111111111110000000000000010000905123456123456",
      ),
    );
    expect(iso.mti).toBe("0200");
    expect(iso.fields[2].value).toBe("411111••••••1111");
    const encodedIso = JSON.parse(
      parseIso8583(
        "30323030722000000000000000001641111111111111110000000000000010000905123456123456",
      ),
    );
    expect(encodedIso.mti).toBe("0200");
    expect(JSON.parse(parseEmvTlv("9F270180"))[0]).toMatchObject({
      tag: "9F27",
      length: 1,
      value: "80",
    });
    expect(
      JSON.parse(parseEmvTlv("70079F2701809F1000"))[0].children,
    ).toHaveLength(2);
  });
});

describe("dates a calendar does not have", () => {
  it("refuses 29 February in a common year instead of rolling into March", () => {
    expect(() => parseUserDate("2026-02-29")).toThrow(/February 2026 has 28 days/);
    expect(() => parseUserDate("2025-02-29")).toThrow(/February 2025 has 28 days/);
  });

  it("accepts 29 February in a leap year", () => {
    expect(parseUserDate("2024-02-29").toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("refuses a 31st in a thirty-day month", () => {
    expect(() => parseUserDate("2026-04-31")).toThrow(/April 2026 has 30 days/);
    expect(() => parseUserDate("2026-06-31")).toThrow(/June 2026 has 30 days/);
  });

  it("refuses an impossible month", () => {
    expect(() => parseUserDate("2026-13-01")).toThrow(/no month 13/);
    expect(() => parseUserDate("2026-00-10")).toThrow(/no month 00/);
  });

  it("does not mistake a written UTC offset for a rollover", () => {
    // 1 March in +05:30 is still 28 February in UTC; the written date is real, so it stands.
    expect(parseUserDate("2026-03-01T02:00:00+05:30").toISOString()).toBe("2026-02-28T20:30:00.000Z");
  });

  it("leaves the rest of the parser alone", () => {
    expect(parseUserDate("2026-09-17T10:30:00Z").toISOString()).toBe("2026-09-17T10:30:00.000Z");
    expect(() => parseUserDate("not a date")).toThrow();
  });
});

describe("integers wider than a double", () => {
  it("converts a full 64-bit word instead of refusing it", () => {
    // The everyday case this used to reject: 2^64 - 1 is past 2^53, so the old Number-based
    // parser answered "outside the safe integer range" for a plain 16-digit hex word.
    expect(JSON.parse(convertNumber("FFFFFFFFFFFFFFFF", "16"))).toEqual({
      decimal: "18446744073709551615",
      binary: "1".repeat(64),
      octal: "1777777777777777777777",
      hexadecimal: "FFFFFFFFFFFFFFFF",
    });
  });

  it("keeps every digit of a value a double would round", () => {
    const beyondDouble = "9007199254740993"; // 2^53 + 1, the first integer a double cannot hold.
    expect(JSON.parse(convertNumber(beyondDouble, "10")).decimal).toBe(beyondDouble);
  });

  it("reads 0x only where it means something", () => {
    // Stripping the prefix from every base made "0x10" read as decimal 10 under the decimal
    // setting: a wrong answer, delivered without a warning.
    expect(JSON.parse(convertNumber("0x10", "16")).decimal).toBe("16");
    expect(() => convertNumber("0x10", "10")).toThrow(/valid base-10/);
  });

  it("refuses a value long enough to lock the tab", () => {
    expect(() => convertNumber("1".repeat(4097), "10")).toThrow(/at most 4096 digits/);
    expect(() => convertNumber("1".repeat(4096), "10")).not.toThrow();
  });

  it("still rejects what is not a number in that base", () => {
    expect(() => convertNumber("2", "2")).toThrow(/valid base-2/);
    expect(() => convertNumber("8", "8")).toThrow(/valid base-8/);
    expect(() => convertNumber("", "10")).toThrow(/valid base-10/);
  });
});

describe("BCD packing follows the payments convention", () => {
  it("fills an odd digit count on the right, the way ISO 8583 does", () => {
    expect(encodeBcd("12345")).toBe("12 34 5F");
    expect(encodeBcd("4111111111111111111")).toBe("41 11 11 11 11 11 11 11 11 1F");
  });

  it("round-trips an odd-length value exactly", () => {
    expect(decodeBcd(encodeBcd("12345"))).toBe("12345");
    expect(decodeBcd(encodeBcd("1234567890"))).toBe("1234567890");
  });

  it("still offers the leading-zero convention for fixed-length fields", () => {
    expect(encodeBcd("12345", "zero")).toBe("01 23 45");
  });

  it("leaves an even digit count untouched by either convention", () => {
    expect(encodeBcd("1234")).toBe("12 34");
    expect(encodeBcd("1234", "zero")).toBe("12 34");
  });

  it("reports a leading zero rather than swallowing it", () => {
    // A YYMMDD of 012345 is six digits. Stripping the first one returned a five-digit date.
    expect(decodeBcd("01 23 45")).toBe("012345");
    expect(decodeBcd("00 12")).toBe("0012");
  });

  it("keeps rejecting filler in the wrong place and stray input", () => {
    expect(() => decodeBcd("F1 23")).toThrow();
    expect(() => decodeBcd("12 3")).toThrow();
    expect(() => encodeBcd("12A4")).toThrow(/digits only/);
  });
});

/**
 * A real self-signed certificate whose notBefore is a UTCTime and whose notAfter is past 2050,
 * which forces a GeneralizedTime — so one fixture exercises both of the DER time forms.
 */
const CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUbBbQcHlXoNCIYAUUkXx0a470HKMwDQYJKoZIhvcNAQEL
BQAwRDEfMB0GA1UEAwwWVXRpbEZvdW5kcnkgRmFyIEZ1dHVyZTEUMBIGA1UECgwL
VXRpbEZvdW5kcnkxCzAJBgNVBAYTAklOMCAXDTI2MDkxNjIzMTUyNloYDzIwNTkw
NzI1MjMxNTI2WjBEMR8wHQYDVQQDDBZVdGlsRm91bmRyeSBGYXIgRnV0dXJlMRQw
EgYDVQQKDAtVdGlsRm91bmRyeTELMAkGA1UEBhMCSU4wggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQCPojiQnhNhgZk96x/7l9hOvcvw8m0T78OY/yU2K8iA
D+yOGqGgbToxT4oIb44dm0qfceVptZxj4uzax5OH93ZKoIfvre8A/W17nV0ur/U/
HIIfHJw+9ckGI/gb1xO6YH/UpPJP6B4EI5ABwT52uC6mjbz9LD/fRO5KyPQkp5mG
zLu8lXfgQcYgYd9ql+F5XHTYodV4c67/RYb8b4iahbyseiY2oP+zaOw2J0EjVoKx
iHTjIgeLwY4XtJL+sS3cLSPkV1VtSHiVYFXgm3IwoLhQkKhReFeu71soTM3XBUPZ
dg/33tk2YyNjMLOj2ecQQSfBBFcKlsCe1pIhRgRAUj2jAgMBAAGjUzBRMB0GA1Ud
DgQWBBTzs0Q+taHEQTa21Apb+Sd27TiPcDAfBgNVHSMEGDAWgBTzs0Q+taHEQTa2
1Apb+Sd27TiPcDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAg
5o/aZSKmV/DaPY1sdjXbiPxyaOIaSelx66620v7jFaa6+XS8wR3YzEB0sTD3re4h
NR1pkwOUWEAakm0mPq84LcE2xSA4brFaCI4f/T3SqXlJRq4AYfhOWVdDFB7oizrd
w5PXxa6jJKgg2vqqaUS02zPGORZn/aL171i5kyYmoQ0ucUSLCnA+do5//oX1XHG4
rzQWGO/cD763ONltxg5yMUtmyToyVb3Kr0T5/hOU5+e2A/ogGT6jZsb6VlLboavA
LWSUqhnun2ITesJhhEbPE7BctCxWCJ2bO7diAZv3HP3V4fhxc0+UnuX5KW0/3b0/
qPm1sszkbiimmqQz0s12
-----END CERTIFICATE-----`;

/** Rewrites one DER time in place. Same length in, same length out, so every DER length stands. */
function withValidity(from: string, to: string) {
  if (from.length !== to.length) throw new Error("the replacement must not change any DER length");
  const body = CERTIFICATE_PEM.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const bytes = Buffer.from(body, "base64").toString("binary");
  const patched = bytes.replace(from, to);
  if (patched === bytes) throw new Error(`the fixture does not contain ${from}`);
  const base64 = Buffer.from(patched, "binary").toString("base64");
  return `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----`;
}

describe("certificate validity times", () => {
  it("reads both DER time forms from a real certificate", () => {
    const parsed = JSON.parse(decodePem(CERTIFICATE_PEM));
    expect(parsed.certificate).toMatchObject({
      // UTCTime: RFC 5280 reads a two-digit year under 50 as 20xx.
      notBefore: "2026-09-16T23:15:26.000Z",
      // GeneralizedTime, because the year is past 2049.
      notAfter: "2059-07-25T23:15:26.000Z",
    });
    expect(parsed.certificate.subject).toContain("CN=UtilFoundry Far Future");
  });

  it("names the field when a certificate carries a date that does not exist", () => {
    // Month 13. This used to reach `new Date(...).toISOString()` and raise a bare
    // "Invalid time value" with nothing to say which of the two dates was wrong.
    const month = JSON.parse(decodePem(withValidity("260916231526Z", "261316231526Z")));
    expect(month.certificateError).toMatch(/month 13, which does not exist/);
    expect(month.certificate).toBeUndefined();

    const day = JSON.parse(decodePem(withValidity("260916231526Z", "260931231526Z")));
    expect(day.certificateError).toMatch(/September 31, 2026, and that month has 30 days/);
  });

  it("names the field when the time of day is not a real one", () => {
    const parsed = JSON.parse(decodePem(withValidity("260916231526Z", "260916256026Z")));
    expect(parsed.certificateError).toMatch(/25:60:26, which is not a real time of day/);
  });

  it("refuses a validity that is not a UTC time at all", () => {
    const parsed = JSON.parse(decodePem(withValidity("260916231526Z", "2609162315+00")));
    expect(parsed.certificateError).toMatch(/not a UTCTime in UTC/);
  });

  it("says why a certificate could not be read rather than quietly leaving it out", () => {
    // A block that is valid Base64 and a complete PEM, but not a certificate: the envelope
    // facts still stand, and the reason the metadata is missing is now part of the answer.
    const parsed = JSON.parse(decodePem("-----BEGIN CERTIFICATE-----\nSGVsbG8=\n-----END CERTIFICATE-----"));
    expect(parsed).toMatchObject({ type: "CERTIFICATE", bytes: 5, completeBlock: true });
    expect(parsed.certificate).toBeUndefined();
    expect(typeof parsed.certificateError).toBe("string");
    expect(parsed.certificateError.length).toBeGreaterThan(0);
  });
});
