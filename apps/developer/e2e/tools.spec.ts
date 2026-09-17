import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TOOLS, getToolById } from "../lib/tools";

/**
 * Opens a page with the dark colour scheme genuinely in force.
 *
 * `test.use({ colorScheme: "dark" })` is not enough on its own. Measured with Playwright 1.63:
 * Firefox drops the context-level setting on a page's first navigation, and re-applying it
 * before any navigation, or after a blank hop, changes nothing — only an `emulateMedia` call
 * made on a loaded page, followed by a reload, takes. Until this was found, every dark-mode
 * check below loaded in light mode and failed on the theme assertion, so the dark palette's
 * contrast had never actually been measured in Firefox.
 */
async function gotoInDarkMode(page: Page, path: string) {
  await page.goto(path);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
}

/**
 * Waits for the tool island to be live before the test types into it.
 *
 * Filling a field mid-hydration is not a fair test of the app: Playwright's fill is a
 * select-all followed by an insert, and a React re-render landing between the two drops the
 * selection, so the text arrives in front of the example rather than replacing it. React
 * attaches its fiber to a DOM node as it hydrates it, which is the signal that the island
 * is attached and a keystroke will reach it. What a visitor typing in that same gap gets is
 * a separate question, covered by its own test below.
 */
async function hydratedInput(page: Page) {
  const textarea = page.locator("textarea");
  await expect(textarea).toBeVisible();
  await expect
    .poll(() => textarea.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"))))
    .toBe(true);
  return textarea;
}

/** Each tool has its own page, so the sweep visits URLs rather than clicking cards. */
test.describe("developer tools browser coverage", () => {
  test("every catalog tool produces rendered output or a validation result", async ({ page }) => {
    test.skip(
      test.info().project.name !== "chromium",
      "The complete 70-tool sweep runs in Chromium; representative workflows cover other engines.",
    );

    for (const tool of TOOLS) {
      await page.goto(`/${tool.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: tool.name })).toBeVisible();
      await page.getByRole("button", { name: "Run tool" }).click();
      // The shipped example must actually succeed. Accepting "Check your input" here let
      // seven tools ship with examples that error the moment you press Run — and hid two
      // tools that the production CSP broke outright.
      await expect(page.locator(".notice")).toContainText("Done locally", { timeout: 15_000 });
      await expect(page.locator(".has-output, .preview, .image-preview")).toHaveCount(1);
    }
  });

  test("representative tool modes transform user input in the browser", async ({ page }) => {
    const cases = [
      ["base64", "decode", "VXRpbEZvdW5kcnk=", "UtilFoundry"],
      ["hex", "decode", "41 42 43", '"text": "ABC"'],
      ["binary", "binary-to-hex", "01000001", "41"],
      ["bcd", "decode", "12 34 5F", "12345"],
      ["bcd", "encode", "12345", "12 34 5F"],
      ["number", "16", "ff", '"decimal": "255"'],
      ["number", "16", "FFFFFFFFFFFFFFFF", '"decimal": "18446744073709551615"'],
      ["jsonpath", "$.user.name", '{"user":{"name":"Asha"}}', "Asha"],
      ["color", "", "#4263EB80", '"hex8": "#4263EB80"'],
      ["openapi-diff", "", '{"openapi":"3.0.3","info":{"title":"A","version":"1"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"},"404":{"description":"missing"}}}}}}\n---\n{"openapi":"3.0.3","info":{"title":"A","version":"2"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"}}}}}}', "removed-response"],
      ["json-schema-generator", "", '{"name":"Asha","age":30}', '"$schema"'],
      ["log-redactor", "", "authorization: Bearer abc api_key=secret", "REDACTED"],
      ["protobuf", "", "08 96 01 12 05 48 65 6C 6C 6F", '"wireType": 0'],
      ["asn1", "", "30 0A 02 01 05 04 05 48 65 6C 6C 6F", '"constructed": true'],
      ["regex-safe", "", "aaaaaaaaaaaaaaaaaaaaaaaa", '"safe": true'],
    ] as const;

    for (const [toolId, option, input, expected] of cases) {
      const tool = getToolById(toolId);
      expect(tool, `${toolId} is missing from the catalog`).toBeDefined();
      await page.goto(`/${tool!.slug}`);
      const textarea = await hydratedInput(page);
      await textarea.fill(input);
      if (option) {
        const select = page.locator(".tool-options select");
        if (await select.count()) {
          await select.selectOption(option);
        } else {
          await page.locator(".tool-options input").fill(option);
        }
      }
      // Typing can land before the island hydrates, and React used to write the shipped
      // example back over it — which is what a visitor on a slow connection would also
      // get. Asserting the field first means a return of that bug fails here by name
      // rather than as an unexplained wrong answer further down.
      await expect(textarea).toHaveValue(input);
      await page.getByRole("button", { name: "Run tool" }).click();
      await expect(page.locator(".has-output, .preview, .image-preview")).toHaveCount(1);
      await expect(page.locator(".pane").nth(1)).toContainText(expected);
    }
  });

  /**
   * Every tool page is prerendered, so the input box is on screen and editable well before the
   * island hydrates — a real gap on a slow connection. React used to seed its state from the
   * shipped example and write that back over the box, so a paste made in the gap disappeared
   * and the tool then ran on the example instead, with nothing to say it had.
   */
  test("a paste that lands before hydration is kept, not replaced by the example", async ({ page }) => {
    // Hold the client bundle back so the gap is real and the same size every run. On a fast
    // local build hydration wins the race and the test would pass without proving anything.
    await page.route("**/_next/static/chunks/**", async (route) => {
      await new Promise((resume) => setTimeout(resume, 900));
      await route.continue();
    });

    await page.goto("/json-formatter", { waitUntil: "commit" });
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    const pasted = '{"pasted":"before hydration"}';
    await textarea.evaluate((el, value) => {
      (el as HTMLTextAreaElement).value = value;
    }, pasted);

    // The point of the test is the gap, so its absence has to fail rather than pass quietly.
    const hydratedAlready = await textarea.evaluate((el) =>
      Object.keys(el).some((key) => key.startsWith("__reactFiber$")),
    );
    expect(hydratedAlready, "the bundle was not held back, so nothing was tested").toBe(false);

    await hydratedInput(page);
    await expect(textarea).toHaveValue(pasted);

    // And the run has to use it, not merely leave it on screen.
    await page.getByRole("button", { name: "Run tool" }).click();
    await expect(page.locator(".pane").nth(1)).toContainText("before hydration");
  });

  test("the root redirects to the first tool", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/json-formatter$/);
  });

  /**
   * One page per distinct shape of the workbench — plain panes, rendered HTML, an image
   * result, extra option fields, the payments warning, and the file picker — rather than
   * all seventy, since every tool draws from the same shell.
   */
  const A11Y_SAMPLE = [
    "json-formatter",
    "markdown-preview",
    "qr-generator",
    "jwt-hmac-signer",
    "luhn-pan-check",
    "image-to-base64",
  ] as const;

  for (const slug of A11Y_SAMPLE) {
    test(`${slug} has no accessibility violations`, async ({ page }) => {
      await page.goto(`/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test.describe("dark theme", () => {
    test.use({ colorScheme: "dark" });

    for (const slug of A11Y_SAMPLE) {
      test(`${slug} has no accessibility violations in dark mode`, async ({ page }) => {
        await gotoInDarkMode(page, `/${slug}`);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });

  test("legacy deep links still land on the tool and warn before sensitive data is processed", async ({ page }) => {
    await page.goto("/?tool=jwt");
    await expect(page).toHaveURL(/\/jwt-decoder$/);
    await expect(page.getByRole("heading", { level: 1, name: "JWT Decoder" })).toBeVisible();
    await page.getByLabel("JWT Decoder input").fill("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature");
    await page.getByRole("button", { name: "Run tool" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Potentially sensitive" })).toContainText("JWT");
  });
});
