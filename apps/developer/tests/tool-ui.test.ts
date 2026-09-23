import { describe, expect, it } from "vitest";
import { tokenizeJson } from "../lib/highlight";
import { jsonShape, summarizeResult } from "../lib/result-summary";
import { defaultOption, STARTERS } from "../lib/samples";
import { GUIDES } from "../lib/tool-guide";
import {
  inputSubtitle, optionsFor, outputIsData, outputLanguage, outputNoun, reverseChoice, successVerb
} from "../lib/tool-options";
import { TOOLS, getToolById } from "../lib/tools";

describe("every tool has the words the page shows for it", () => {
  it("has an Info guide with four features, use cases and valid next steps", () => {
    for (const tool of TOOLS) {
      const guide = GUIDES[tool.id];
      expect(guide, `${tool.id} has no guide`).toBeDefined();
      expect(guide.why.length, `${tool.id} needs a why`).toBeGreaterThan(30);
      expect(guide.features).toHaveLength(4);
      expect(new Set(guide.features).size, `${tool.id} repeats a feature`).toBe(4);
      expect(guide.uses.length, `${tool.id} needs use cases`).toBeGreaterThanOrEqual(4);
      expect(guide.next.length, `${tool.id} needs next steps`).toBeGreaterThanOrEqual(2);
      for (const [id] of guide.next) {
        expect(getToolById(id), `${tool.id} points at unknown tool ${id}`).toBeDefined();
        expect(id, `${tool.id} lists itself as a next step`).not.toBe(tool.id);
      }
    }
  });

  it("has no guide for a tool that is not in the catalog", () => {
    for (const id of Object.keys(GUIDES)) expect(getToolById(id), id).toBeDefined();
  });

  it("does not repeat the header's claims in the Info panel", () => {
    // The chips above already say free, no account, in the browser, nothing uploaded.
    for (const guide of Object.values(GUIDES)) {
      for (const feature of guide.features) {
        expect(feature).not.toMatch(/100% free|no account|runs in your browser|nothing is uploaded|no data is uploaded/i);
      }
    }
  });

  it("names what each output pane holds", () => {
    for (const tool of TOOLS) {
      expect(outputNoun(tool.id, defaultOption(tool.id)), tool.id).not.toBe("Result");
      expect(successVerb(tool.id, defaultOption(tool.id)).length).toBeGreaterThan(0);
    }
  });

  it("writes the input subtitle mid-sentence", () => {
    expect(inputSubtitle("JSON")).toBe("Paste or edit your JSON, then click “Run tool”.");
    expect(inputSubtitle("Date or timestamp")).toContain("your date or timestamp,");
    expect(inputSubtitle("OpenAPI JSON")).toContain("your OpenAPI JSON,");
  });
});

describe("options bar", () => {
  it("starts every choice control on one of its own choices", () => {
    for (const tool of TOOLS) {
      const options = optionsFor(tool.id);
      if (!options) continue;
      for (const control of options.controls) {
        if (control.kind === "radio" || control.kind === "select") {
          const values = control.choices.map((choice) => choice.value);
          expect(values, `${tool.id} starts outside its choices`).toContain(defaultOption(tool.id));
        }
      }
    }
  });

  it("offers a reverse only for tools that convert both ways", () => {
    expect(reverseChoice("base64", "encode")?.value).toBe("decode");
    expect(reverseChoice("yaml", "decode")?.value).toBe("encode");
    expect(reverseChoice("json", "pretty")).toBeNull();
    expect(reverseChoice("hash", "SHA-256")).toBeNull();
    expect(reverseChoice("bcd", "encode")).toBeNull();
  });

  it("labels the download by what the output is", () => {
    expect(outputLanguage("yaml", "encode", "a: 1")).toBe("YAML");
    expect(outputLanguage("json", "pretty", "{\n  \"a\": 1\n}")).toBe("JSON");
    expect(outputLanguage("sql", "encode", "SELECT\n  1")).toBe("SQL");
    expect(outputLanguage("qr", "encode", "data:image/png;base64,AAAA")).toBe("PNG");
    expect(outputLanguage("whitespace", "encode", "plain text")).toBe("Text");
  });
});

describe("JSON colouring", () => {
  const samples = [
    STARTERS.json,
    '{"a":"x\\"y","b":[1,-2.5e3,true,false,null],"c":{}}',
    '{"unterminated": "abc',
    "not json at all, 42 true",
    ""
  ];

  it("gives back every character exactly once, in order", () => {
    for (const sample of samples) {
      expect(tokenizeJson(sample).map((token) => token.text).join("")).toBe(sample);
    }
  });

  it("tells keys from string values", () => {
    const tokens = tokenizeJson('{"name": "Asha", "admin": true}');
    expect(tokens.find((token) => token.text === '"name"')?.type).toBe("key");
    expect(tokens.find((token) => token.text === '"Asha"')?.type).toBe("string");
    expect(tokens.find((token) => token.text === "true")?.type).toBe("boolean");
  });
});

describe("result wording", () => {
  it("counts objects and array items", () => {
    expect(jsonShape(JSON.stringify([{ a: [1, 2] }, { b: {} }]))).toEqual({ objects: 3, arrays: 2, arrayItems: 4 });
    expect(jsonShape("plain text")).toBeNull();
  });

  it("only counts objects where the output is the visitor's data", () => {
    expect(outputIsData("json")).toBe(true);
    expect(outputIsData("xml-validator")).toBe(false);
  });

  it("does not report an invalid document as a success", () => {
    const xml = summarizeResult("xml-validator", "encode", JSON.stringify({ valid: false, error: { msg: "Bad tag", line: 2, col: 5 } }), 3);
    expect(xml.tone).toBe("warning");
    expect(xml.note).toContain("line 2, column 5");

    const schema = summarizeResult("json-schema", "encode", JSON.stringify({ valid: false, errors: [{}, {}] }), 3);
    expect(schema).toMatchObject({ tone: "warning", title: "Data does not match the schema" });
    expect(schema.note).toContain("2 failures");

    expect(summarizeResult("luhn", "encode", JSON.stringify({ valid: false, checkDigit: 7 }), 1).tone).toBe("warning");
    expect(summarizeResult("jwt-sign", "verify", JSON.stringify({ valid: false }), 1).tone).toBe("warning");
    expect(summarizeResult("status", "encode", "Unknown status code. Try a standard 3-digit HTTP code.", 1).tone).toBe("warning");
  });

  it("does not treat a user's own `valid` field as a verdict", () => {
    expect(summarizeResult("json", "pretty", JSON.stringify({ valid: false }, null, 2), 1)).toMatchObject({ tone: "ready", title: "Valid JSON" });
  });

  it("describes the JSON formatter's three modes", () => {
    expect(summarizeResult("json", "pretty", "{}", 1).note).toContain("properly formatted");
    expect(summarizeResult("json", "minify", "{}", 1).note).toContain("Minified");
    expect(summarizeResult("json", "validate", JSON.stringify({ valid: true, type: "object" }), 1).note).toBe("The document parses as an object.");
  });

  it("counts regex matches and diff lines", () => {
    expect(summarizeResult("regex", "encode", JSON.stringify({ count: 3 }), 1).title).toBe("3 matches found");
    expect(summarizeResult("regex", "encode", JSON.stringify({ count: 0 }), 1).tone).toBe("warning");
    expect(summarizeResult("diff", "encode", " same\n-old\n+new\n+more", 1).title).toBe("2 lines added, 1 removed");
  });
});
