import { describe, expect, it } from "vitest";
import { reflow } from "@/lib/text";

describe("reflow", () => {
  it("rejoins wrapped lines and keeps paragraph breaks", () => {
    expect(reflow("Invoice Total\n1,770\n\n\nThank you for\n  your business  ")).toBe("Invoice Total 1,770\n\nThank you for your business");
  });

  it("leaves single-line text alone and drops empty blocks", () => {
    expect(reflow("DREAM PLAN DO REPEAT")).toBe("DREAM PLAN DO REPEAT");
    expect(reflow("\n\n  \n")).toBe("");
  });
});
