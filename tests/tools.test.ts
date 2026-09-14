import { describe, expect, it } from "vitest";
import { isToolId, parseBase64, safeInteger } from "@/lib/tools";

describe("image tool guards", () => {
  it("accepts only registered tools", () => {
    expect(isToolId("compress")).toBe(true);
    expect(isToolId("ocr")).toBe(true);
    expect(isToolId("screenshot-to-text")).toBe(true);
    expect(isToolId("remove-background")).toBe(true);
    expect(isToolId("background-remover")).toBe(false);
  });

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
});
