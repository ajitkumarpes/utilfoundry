import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { THEME_COOKIE, THEMES as APP_THEMES } from "../lib/theme";

/*
 * This package has no "type": "module", so Playwright loads the spec as CommonJS and
 * import.meta is unavailable. Paths come from the run directory instead, which is the
 * package root — the same place playwright.config.ts lives.
 */
const TOOLS_DIR = join(process.cwd(), "app", "tools");
const SLUGS = readdirSync(TOOLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const FIXTURE = join(process.cwd(), "e2e", "fixtures", "sample.pdf");

/** One page per input shape, rather than all thirty-six: they share a shell and an uploader. */
const A11Y_SAMPLE = ["compress-pdf", "merge-pdf", "split-pdf", "protect-pdf"] as const;

test.describe("pdf tools", () => {
  test("every tool in the directory has a page that renders", async ({ page }) => {
    expect(SLUGS.length).toBeGreaterThan(30);
    for (const slug of SLUGS) {
      const response = await page.goto(`/tools/${slug}`);
      expect(response?.status(), `${slug} should return 200`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveTitle(/\w{4,}/);
    }
  });

  /**
   * Every theme the app ships, read from the catalog so a new one cannot slip past
   * unscanned. The theme lives in a cookie that an init script applies to <html> before
   * paint, so it is set before navigating: that scans the page a visitor actually gets,
   * rather than one repainted after load.
   */
  for (const slug of A11Y_SAMPLE) {
    for (const { id: theme } of APP_THEMES) {
      test(`${slug} has no accessibility violations in the ${theme} theme`, async ({ page, baseURL }) => {
        await page.context().addCookies([
          { name: THEME_COOKIE, value: theme, url: baseURL ?? "http://127.0.0.1:3061" },
        ]);
        await page.goto(`/tools/${slug}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }

  test("the uploader accepts a file and offers to clear it", async ({ page }) => {
    await page.goto("/tools/compress-pdf");
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await expect(page.getByText("sample.pdf")).toBeVisible();
    await expect(page.getByRole("button", { name: /replace file/i })).toBeVisible();
  });

  /**
   * The real round trip: a file goes to the backend, is processed, and comes back. This is
   * the class of failure a page-render check cannot see — a tool that loads perfectly and
   * fails the moment it is used. Needs a deployed API, so it is skipped without E2E_BASE_URL.
   */
  test("compress returns a processed PDF from the backend", async ({ page, request }) => {
    test.skip(!process.env.E2E_BASE_URL, "Needs a deployed backend; set E2E_BASE_URL.");

    // The API is a separate service that restarts with the frontend, and a page serving 200
    // says nothing about whether Spring has finished booting. Without this the test fails
    // with "Compression failed (HTTP 502)" purely because it arrived first.
    await expect
      .poll(
        async () => {
          const health = await request.get("/actuator/health").catch(() => null);
          return health?.status() ?? 0;
        },
        { message: "waiting for the backend to report healthy", timeout: 120_000, intervals: [1000] },
      )
      .toBe(200);

    await page.goto("/tools/compress-pdf");
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await page.getByRole("button", { name: "Compress PDF" }).click();

    await expect(page.getByText("Your PDF is ready")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("link", { name: /Download compressed\.pdf/i })).toBeVisible();
    await expect(page.locator(".error-box")).toHaveCount(0);
  });

  test("a non-PDF file is refused with a readable message", async ({ page }) => {
    await page.goto("/tools/compress-pdf");
    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not a pdf"),
    });
    await expect(page.locator(".error-box")).toContainText(/only|pdf/i);
  });
});
