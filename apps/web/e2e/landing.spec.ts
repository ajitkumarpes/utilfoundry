import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEVELOPER_URL, IMAGES_URL, PDF_URL } from "../lib/links";

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
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
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

  test("offers a skip link and a working theme toggle", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();

    const before = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: /colour theme/i }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "light");
  });
});
