// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, getAppliedTheme } from "../lib/theme";

/**
 * getAppliedTheme runs during server rendering too, where there is no document. A jsdom
 * test can never reach that branch, so it gets its own file with a node environment.
 */
describe("getAppliedTheme without a document", () => {
  it("returns the default theme rather than throwing", () => {
    expect(typeof document).toBe("undefined");
    expect(getAppliedTheme()).toBe(DEFAULT_THEME);
  });
});
