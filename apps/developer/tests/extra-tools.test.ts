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
    expect(JSON.parse(convertNumber("ff", "16")).decimal).toBe(255);
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
