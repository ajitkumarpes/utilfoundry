import { expect, type Locator, type Page } from "@playwright/test";
import { splitDocuments, splitInputFor } from "../lib/split-input";
import { getTool, type ToolDefinition } from "../lib/tools";

/** True once React has attached to the element, i.e. the island is live and clicks will land. */
export async function waitForHydration(locator: Locator) {
  await expect(locator).toBeVisible();
  // Generous on purpose: this waits for readiness, it does not measure it, and with every
  // browser running in parallel hydration of a full tool page can take longer than 5 s.
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps$"))), { timeout: 15_000 })
    .toBe(true);
}

export async function openTool(page: Page, slug: string): Promise<ToolDefinition> {
  const tool = getTool(slug);
  if (!tool) throw new Error(`No tool with slug ${slug}`);
  // The heading and hydration checks below are the real readiness signal; waiting for "load"
  // as well only adds a way to time out on a slow subresource (seen on CI in Firefox).
  await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: tool.name })).toBeVisible();
  await waitForHydration(runButton(page));
  return tool;
}

export const runButton = (page: Page) => page.getByRole("button", { name: "Run tool" });
export const inputBox = (page: Page, tool: ToolDefinition) => page.getByLabel(`${tool.name} input`, { exact: true });
export const outputBox = (page: Page, tool: ToolDefinition) => page.getByLabel(`${tool.name} output`, { exact: true });
export const banner = (page: Page) => page.locator(".result-banner");

/**
 * Types into the input the way a visitor would. The two-document tools have one editor per
 * document, so a value written with the tools' own `---` separator is split across the two.
 */
export async function setInput(page: Page, tool: ToolDefinition, value: string) {
  const split = splitInputFor(tool.id);
  if (split) {
    const [first, second] = splitDocuments(value);
    for (const [label, text] of [[split.first, first], [split.second, second]] as const) {
      const box = page.getByLabel(`${tool.name} ${label}`, { exact: true });
      await box.fill(text);
      await expect(box).toHaveValue(text);
    }
    return;
  }
  const box = inputBox(page, tool);
  await box.fill(value);
  await expect(box).toHaveValue(value);
}

export async function choose(page: Page, label: string) {
  await page.getByRole("radio", { name: label, exact: true }).check();
}

export async function setField(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true });
  if ((await field.evaluate((el) => el.tagName)) === "SELECT") await field.selectOption({ label: value });
  else await field.fill(value);
}

/** Runs the tool and waits for the banner to report something other than "Running…". */
export async function run(page: Page) {
  await runButton(page).click();
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).not.toHaveClass(/is-busy/, { timeout: 15_000 });
}

export async function readOutput(page: Page, tool: ToolDefinition) {
  return outputBox(page, tool).inputValue();
}

export async function expectTone(page: Page, tone: "ready" | "warning" | "error") {
  const classes = (await banner(page).getAttribute("class")) ?? "";
  const actual = classes.includes("is-error") ? "error" : classes.includes("is-warning") ? "warning" : "ready";
  expect(actual, `banner says: ${await banner(page).innerText()}`).toBe(tone);
}
