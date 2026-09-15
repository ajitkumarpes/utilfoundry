import { describe, expect, it } from "vitest";
import { NAV_GROUPS, READY_TOOLS, TOOLS, getTool, isToolId, parseBase64, safeInteger } from "@/lib/tools";

describe("tool registry", () => {
  it("accepts only registered tool slugs", () => {
    expect(isToolId("image-compressor")).toBe(true);
    expect(isToolId("ocr-image")).toBe(true);
    expect(isToolId("background-removal")).toBe(true);
    expect(isToolId("compress")).toBe(false);
    expect(isToolId("background-remover")).toBe(false);
  });

  it("keeps every slug unique", () => {
    expect(new Set(TOOLS.map((tool) => tool.id)).size).toBe(TOOLS.length);
  });

  it("places every tool in a sidebar group", () => {
    const groups = new Set(NAV_GROUPS.map((group) => group.category));
    for (const tool of TOOLS) expect(groups.has(tool.category)).toBe(true);
  });

  it("gives every shipped tool the copy the page needs", () => {
    for (const tool of READY_TOOLS) {
      expect(tool.highlights.length).toBeGreaterThan(0);
      expect(tool.action).not.toBe("");
      expect(tool.readyTitle).not.toBe("");
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it("ships every listed tool, or marks it as unfinished", () => {
    // Nothing is on the waiting list any more; if a tool is added back to it,
    // it must have no engine so no half-finished screen can render.
    expect(READY_TOOLS).toHaveLength(TOOLS.length);
    for (const tool of TOOLS.filter((tool) => tool.comingSoon)) expect(tool.engine).toBe("none");
  });

  it("gives every shipped tool an engine that can actually run it", () => {
    for (const tool of READY_TOOLS) expect(tool.engine).not.toBe("none");
  });

  it("only asks for a Base64 paste on the tool that decodes one", () => {
    for (const tool of TOOLS) {
      expect(tool.needsBase64).toBe(tool.id === "base64-to-image");
    }
  });

  it("lets the multi-image tools take more than one file", () => {
    const multi = TOOLS.filter((tool) => tool.multiple).map((tool) => tool.id).sort();
    expect(multi).toEqual([
      "contact-sheet", "image-collage", "image-compare", "image-compressor", "image-converter", "image-to-pdf", "screenshot-to-pdf"
    ]);
  });

  it("looks a tool up by slug", () => {
    expect(getTool("blur-image")?.name).toBe("Blur Image");
    expect(getTool("nope")).toBeUndefined();
  });
});

describe("shared guards", () => {
  it("clamps numeric options", () => {
    expect(safeInteger("99999", 10, 1, 100)).toBe(100);
    expect(safeInteger("not-a-number", 10, 1, 100)).toBe(10);
    expect(safeInteger(null, 0, 1, 100)).toBe(0);
  });

  it("decodes data URI Base64", () => {
    const parsed = parseBase64("data:image/png;base64,SGVsbG8=");
    expect(parsed.mime).toBe("image/png");
    expect(parsed.buffer.toString()).toBe("Hello");
  });

  it("rejects payloads that are not Base64", () => {
    expect(() => parseBase64("not base64 !!")).toThrow();
  });
});
