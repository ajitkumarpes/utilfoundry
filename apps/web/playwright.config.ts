import { defineConfig, devices } from "@playwright/test";

/** Its own port: 3011 is the developer suite, 3041 the image suite. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3051",
    trace: "on-first-retry"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_PRODUCTION
      ? "npm run start -- -p 3051"
      : "npm run dev -- --hostname 127.0.0.1 --port 3051",
    url: "http://127.0.0.1:3051",
    reuseExistingServer: !process.env.CI && !process.env.E2E_PRODUCTION,
    timeout: 120_000
  }
});
