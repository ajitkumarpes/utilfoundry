import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build (`npm run build` first) and a real Postgres
 * that the suite may wipe: E2E_DATABASE_URL. Serial, because the tests share that database.
 */
const PORT = 3098;
const HTTPS_PORT = 3097;
export const E2E = {
  password: "e2e-admin-password-7f3a",
  databaseUrl: process.env.E2E_DATABASE_URL ?? "postgres://admin_user:admin_password@127.0.0.1:5434/admin_e2e",
  allowedOrigin: "https://dev.utilfoundry.test"
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure"
  },
  // The device profiles carry normal browser user agents, not "HeadlessChrome", which the
  // visit endpoint would rightly ignore as a bot.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // WebKit keeps Secure cookies only over https, so it goes through the TLS proxy below.
    { name: "webkit", use: { ...devices["Desktop Safari"], baseURL: `https://localhost:${HTTPS_PORT}`, ignoreHTTPSErrors: true } }
  ],
  webServer: [
    {
      command: `node scripts/migrate.mjs && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: E2E.databaseUrl,
        ADMIN_PASSWORD: E2E.password,
        ADMIN_SESSION_SECRET: "e2e".repeat(22),
        CORS_ALLOWED_ORIGINS: `${E2E.allowedOrigin},https://images.utilfoundry.test`,
        RATE_LIMIT_LOGIN_GLOBAL_PER_MINUTE: "1000"
      }
    },
    {
      command: "node e2e/https-proxy.mjs",
      url: `https://localhost:${HTTPS_PORT}/api/health`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      env: { PROXY_PORT: String(HTTPS_PORT), TARGET_PORT: String(PORT) }
    }
  ]
});
