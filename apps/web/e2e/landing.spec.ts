import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEVELOPER_URL, IMAGES_URL, PDF_URL } from "../lib/links";

/**
 * Opens a page with the dark colour scheme genuinely in force.
 *
 * `test.use({ colorScheme: "dark" })` is not enough on its own in every engine: Firefox drops
 * the context-level setting on a page's first navigation, and only an `emulateMedia` call made
 * on a loaded page, followed by a reload, takes. The developer app's suite ran its whole
 * dark-mode section in light mode for that reason. This suite is Chromium-only today, where
 * the reload is merely redundant; it means the section still measures what it says it does if
 * a browser is ever added here.
 */
async function gotoInDarkMode(page: Page, path: string) {
  await page.goto(path);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
}

test.describe("landing page", () => {
  test("has no automated accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test.describe("dark theme", () => {
    test.use({ colorScheme: "dark" });

    test("has no automated accessibility violations in dark mode", async ({ page }) => {
      await gotoInDarkMode(page, "/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test("keeps the legal pages and the missing-page screen accessible in dark mode", async ({ page }) => {
      for (const path of ["/privacy", "/terms", "/no-such-page"]) {
        await gotoInDarkMode(page, path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, path).toEqual([]);
      }
    });
  });

  /** The old footer linked nowhere at all; every product must be reachable from it. */
  test("links to every product from the footer", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    for (const href of [PDF_URL, DEVELOPER_URL, IMAGES_URL]) {
      await expect(footer.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });

  test("names every page after the site, and keeps the legal pages accessible", async ({ page }) => {
    for (const [path, title] of [["/privacy", "Privacy Policy — UtilFoundry"], ["/terms", "Terms of Service — UtilFoundry"]]) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, path).toEqual([]);
    }
  });

  /** A tool address typed against the wrong host is the likely way here, so it offers all three workspaces. */
  test("answers a missing page with a 404 that leads back to every workspace", async ({ page }) => {
    const response = await page.goto("/json-formatter");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found — UtilFoundry");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toContainText("not on utilfoundry.com");
    await expect(main.getByRole("link", { name: /home page/i })).toHaveAttribute("href", "/");
    for (const href of [PDF_URL, DEVELOPER_URL, IMAGES_URL]) {
      await expect(main.locator(`a[href="${href}"]`)).toBeVisible();
    }
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("offers a skip link and a working theme toggle", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();

    const before = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: /colour theme/i }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "light");
  });
});
