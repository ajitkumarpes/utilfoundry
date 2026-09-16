import { describe, expect, it } from "vitest";
import { COUNT_LOCALE, formatCount } from "../lib/format";

describe("counts render the same on the server and in the browser", () => {
  it("groups with a pinned locale rather than the ambient one", () => {
    expect(formatCount(500_000)).toBe("500,000");
    expect(formatCount(1_234)).toBe("1,234");
    expect(formatCount(0)).toBe("0");
  });

  it("does not follow the environment's locale", () => {
    // The bug this replaces: an Indian visitor rendered "5,00,000" over a
    // server-rendered "500,000" and React threw a hydration mismatch.
    expect(formatCount(500_000)).not.toBe((500_000).toLocaleString("en-IN"));
    expect(formatCount(500_000)).not.toBe((500_000).toLocaleString("de-DE"));
    expect(COUNT_LOCALE).toBe("en-GB");
  });
});
