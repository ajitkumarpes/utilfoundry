import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  // Scoped to tests/ so `npm test` does not pick up e2e/*.spec.ts, which Playwright
  // runs in a browser and vitest cannot import.
  test: { environment: "node", include: ["tests/**/*.test.ts"] }
});
