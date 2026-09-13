import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("developer tools browser coverage", () => {
  test("every catalog tool produces rendered output or a validation result", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium",
      "The complete 63-tool sweep runs in Chromium; representative workflows cover other engines.",
    );
    await page.goto("/");
    await page.getByRole("button", { name: /View all 63 tools/ }).click();

    const cards = page.locator("button.tool-card");
    await expect(cards).toHaveCount(63);

    for (let index = 0; index < 63; index += 1) {
      const card = cards.nth(index);
      const toolId = await card.getAttribute("data-tool-id");
      expect(toolId).toBeTruthy();
      await card.click();
      await page.getByRole("button", { name: "Run tool" }).click();
      const notice = page.locator(".notice");
      await expect(notice).toContainText(/Done locally|Check your input/);
      await expect(
        page.locator(".has-output, .preview, .image-preview"),
      ).toHaveCount(1);
    }
  });

  test("representative tool modes transform user input in the browser", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /View all 63 tools/ }).click();
    const cases = [
      ["base64", "decode", "VXRpbE5leGE=", "UtilNexa"],
      ["hex", "decode", "41 42 43", '"text": "ABC"'],
      ["binary", "binary-to-hex", "01000001", "41"],
      ["bcd", "decode", "12 34 5F", "12345"],
      ["number", "16", "ff", '"decimal": 255'],
      ["jsonpath", "$.user.name", '{"user":{"name":"Asha"}}', "Asha"],
      ["color", "", "#4263EB80", '"hex8": "#4263EB80"'],
    ] as const;

    for (const [toolId, option, input, expected] of cases) {
      await page.locator(`button.tool-card[data-tool-id="${toolId}"]`).click();
      const textarea = page.locator("textarea");
      await textarea.fill(input);
      if (option) {
        const select = page.locator(".tool-options select");
        if (await select.count()) {
          await select.selectOption(option);
        } else {
          await page.locator(".tool-options input").fill(option);
        }
      }
      await page.getByRole("button", { name: "Run tool" }).click();
      await expect(
        page.locator(".has-output, .preview, .image-preview"),
      ).toHaveCount(1);
      await expect(page.locator(".pane").nth(1)).toContainText(expected);
    }
  });

  test("homepage has no automated accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("deep links select a tool and warn before sensitive data leaves the editor", async ({
    page,
  }) => {
    await page.goto("/?tool=jwt");
    await expect(page.getByRole("heading", { name: "JWT Decoder" })).toBeVisible();
    await page.getByLabel("JWT Decoder input").fill(
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    );
    await page.getByRole("button", { name: "Run tool" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Potentially sensitive" }),
    ).toContainText("JWT");
  });
});
