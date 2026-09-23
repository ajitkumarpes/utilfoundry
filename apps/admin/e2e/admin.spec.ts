import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E } from "../playwright.config";
import { base, FEEDBACK_TOTAL, freshIp, reset, seed, signIn, sql } from "./fixtures";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const feedbackBody = (overrides: Record<string, unknown> = {}) => ({
  app: "developer", category: "issue", toolId: "json", toolName: "JSON Formatter", rating: 2,
  message: "It broke", pageUrl: "https://dev.utilfoundry.test/json-formatter", ...overrides
});

test.beforeEach(async () => {
  await reset();
  await seed();
});

test.afterAll(async () => {
  await sql.end();
});

test.describe("signing in", () => {
  test("the dashboard sends a visitor who is not signed in to the sign-in page, and back afterwards", async ({ page }) => {
    await page.goto("/admin/feedback");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Ffeedback$/);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#login-error")).toHaveText("That password is not correct.");
    await expect(page.locator("#login-error")).toHaveAttribute("role", "alert");
    await page.getByLabel("Password", { exact: true }).fill(E2E.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/feedback$/);
    await expect(page.getByRole("heading", { level: 1, name: "Feedback" })).toBeVisible();
  });

  test("the session cookie is locked down", async ({ page, context }) => {
    await signIn(page);
    const cookie = (await context.cookies()).find((item) => item.name === "__Host-uf_admin");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
  });

  test("the password field can be revealed", async ({ page }) => {
    await page.goto("/admin/login");
    const field = page.getByLabel("Password", { exact: true });
    await field.fill("secret");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("a signed-in visitor skips the sign-in page, and signing out ends the session", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("guessing is slowed down per address", async ({ request }) => {
    const ip = freshIp();
    const attempt = () => request.post("/api/admin/login", { data: { password: "guess" }, headers: { origin: base(), "x-forwarded-for": ip } });
    for (let index = 0; index < 10; index += 1) expect((await attempt()).status()).toBe(401);
    const blocked = await attempt();
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  });
});

test.describe("access control", () => {
  test("admin data needs a session", async ({ request }) => {
    expect((await request.get("/api/admin/feedback/export")).status()).toBe(401);
    const page = await request.get("/admin", { maxRedirects: 0 });
    expect(page.status()).toBe(307);
  });

  test("a client-set prefetch header does not skip the session check", async ({ request }) => {
    const prefetches: Array<Record<string, string>> = [{ "next-router-prefetch": "1", rsc: "1" }, { purpose: "prefetch" }];
    for (const headers of prefetches) {
      const response = await request.get("/admin/feedback", { headers, maxRedirects: 0 });
      expect(response.status(), JSON.stringify(headers)).toBe(307);
      expect(await response.text()).not.toContain("Pasting a huge file");
    }
  });

  test("changes from another site are refused even with a valid session", async ({ page }) => {
    await signIn(page);
    const [row] = await sql`SELECT id FROM feedback WHERE status = 'new' LIMIT 1`;
    const attempt = (headers: Record<string, string>) =>
      page.context().request.patch(`/api/admin/feedback/${row.id}`, { data: { status: "reviewed" }, headers });
    expect((await attempt({ origin: "https://evil.example", "sec-fetch-site": "cross-site" })).status()).toBe(403);
    expect((await attempt({ origin: "https://evil.example" })).status()).toBe(403);
    expect((await sql`SELECT status FROM feedback WHERE id = ${row.id}`)[0].status).toBe("new");
    // The same change from the dashboard's own origin goes through.
    expect((await attempt({ origin: base() })).status()).toBe(200);
  });

  test("pages carry a nonce-based CSP and the usual hardening headers", async ({ request }) => {
    const response = await request.get("/admin/login");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(headers["content-security-policy"]).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("every page runs its scripts under the CSP and hydrates without errors", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to|hydrat/i.test(message.text())) problems.push(message.text());
    });
    // A hydration mismatch surfaces as a page error (React #418/#425) in a production build.
    page.on("pageerror", (error) => problems.push(error.message));
    await page.goto("/admin/login");
    await signIn(page);
    for (const path of ["/admin", "/admin/feedback", "/admin/visitors"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The theme script ran before paint, and hydration did not re-render the document over it.
      await expect(page.locator("html"), path).toHaveAttribute("data-theme", /light|dark/);
    }
    expect(problems).toEqual([]);
  });

  test("the health check reports the database", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  });
});

test.describe("public feedback endpoint", () => {
  test("accepts feedback from a UtilFoundry site and shows it in the inbox", async ({ request, page }) => {
    const response = await request.post("/api/feedback", {
      data: feedbackBody({ message: "Brand new report from the widget" }),
      headers: { origin: E2E.allowedOrigin, "x-forwarded-for": freshIp(), "user-agent": CHROME }
    });
    expect(response.status()).toBe(201);
    expect(response.headers()["access-control-allow-origin"]).toBe(E2E.allowedOrigin);
    await signIn(page);
    await page.goto("/admin/feedback");
    await expect(page.getByText("Brand new report from the widget")).toBeVisible();
  });

  test("answers the browser's preflight only for UtilFoundry sites", async ({ request }) => {
    const allowed = await request.fetch("/api/feedback", { method: "OPTIONS", headers: { origin: E2E.allowedOrigin, "access-control-request-method": "POST" } });
    expect(allowed.status()).toBe(204);
    expect(allowed.headers()["access-control-allow-methods"]).toContain("POST");
    const refused = await request.fetch("/api/feedback", { method: "OPTIONS", headers: { origin: "https://evil.example" } });
    expect(refused.status()).toBe(403);
  });

  test("refuses script URLs, other sites, the wrong content type and oversized bodies", async ({ request }) => {
    const send = (data: unknown, headers: Record<string, string> = {}) =>
      request.post("/api/feedback", { data, headers: { origin: E2E.allowedOrigin, "x-forwarded-for": freshIp(), ...headers } });

    const script = await send(feedbackBody({ pageUrl: "javascript:alert(document.cookie)" }));
    expect(script.status()).toBe(400);
    expect((await script.json()).error).toContain("http(s)");

    expect((await send(feedbackBody(), { origin: "https://evil.example" })).status()).toBe(403);
    expect((await send(JSON.stringify(feedbackBody()), { "content-type": "text/plain" })).status()).toBe(415);
    expect((await send(feedbackBody({ message: "x".repeat(20_000) }))).status()).toBe(413);
    expect((await send(feedbackBody({ rating: 9 }))).status()).toBe(400);
    expect((await sql`SELECT count(*)::int AS n FROM feedback`)[0].n).toBe(FEEDBACK_TOTAL);
  });

  test("limits each address to ten a minute", async ({ request }) => {
    const ip = freshIp();
    const send = () => request.post("/api/feedback", { data: feedbackBody(), headers: { origin: E2E.allowedOrigin, "x-forwarded-for": ip } });
    for (let index = 0; index < 10; index += 1) expect((await send()).status()).toBe(201);
    expect((await send()).status()).toBe(429);
  });
});

test.describe("public visit endpoint", () => {
  test("records a page view with its country but no IP, query string or full referrer", async ({ request }) => {
    const response = await request.post("/api/visit", {
      data: { app: "developer", path: "/json-formatter?input=secret", referrer: "https://www.google.com/search?q=private" },
      headers: { origin: E2E.allowedOrigin, "x-forwarded-for": "8.8.8.8", "user-agent": CHROME }
    });
    expect(response.status()).toBe(201);
    expect(response.headers()["set-cookie"]).toMatch(/uf_vid=[0-9a-f-]{36}; .*HttpOnly; Secure; SameSite=Lax/);
    const [row] = await sql`SELECT * FROM visits WHERE path LIKE '/json-formatter%' ORDER BY created_at DESC LIMIT 1`;
    expect(row).toMatchObject({ path: "/json-formatter", referrer: "google.com", country: "US" });
    expect(JSON.stringify(row)).not.toContain("8.8.8.8");
  });

  test("recognises a returning visitor by the cookie", async ({ request }) => {
    const send = (cookie?: string) => request.post("/api/visit", {
      data: { app: "images", path: "/returning" },
      headers: { origin: E2E.allowedOrigin, "x-forwarded-for": freshIp(), "user-agent": CHROME, ...(cookie ? { cookie } : {}) }
    });
    const first = await send();
    const id = /uf_vid=([^;]+)/.exec(first.headers()["set-cookie"])![1];
    await send(`uf_vid=${id}`);
    const rows = await sql`SELECT DISTINCT visitor_id FROM visits WHERE path = '/returning'`;
    expect(rows.map((row) => row.visitor_id)).toEqual([id]);
  });

  test("does not count crawlers", async ({ request }) => {
    const response = await request.post("/api/visit", {
      data: { app: "web", path: "/crawled" },
      headers: { origin: E2E.allowedOrigin, "x-forwarded-for": freshIp(), "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }
    });
    expect(response.status()).toBe(202);
    expect((await sql`SELECT count(*)::int AS n FROM visits WHERE path = '/crawled'`)[0].n).toBe(0);
  });
});

test.describe("overview", () => {
  test("shows the numbers the data holds, for the chosen period", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin?period=30");
    const card = (label: string) => page.locator(".stat-card").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
    await expect(card("Visits").locator(".stat-value")).toHaveText("25");
    await expect(card("Unique visitors").locator(".stat-value")).toHaveText("15");
    await expect(card("Feedback received").locator(".stat-value")).toHaveText(String(FEEDBACK_TOTAL));
    await expect(card("Awaiting review").locator(".stat-value")).toHaveText("17");
    await expect(page.locator(".panel-note").first()).toHaveText("UTC · 25 in total");

    await page.getByRole("link", { name: "7 days" }).click();
    await expect(page).toHaveURL(/period=7$/);
    await expect(card("Visits").locator(".stat-value")).toHaveText("20");
    const countries = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Top countries" }) });
    await expect(countries.locator("tbody tr").first()).toContainText("India");
    await expect(countries.locator("tbody tr").first()).toContainText("10");
  });

  test("the chart's numbers are available as a table", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin?period=7");
    await page.getByText("View as table").click();
    const rows = page.locator(".chart-table tbody tr");
    await expect(rows).toHaveCount(7);
    const counts = await rows.locator("td:last-child").allTextContents();
    expect(counts.map(Number).reduce((sum, value) => sum + value, 0)).toBe(20);
  });

  test("the sidebar counts what awaits review", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /Feedback/ }).locator(".nav-badge")).toContainText("17");
  });
});

test.describe("feedback inbox", () => {
  test("filters, searches and pages through feedback", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/feedback");
    await expect(page.locator(".result-count")).toHaveText(`Showing 1–25 of ${FEEDBACK_TOTAL}`);
    await page.getByRole("link", { name: "Older" }).click();
    await expect(page.locator(".result-count")).toHaveText(`Showing 26–30 of ${FEEDBACK_TOTAL}`);
    await expect(page.locator(".feedback-item")).toHaveCount(5);

    await page.goto("/admin/feedback");
    await page.getByLabel("App").selectOption("pdf");
    await expect(page.locator(".result-count")).toHaveText("Showing 1–1 of 1");
    await expect(page).toHaveURL(/app=pdf/);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.locator(".result-count")).toHaveText(`Showing 1–25 of ${FEEDBACK_TOTAL}`);

    await page.getByLabel("Type").selectOption("issue");
    await page.getByLabel("Rating").selectOption("2");
    await expect(page.locator(".feedback-item")).toHaveCount(1);
    await expect(page.locator(".feedback-item")).toContainText("Pasting a huge file freezes the tab");
    await expect(page).toHaveURL(/\?category=issue&rating=2$/);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.locator(".result-count")).toHaveText(`Showing 1–25 of ${FEEDBACK_TOTAL}`);

    await page.getByRole("searchbox", { name: "Search feedback" }).fill("zip download");
    await expect(page.locator(".result-count")).toHaveText("Showing 1–1 of 1");
    await expect(page.locator(".feedback-item")).toContainText("Image Compressor");

    await page.getByRole("searchbox", { name: "Search feedback" }).fill("nothing like this");
    await expect(page.locator(".result-count")).toHaveText("No feedback matches these filters.");
  });

  test("keeps every change made in quick succession, and follows links that change the URL", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/feedback");
    // Typed text still waiting on its debounce is carried by the next filter change.
    await page.getByRole("searchbox", { name: "Search feedback" }).fill("note 1");
    await page.getByLabel("Status").selectOption("new");
    await page.getByLabel("App").selectOption("developer");
    await expect(page).toHaveURL(/\?q=note\+1&app=developer&status=new$/);
    // "Regex note 1", "note 11", "note 13" … : the new ones among notes 1 and 10–19.
    await expect(page.locator(".result-count")).toHaveText("Showing 1–6 of 6");
    await expect(page.getByLabel("App")).toHaveValue("developer");

    await page.getByRole("link", { name: /Feedback/ }).click();
    await expect(page).toHaveURL(/\/admin\/feedback$/);
    await expect(page.getByRole("searchbox", { name: "Search feedback" })).toHaveValue("");
    await expect(page.getByLabel("App")).toHaveValue("");
    await expect(page.locator(".result-count")).toHaveText(`Showing 1–25 of ${FEEDBACK_TOTAL}`);
  });

  test("marks feedback reviewed and back, and the counts follow", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/feedback?q=freezes");
    const item = page.locator(".feedback-item");
    await expect(item.locator(".status-badge")).toHaveText("New");
    await item.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(item.locator(".status-badge")).toHaveText("Reviewed");
    await expect(page.locator(".nav-badge")).toContainText("16");
    await item.getByRole("button", { name: "Mark as new" }).click();
    await expect(item.locator(".status-badge")).toHaveText("New");
    await expect(page.locator(".nav-badge")).toContainText("17");
  });

  test("deletes only after a second confirmation", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/feedback?q=Lost+page+order");
    const item = page.locator(".feedback-item");
    await item.getByRole("button", { name: "Delete this feedback" }).click();
    await item.getByRole("button", { name: "Cancel" }).click();
    await expect(item).toHaveCount(1);
    await item.getByRole("button", { name: "Delete this feedback" }).click();
    await item.getByRole("button", { name: "Delete for good" }).click();
    await expect(page.locator(".result-count")).toHaveText("No feedback matches these filters.");
    expect((await sql`SELECT count(*)::int AS n FROM feedback`)[0].n).toBe(FEEDBACK_TOTAL - 1);
  });

  test("links only to the web page the feedback came from", async ({ page }) => {
    await sql`UPDATE feedback SET page_url = 'javascript:alert(1)' WHERE message = 'Lost page order'`;
    await signIn(page);
    await page.goto("/admin/feedback?q=Lost+page+order");
    const item = page.locator(".feedback-item");
    await expect(item.getByText("Page not recorded")).toBeVisible();
    await expect(item.locator("a[href^='javascript']")).toHaveCount(0);
    await page.goto("/admin/feedback?q=freezes");
    await expect(page.locator(".meta-link")).toHaveAttribute("href", "https://developer.utilfoundry.test/json");
    await expect(page.locator(".meta-link")).toHaveAttribute("rel", /noopener/);
  });

  test("exports the filtered list as CSV with formulas defused", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/feedback?app=developer&category=general&q=HYPERLINK");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^utilfoundry-feedback-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = readFileSync(await file.path(), "utf8").trim().split("\r\n");
    expect(lines[0]).toBe("Submitted (UTC),App,Tool,Category,Rating,Message,Page,Status,Browser,ID");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil.example"") in a message"`);
  });
});

test.describe("visitors", () => {
  test("breaks visits down by country, site, page, referrer, device and browser", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/visitors?period=7");
    const panel = (title: string) => page.locator(".panel").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(panel("Countries").locator("tbody tr")).toHaveCount(3);
    await expect(panel("Countries").locator("tbody tr").nth(1)).toContainText("United States");
    await expect(panel("Countries").locator("tbody tr").nth(1)).toContainText("1 unique");
    await expect(panel("Sites").locator("tbody tr").first()).toContainText("Developer tools");
    await expect(panel("Top pages").locator("tbody tr").first()).toContainText("/json-formatter");
    await expect(panel("Referrers").locator("tbody tr")).toHaveCount(2);
    await expect(panel("Devices")).toContainText("Desktop");
    await expect(panel("Browsers")).toContainText("Chrome");
    await page.getByRole("link", { name: "30 days" }).click();
    await expect(panel("Countries").locator("tbody tr")).toHaveCount(4);
  });

  test("an empty period says so instead of drawing an empty chart", async ({ page }) => {
    await reset();
    await signIn(page);
    await page.goto("/admin/visitors");
    await expect(page.getByText("No visits recorded in this period yet.")).toBeVisible();
    await expect(page.locator(".chart")).toHaveCount(0);
  });
});

test.describe("layout and accessibility", () => {
  test("the theme toggle switches and remembers", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin");
    const before = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: "Switch colour theme" }).click();
    const after = await page.locator("html").getAttribute("data-theme");
    expect(after).not.toBe(before);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", after!);
  });

  test("works on a phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    for (const path of ["/admin", "/admin/feedback", "/admin/visitors"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
    }
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
    await page.getByRole("link", { name: /Feedback/ }).click();
    await expect(page).toHaveURL(/\/admin\/feedback$/);
    await expect(page.locator(".sidebar")).not.toHaveClass(/is-open/);
  });

  test("no card or panel is left alone on a row beside empty space, at any common width", async ({ page }) => {
    await signIn(page);
    for (const width of [390, 820, 1280, 1480]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/admin", "/admin/visitors"]) {
        await page.goto(path);
        const ragged = await page.evaluate(() =>
          [...document.querySelectorAll(".stat-grid, .panel-grid")].flatMap((grid) => {
            const right = grid.getBoundingClientRect().right;
            const rows = new Map<number, number>();
            for (const child of grid.children) {
              const box = child.getBoundingClientRect();
              rows.set(Math.round(box.top), Math.max(rows.get(Math.round(box.top)) ?? 0, box.right));
            }
            return [...rows.values()].filter((edge) => right - edge > 2).map(() => grid.className);
          })
        );
        expect(ragged, `${path} at ${width}px`).toEqual([]);
      }
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`every page passes an accessibility scan (${theme})`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("uf-admin-theme", value), theme);
      await page.goto("/admin/login");
      expect((await new AxeBuilder({ page }).analyze()).violations, "login").toEqual([]);
      await signIn(page);
      for (const path of ["/admin", "/admin/feedback", "/admin/visitors"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations, path).toEqual([]);
      }
    });
  }
});
