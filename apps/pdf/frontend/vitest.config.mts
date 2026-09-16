import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The hook and the page renderer both need a DOM; the rest do not mind having one.
    environment: "jsdom",
    // Scoped to tests/ so vitest never picks up e2e/, which Playwright runs in a browser.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      // The pages post to a backend and are covered by the Playwright suite; lib/ is the
      // logic that can be tested in isolation, so that is what these numbers describe.
      include: ["lib/**/*.ts"],
      reporter: ["text", "json-summary"],
      // Measured at 100% when these tests were written. Enforced so a later change has to
      // bring its own tests rather than quietly lowering the bar.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
