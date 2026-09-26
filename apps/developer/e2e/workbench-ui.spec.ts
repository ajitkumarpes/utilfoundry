import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { banner, choose, inputBox, openTool, outputBox, readOutput, run, runButton, setInput, waitForHydration } from "./helpers";

/** Everything around the tools themselves: the controls a visitor clicks on the way to a result. */

// Reading the clipboard back needs a permission only Chromium's automation can grant, so the
// read-back assertions run there; the copy itself is exercised in every engine.
test.beforeEach(async ({ context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());
const canReadClipboard = (browserName: string) => browserName === "chromium";
const toast = (page: Page) => page.locator(".toast");

test.describe("result panel", () => {
  test("Info shows what the tool is for, and a run brings its Result forward", async ({ page }) => {
    const tool = await openTool(page, "json-formatter");
    const info = page.getByRole("tabpanel");
    await expect(info.getByRole("heading", { name: "Why use this tool?" })).toBeVisible();
    await expect(info.getByText("Pretty print (human readable)")).toBeVisible();
    await expect(info.getByText("Common use cases")).toBeVisible();

    await page.getByRole("tab", { name: "Result" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("No result yet");
    await page.getByRole("tab", { name: "Info" }).click();

    // No click on Result: the answer comes to the visitor.
    await run(page);
    await expect(page.getByRole("tab", { name: "Result" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("Valid JSON");
    await expect(page.getByRole("tabpanel")).toContainText("Array items");
    await expect(page.getByRole("button", { name: "Copy to clipboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download as JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share result" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Validate against a schema" })).toHaveAttribute("href", "/json-schema-validator");

    // Clearing the bench is a fresh start: back to Info, and the bar back to ready.
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByRole("tab", { name: "Info" })).toHaveAttribute("aria-selected", "true");
    await expect(banner(page)).toHaveCount(0);
    await expect(inputBox(page, tool)).toHaveValue("");
  });

  test("a tool's own details come with its result", async ({ page }) => {
    const tool = await openTool(page, "jwt-decoder");
    const exp = Math.floor(Date.now() / 1000) + 3 * 86400;
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    await setInput(page, tool, `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "user-9", exp })}.c2ln`);
    await run(page);
    const details = page.getByRole("tabpanel").locator(".result-details");
    await expect(details).toContainText("HS256");
    await expect(details).toContainText("user-9");
    await expect(details).toContainText("in 3 days");
  });

  test("JSON output can be browsed as a tree", async ({ page }) => {
    const tool = await openTool(page, "json-formatter");
    await setInput(page, tool, '{"user":{"name":"Asha","roles":["admin"]}}');
    await run(page);
    const views = page.getByRole("group", { name: "Show the output as" });
    await views.getByRole("button", { name: "Tree" }).click();
    const tree = page.getByRole("region", { name: "JSON Formatter output as a tree" });
    await expect(tree).toContainText('"name"');
    await expect(tree).toContainText('"Asha"');
    await tree.getByRole("button", { name: "Collapse user" }).click();
    await expect(tree).not.toContainText('"Asha"');
    await views.getByRole("button", { name: "Code" }).click();
    await expect(outputBox(page, tool)).toHaveValue(/"Asha"/);
  });

  test("a pane opens full screen and Escape brings it back", async ({ page }) => {
    await openTool(page, "json-formatter");
    await page.getByRole("button", { name: "Open json formatter input full screen" }).click();
    await expect(page.locator(".step-card.is-expanded")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".step-card.is-expanded")).toHaveCount(0);
  });

  test("the two-document tools give each document its own editor", async ({ page }) => {
    const tool = await openTool(page, "json-diff");
    const original = page.getByLabel("JSON Diff Original JSON", { exact: true });
    const changed = page.getByLabel("JSON Diff Changed JSON", { exact: true });
    await original.fill('{"a":1,"b":2}');
    await changed.fill('{"b":2,"a":3}');
    await run(page);
    expect(JSON.parse(await readOutput(page, tool))).toEqual([{ path: "$.a", left: 1, right: 3 }]);

    await changed.fill("");
    await run(page);
    await expect(banner(page)).toHaveClass(/is-error/);
    await expect(banner(page)).toContainText("Changed JSON editor is empty");
  });

  test("tabs follow the arrow keys", async ({ page }) => {
    await openTool(page, "json-formatter");
    await page.getByRole("tab", { name: "Info" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Result" })).toBeFocused();
    await expect(page.getByRole("tab", { name: "Result" })).toHaveAttribute("aria-selected", "true");
  });

  test("Minify this JSON re-runs in the other mode", async ({ page }) => {
    const tool = await openTool(page, "json-formatter");
    await setInput(page, tool, '{"a": [1, 2]}');
    await run(page);
    await page.getByRole("tab", { name: "Result" }).click();
    await page.getByRole("button", { name: "Minify this JSON" }).click();
    await expect(outputBox(page, tool)).toHaveValue('{"a":[1,2]}');
    await expect(page.getByRole("radio", { name: "Minify", exact: true })).toBeChecked();
    await expect(page.getByRole("button", { name: "Pretty print this JSON" })).toBeVisible();
  });

  test("Reverse sends the output back through the opposite mode", async ({ page }) => {
    const tool = await openTool(page, "base64-encoder");
    await setInput(page, tool, "round trip ✓");
    await run(page);
    const encoded = await readOutput(page, tool);
    await page.getByRole("tab", { name: "Result" }).click();
    await page.getByRole("button", { name: "Reverse: Decode" }).click();
    await expect(inputBox(page, tool)).toHaveValue(encoded);
    await expect(outputBox(page, tool)).toHaveValue("round trip ✓");
    await expect(page.getByRole("radio", { name: "Decode", exact: true })).toBeChecked();
  });

  test("changing the mode after a run answers again", async ({ page }) => {
    const tool = await openTool(page, "json-formatter");
    await setInput(page, tool, '{"a":1}');
    await run(page);
    await choose(page, "Minify");
    await expect(outputBox(page, tool)).toHaveValue('{"a":1}');
    await choose(page, "Validate only");
    await expect(outputBox(page, tool)).toHaveValue(/"valid": true/);
  });

  test("the size badge compares output with input", async ({ page }) => {
    const tool = await openTool(page, "json-minifier");
    await setInput(page, tool, '{\n    "a": 1,\n    "b": 2\n}');
    await run(page);
    await page.getByRole("tab", { name: "Result" }).click();
    await expect(page.locator(".size-change")).toHaveText("-50%");
  });
});

test.describe("running and editing", () => {
  test("Ctrl+Enter and Cmd+Enter run the tool from the editor", async ({ page }) => {
    const tool = await openTool(page, "url-encoder");
    await setInput(page, tool, "a b");
    await inputBox(page, tool).press("Control+Enter");
    await expect(outputBox(page, tool)).toHaveValue("a%20b");
    await setInput(page, tool, "c d");
    await inputBox(page, tool).press("Meta+Enter");
    await expect(outputBox(page, tool)).toHaveValue("c%20d");
  });

  test("Example, Clear and Reset", async ({ page }) => {
    const tool = await openTool(page, "base64-encoder");
    const example = await inputBox(page, tool).inputValue();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(inputBox(page, tool)).toHaveValue("");
    await page.getByRole("button", { name: "Example", exact: true }).click();
    await expect(inputBox(page, tool)).toHaveValue(example);

    await choose(page, "Decode");
    await setInput(page, tool, "SGk=");
    await run(page);
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("radio", { name: "Encode", exact: true })).toBeChecked();
    await expect(outputBox(page, tool)).toHaveValue("");
    await expect(banner(page)).toHaveCount(0);
    await expect(inputBox(page, tool)).toHaveValue("SGk=");
  });

  test("the status line tracks the caret, size and language", async ({ page }) => {
    const tool = await openTool(page, "json-formatter");
    await setInput(page, tool, '{\n  "a": 1\n}');
    await inputBox(page, tool).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(7, 7));
    await inputBox(page, tool).press("ArrowLeft");
    const editor = page.locator(".editor").first();
    const status = editor.locator(".editor-status");
    await expect(status).toContainText("Ln 2, Col 5");
    await expect(status).toContainText("Spaces: 2");
    await expect(status).toContainText("UTF-8");
    await expect(status).toContainText("12 bytes");
    await expect(editor.locator(".editor-lang")).toHaveText("JSON");
  });

  test("Jump to error puts the caret on the fault", async ({ page }) => {
    const tool = await openTool(page, "json-validator");
    const broken = '{\n  "ok": true,\n  "list": [1, 2,]\n}';
    await setInput(page, tool, broken);
    await run(page);
    await expect(banner(page)).toContainText("Line 3, column 17");
    await expect(page.locator(".gutter-mark.is-error")).toHaveText("3");
    await banner(page).getByRole("button", { name: "Jump to error" }).click();
    await expect(inputBox(page, tool)).toBeFocused();
    expect(await inputBox(page, tool).evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(broken.indexOf("]"));
  });

  test("the bar says the bench is ready before the first run", async ({ page }) => {
    await openTool(page, "json-formatter");
    await expect(page.locator(".action-bar")).toContainText("Ready when you are");
    await expect(banner(page)).toHaveCount(0);
    await run(page);
    await expect(page.locator(".action-bar")).toHaveClass(/is-ready/);
    await expect(banner(page)).toContainText("Processed locally");
  });

  test("a file dropped on the input editor is loaded", async ({ page }) => {
    const tool = await openTool(page, "yaml-formatter");
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["name:   dropped\nitems: [1, 2]"], "config.yaml", { type: "text/yaml" }));
      return transfer;
    });
    const editor = page.locator(".editor").first();
    await editor.dispatchEvent("dragover", { dataTransfer });
    await expect(editor).toHaveClass(/is-dragging/);
    await editor.dispatchEvent("drop", { dataTransfer });
    await expect(inputBox(page, tool)).toHaveValue("name:   dropped\nitems: [1, 2]");
    await expect(toast(page)).toContainText("Loaded config.yaml");
    await run(page);
    await expect(outputBox(page, tool)).toHaveValue("name: dropped\nitems:\n  - 1\n  - 2\n");
  });

  test("Open a file from the menu", async ({ page }) => {
    const tool = await openTool(page, "sql-formatter");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Open a file…" }).click();
    await (await chooser).setFiles({ name: "query.sql", mimeType: "text/plain", buffer: Buffer.from("select 1") });
    await expect(inputBox(page, tool)).toHaveValue("select 1");
  });

  test("a workspace saves, exports and imports", async ({ page }) => {
    const tool = await openTool(page, "regex-tester");
    await page.getByLabel("Pattern", { exact: true }).fill("\\d+");
    await setInput(page, tool, "order 42");

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Save workspace" }).click();
    const saved = JSON.parse((await page.evaluate(() => localStorage.getItem("utilfoundry-dev-workspace"))) ?? "{}");
    expect(saved).toMatchObject({ tool: "regex", input: "order 42", pattern: "\\d+" });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Export workspace" }).click();
    expect((await download).suggestedFilename()).toBe("utilfoundry-workspace.json");

    await setInput(page, tool, "changed");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Import workspace…" }).click();
    await (await chooser).setFiles({ name: "w.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
    await expect(inputBox(page, tool)).toHaveValue("order 42");
    await expect(page.getByLabel("Pattern", { exact: true })).toHaveValue("\\d+");
  });

  test("the More menu closes with Escape", async ({ page }) => {
    await openTool(page, "json-formatter");
    await page.getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("a pasted credential raises a warning before it is processed", async ({ page }) => {
    const tool = await openTool(page, "base64-encoder");
    await setInput(page, tool, "key AKIAABCDEFGHIJKLMNOP");
    await run(page);
    await expect(page.getByRole("alert").filter({ hasText: "Potentially sensitive" })).toContainText("AWS access key");
  });

  test("payments tools say to use test data", async ({ page }) => {
    await openTool(page, "luhn-pan-check");
    await expect(page.getByText("Use masked test data only.")).toBeVisible();
  });
});

test.describe("copy, download and share", () => {
  test("Copy puts the output on the clipboard", async ({ page, browserName }) => {
    test.skip(!canReadClipboard(browserName), "Only Chromium lets the test read the clipboard back.");
    const tool = await openTool(page, "hash-generator");
    await setInput(page, tool, "abc");
    await run(page);
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(toast(page)).toContainText("Output copied to clipboard");
    expect(await clipboard(page)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("the input's status-line copy button copies the input", async ({ page, browserName }) => {
    test.skip(!canReadClipboard(browserName), "Only Chromium lets the test read the clipboard back.");
    const tool = await openTool(page, "json-formatter");
    await setInput(page, tool, '{"copy":"me"}');
    await page.getByRole("button", { name: "Copy json formatter input" }).click();
    expect(await clipboard(page)).toBe('{"copy":"me"}');
  });

  test("Download saves the output with the right extension", async ({ page }) => {
    const tool = await openTool(page, "yaml-to-json");
    await choose(page, "JSON → YAML");
    await setInput(page, tool, '{"a":1}');
    await run(page);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("yaml-to-json-output.yaml");
    const path = await file.path();
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(path, "utf8")).toBe("a: 1\n");
  });

  test("Share copies the page link", async ({ page, browserName }) => {
    test.skip(!canReadClipboard(browserName), "Only Chromium lets the test read the clipboard back.");
    await openTool(page, "json-formatter");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(toast(page)).toContainText("Link copied");
    expect(await clipboard(page)).toMatch(/\/json-formatter$/);
  });
});

test.describe("documentation", () => {
  test("opens with the tool's own details and closes", async ({ page }) => {
    await openTool(page, "hash-generator");
    await page.getByRole("button", { name: /View full documentation/ }).click();
    const dialog = page.getByRole("dialog", { name: "Hash Generator" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("How to use it");
    await expect(dialog).toContainText("SHA-256, SHA-384, SHA-512, SHA-1");
    await expect(dialog).toContainText("Keyboard shortcuts");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: /View full documentation/ }).click();
    await dialog.getByRole("button", { name: "Close documentation" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("navigation and preferences", () => {
  test("favorites show in the sidebar and on the All tools page", async ({ page }) => {
    await openTool(page, "sql-formatter");
    const sidebar = page.getByRole("complementary", { name: "Developer tools" });
    await expect(sidebar.getByText("to pin it here")).toBeVisible();
    await page.getByRole("button", { name: "Add to favorites" }).click();
    await expect(page.getByRole("button", { name: "Favorited" })).toHaveAttribute("aria-pressed", "true");
    const pinned = sidebar.locator(".nav-pinned").first();
    await expect(pinned.getByRole("link", { name: "SQL Formatter" })).toBeVisible();
    await pinned.getByRole("link", { name: "Manage" }).click();
    await expect(page).toHaveURL(/\/tools\?view=favorites$/);
    await expect(page.locator(".catalog-card").getByRole("link", { name: /SQL Formatter/ })).toBeVisible();
    await page.getByRole("button", { name: "Remove SQL Formatter from favorites" }).click();
    await expect(page.getByText("No favorites yet.")).toBeVisible();
  });

  test("recently used lists the last tools opened, newest first", async ({ page }) => {
    await openTool(page, "json-formatter");
    await openTool(page, "base64-encoder");
    await openTool(page, "url-encoder");
    const recent = page.getByRole("complementary", { name: "Developer tools" }).locator(".nav-pinned").nth(1);
    await expect(recent.locator(".nav-tool-label")).toHaveText(["URL Encoder", "Base64 Encoder", "JSON Formatter"]);
    await page.goto("/tools?view=recent");
    // Retried: the page shows every tool until it has read this browser's history.
    await expect(page.locator(".catalog-card b")).toHaveText(["URL Encoder", "Base64 Encoder", "JSON Formatter"]);
  });

  test("the sidebar filter narrows the list, / focuses it and Escape clears it", async ({ page }) => {
    await openTool(page, "json-formatter");
    // Leave the editor without clicking anything: a fixed click position can land on a header
    // link when fonts differ (it did on Linux CI).
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("/");
    const filter = page.getByRole("searchbox", { name: "Filter tools in this list" });
    await expect(filter).toBeFocused();
    await filter.fill("yaml");
    const sidebar = page.getByRole("complementary", { name: "Developer tools" });
    await expect(sidebar.getByText("2 matches")).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "YAML Formatter" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "SQL Formatter" })).toHaveCount(0);
    await filter.press("Escape");
    await expect(sidebar.getByRole("link", { name: "SQL Formatter" })).toBeVisible();
  });

  test("a collapsed category stays collapsed after a reload", async ({ page }) => {
    await openTool(page, "json-formatter");
    const toggle = page.getByRole("button", { name: "Payments" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "Luhn / PAN Check" })).toHaveCount(0);
    await page.reload();
    await waitForHydration(page.getByRole("button", { name: "Payments" }));
    await expect(page.getByRole("button", { name: "Payments" })).toHaveAttribute("aria-expanded", "false");
  });

  test("header search: Ctrl+K, arrow keys and Enter", async ({ page }) => {
    await openTool(page, "json-formatter");
    await page.keyboard.press("Control+K");
    const search = page.getByRole("textbox", { name: "Search developer tools" });
    await expect(search).toBeFocused();
    await search.fill("jwt");
    await expect(page.locator(".search-results a")).toHaveCount(3);
    await search.press("ArrowDown");
    await expect(page.locator(".search-results a.is-highlighted")).toContainText("JWT HMAC Signer");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/jwt-hmac-signer$/);
  });

  test("the theme toggle switches and remembers", async ({ page }) => {
    await openTool(page, "json-formatter");
    const before = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: "Switch colour theme" }).click();
    const after = await page.locator("html").getAttribute("data-theme");
    expect(after).not.toBe(before);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", after!);
  });

  test("the All tools page lists and filters every tool", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { level: 1, name: "Developer tools" })).toBeVisible();
    await expect(page.locator(".catalog-card")).toHaveCount(70);
    const filter = page.getByRole("searchbox", { name: "Filter tools in this list" });
    await waitForHydration(filter);
    await filter.fill("payment");
    await expect(page.getByRole("complementary", { name: "Developer tools" }).getByRole("link", { name: "EMV TLV Parser" })).toBeVisible();
    await page.locator(".catalog-card").getByRole("link", { name: /EMV TLV Parser/ }).click();
    await expect(page).toHaveURL(/\/emv-tlv-parser$/);
  });

  test("the breadcrumb and nav lead to the All tools page", async ({ page }) => {
    await openTool(page, "json-formatter");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Developer tools" }).click();
    await expect(page).toHaveURL(/\/tools$/);
  });

  test("the phone menu opens the sidebar and closes after choosing a tool", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTool(page, "json-formatter");
    await page.getByRole("button", { name: "Open tools menu" }).click();
    const sidebar = page.getByRole("complementary", { name: "Developer tools" });
    await expect(sidebar).toHaveClass(/is-open/);
    await sidebar.getByRole("link", { name: "Hash Generator" }).click();
    await expect(page).toHaveURL(/\/hash-generator$/);
    await expect(sidebar).not.toHaveClass(/is-open/);
    // Nothing on a phone may scroll the page sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe("feedback", () => {
  test("Suggest a tool opens the form as a feature request and sends it", async ({ page }) => {
    let sent: Record<string, unknown> | undefined;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type" };
    await page.route("**/api/feedback", async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      sent = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: "application/json", body: '{"ok":true}', headers: cors });
    });
    await openTool(page, "json-formatter");
    await page.getByRole("button", { name: "Suggest a tool" }).click();
    const dialog = page.locator("dialog.feedback-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Feature Request" })).toHaveClass(/active/);
    await expect(dialog.getByRole("textbox")).toHaveValue("Tool suggestion: ");
    await dialog.getByRole("textbox").fill("Tool suggestion: a TOML formatter");
    await dialog.getByRole("button", { name: "Submit Feedback" }).click();
    await expect(dialog.getByRole("heading", { name: "Thank You!" })).toBeVisible();
    expect(sent).toMatchObject({ app: "developer", category: "feature_request", toolId: "json", message: "Tool suggestion: a TOML formatter" });
  });

  test("the floating button opens the same form", async ({ page }) => {
    await openTool(page, "json-formatter");
    await expect(page.locator(".feedback-fab-label")).toHaveText("Feedback");
    await page.getByRole("button", { name: "Give feedback" }).click();
    await expect(page.locator("dialog.feedback-dialog")).toBeVisible();
  });
});

test.describe("accessibility of states that only appear after interaction", () => {
  test("off a Mac the shortcut hints read Ctrl, and stay legible", async ({ page }) => {
    // Mac hints are symbols (⌘ ↵), which the contrast check skips; "Ctrl" is text it measures.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "platform", { get: () => "Win32" }));
    await openTool(page, "json-formatter");
    await expect(runButton(page).locator("kbd")).toHaveText("Ctrl ↵");
    const scan = await new AxeBuilder({ page }).include(".btn-run").withRules(["color-contrast"]).analyze();
    expect(scan.violations).toEqual([]);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`result, error and documentation states have no violations (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("utilfoundry-theme", t), theme);
      const tool = await openTool(page, "json-formatter");
      await run(page);
      await page.getByRole("tab", { name: "Result" }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      await setInput(page, tool, '{"a":1,}');
      await runButton(page).click();
      await expect(banner(page)).toHaveClass(/is-error/);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      const xml = await openTool(page, "xml-validator");
      await setInput(page, xml, "<a><b></a>");
      await run(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      await page.getByRole("group", { name: "Show the output as" }).getByRole("button", { name: "Tree" }).click();
      await page.getByRole("button", { name: "Open the output full screen" }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press("Escape");

      await page.getByRole("tab", { name: "Info" }).click();
      await page.getByRole("button", { name: /View full documentation/ }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
});
