import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TOOLS, getToolById } from "../lib/tools";

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
      ["number", "16", "ff", '"decimal": 255'],
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
      await page.locator("textarea").fill(input);
      if (option) {
        const select = page.locator(".tool-options select");
        if (await select.count()) {
          await select.selectOption(option);
        } else {
          await page.locator(".tool-options input").fill(option);
        }
      }
      await page.getByRole("button", { name: "Run tool" }).click();
      await expect(page.locator(".has-output, .preview, .image-preview")).toHaveCount(1);
      await expect(page.locator(".pane").nth(1)).toContainText(expected);
    }
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
        await page.goto(`/${slug}`);
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
