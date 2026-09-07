import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3011",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_PRODUCTION
      ? "npm run start -- -p 3011"
      : "npm run dev -- --hostname 127.0.0.1 --port 3011",
    url: "http://127.0.0.1:3011",
    reuseExistingServer: !process.env.CI && !process.env.E2E_PRODUCTION,
    timeout: 120_000,
  },
});
