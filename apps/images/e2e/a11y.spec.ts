import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TOOLS } from "../lib/tools";

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

/**
 * One page per workbench shape rather than all thirty: the header, sidebar, hero,
 * step cards, rail and footer are shared, so these cover the palette and structure
 * that every page draws from.
 */
const SAMPLE = [
  "image-compressor",
  "crop-image",
  "image-compare",
  "color-picker",
  "image-to-pdf",
  "ocr-image"
] as const;

test.describe("image tools accessibility", () => {
  test("the sampled tools exist in the catalog", () => {
    for (const id of SAMPLE) {
      expect(TOOLS.some((tool) => tool.id === id && !tool.comingSoon), `${id} is not a live tool`).toBe(true);
    }
  });

  for (const id of SAMPLE) {
    test(`${id} has no automated accessibility violations`, async ({ page }) => {
      await page.goto(`/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test.describe("dark theme", () => {
    test.use({ colorScheme: "dark" });

    // The same pages again: the dark palette is a different set of colours, and a
    // surface that stays light in dark mode (the PDF page sheet) only shows up here.
    for (const id of SAMPLE) {
      test(`${id} has no automated accessibility violations in dark mode`, async ({ page }) => {
        await gotoInDarkMode(page, `/${id}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
});
