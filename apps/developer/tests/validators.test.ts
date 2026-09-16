import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateOpenApi, validateSchema } from "../lib/extra-tools";
import { STARTERS } from "../lib/samples";

const parse = (json: string) => JSON.parse(json) as { valid: boolean; errors: Array<Record<string, unknown>>; version?: string };

describe("JSON Schema validation", () => {
  it("accepts a document that satisfies its schema", () => {
    const result = parse(validateSchema('{"name":"Asha"}', '{"type":"object","required":["name"]}'));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports each failure by the path that broke it", () => {
    const result = parse(
      validateSchema(
        '{"name":"Asha","age":"30"}',
        '{"type":"object","properties":{"age":{"type":"integer"}}}',
      ),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => String(error.path).includes("age"))).toBe(true);
  });

  it("reports every failure rather than stopping at the first", () => {
    const result = parse(
      validateSchema(
        '{"age":"30","email":5}',
        '{"type":"object","properties":{"age":{"type":"integer"},"email":{"type":"string"}}}',
      ),
    );
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it("honours the draft the schema declares", () => {
    const draft07 = '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","required":["id"]}';
    expect(parse(validateSchema('{"id":1}', draft07)).valid).toBe(true);
    expect(parse(validateSchema("{}", draft07)).valid).toBe(false);
  });

  it("runs the example this tool ships with", () => {
    const [data, schema] = STARTERS["json-schema"].split(/\r?\n---\r?\n/);
    expect(schema, "the example must include a schema after the --- line").toBeTruthy();
    const result = parse(validateSchema(data, schema));
    // The example deliberately fails one rule, to show what a reported failure looks like.
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("OpenAPI validation", () => {
  it("accepts a minimal 3.0 document", () => {
    const result = parse(validateOpenApi(STARTERS["openapi-validator"]));
    expect(result.version).toBe("3.0");
    expect(result.valid).toBe(true);
  });

  it("rejects a document missing a required field", () => {
    const result = parse(validateOpenApi('{"openapi":"3.0.3","paths":{}}'));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("browser constraints", () => {
  /**
   * Ajv compiles schemas with `new Function`, which the production CSP forbids: with it,
   * both validators worked in development and failed on the deployed site. Keep them on a
   * validator that interprets the schema instead.
   */
  it("keeps the schema validators free of eval-compiling libraries", () => {
    const source = readFileSync(new URL("../lib/extra-tools.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "ajv"/);
    expect(source).not.toMatch(/new Ajv\(/);
    expect(source).not.toMatch(/from "openapi-schema-validator"/);
  });
});
