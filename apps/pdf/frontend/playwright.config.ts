import { defineConfig, devices } from "@playwright/test";

/**
 * Its own port: 3011 is the developer suite, 3041 images, 3051 the landing page.
 *
 * Set E2E_BASE_URL to run against a deployed site instead of a local server. The
 * round-trip test needs one, because the API host is baked in at build time and a
 * locally built frontend points at a backend that is not exposed outside Compose.
 */
const externalBase = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // the backend rate-limits at 20 requests a minute
  workers: 1,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBase || "http://127.0.0.1:3061",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBase
    ? undefined
    : {
        command: process.env.E2E_PRODUCTION
          ? "npm run start -- -p 3061"
          : "npm run dev -- --hostname 127.0.0.1 --port 3061",
        url: "http://127.0.0.1:3061",
        reuseExistingServer: !process.env.CI && !process.env.E2E_PRODUCTION,
        timeout: 120_000,
      },
});
