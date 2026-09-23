/**
 * Runs the real queries against a real Postgres. Skipped unless TEST_DATABASE_URL points at
 * a database this suite may wipe (CI provides one; locally: see README, "Tests").
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const TEST_URL = process.env.TEST_DATABASE_URL;
const DAY = 86_400_000;

describe.skipIf(!TEST_URL)("database", () => {
  let queries: typeof import("../lib/queries");
  let sql: import("postgres").Sql;

  const migrate = () => run("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: TEST_URL } });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    const { db } = await import("../lib/db");
    sql = db();
    await sql.unsafe("DROP TABLE IF EXISTS feedback, visits, schema_migrations");
    // Two instances starting at once: the advisory lock must make this safe.
    await Promise.all([migrate(), migrate()]);
    queries = await import("../lib/queries");
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
  });

  beforeEach(async () => {
    await sql`TRUNCATE feedback, visits`;
  });

  const feedback = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: randomUUID(), app: "developer", tool_id: "json", tool_name: "JSON Formatter", category: "issue", rating: 3,
    message: "Something broke", page_url: "https://dev.utilfoundry.com/json-formatter", user_agent: "Mozilla/5.0 Chrome/140",
    status: "new", created_at: new Date(), ...overrides
  });

  const visit = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: randomUUID(), app: "developer", path: "/json-formatter", visitor_id: randomUUID(), country: "IN", region: null,
    city: null, referrer: null, user_agent: "Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36", created_at: new Date(), ...overrides
  });

  it("applied every migration exactly once, even with two runners at once", async () => {
    const rows = await sql`SELECT filename FROM schema_migrations ORDER BY filename`;
    expect(rows.map((row) => row.filename)).toEqual(["001_init.sql", "002_indexes_and_privacy.sql"]);
    await migrate();
    expect((await sql`SELECT count(*)::int AS n FROM schema_migrations`)[0].n).toBe(2);
  });

  it("stores feedback and lists it newest first with a total", async () => {
    await queries.insertFeedback(randomUUID(), { app: "pdf", category: "thanks", toolId: null, toolName: null, rating: 5, message: null, pageUrl: "https://pdf.utilfoundry.com/" }, "UA");
    await sql`INSERT INTO feedback ${sql(feedback({ created_at: new Date(Date.now() - DAY) }))}`;
    const { rows, total, pages } = await queries.listFeedback({});
    expect(total).toBe(2);
    expect(pages).toBe(1);
    expect(rows.map((row) => row.app)).toEqual(["pdf", "developer"]);
  });

  it("filters, searches and pages the inbox", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => feedback({
      app: index % 2 ? "images" : "developer",
      status: index < 5 ? "reviewed" : "new",
      rating: (index % 5) + 1,
      message: index === 7 ? "100% of my uploads fail_now" : `message ${index}`,
      created_at: new Date(Date.now() - index * 60_000)
    }));
    await sql`INSERT INTO feedback ${sql(rows)}`;

    expect((await queries.listFeedback({ app: "images" })).total).toBe(15);
    expect((await queries.listFeedback({ status: "reviewed" })).total).toBe(5);
    expect((await queries.listFeedback({ rating: 5 })).total).toBe(6);
    // % and _ are searched for literally, not as wildcards.
    expect((await queries.listFeedback({ q: "100%" })).total).toBe(1);
    expect((await queries.listFeedback({ q: "fail_now" })).total).toBe(1);
    expect((await queries.listFeedback({ q: "l_now" })).total).toBe(1);
    expect((await queries.listFeedback({ q: "_" })).total).toBe(1);

    const first = await queries.listFeedback({}, 1);
    const second = await queries.listFeedback({}, 2);
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(5);
    expect(first.pages).toBe(2);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(30);
  });

  it("changes status, deletes, and counts what awaits review", async () => {
    const item = feedback();
    await sql`INSERT INTO feedback ${sql([item, feedback()])}`;
    expect(await queries.countUnreviewed()).toBe(2);
    expect(await queries.setFeedbackStatus(item.id as string, "reviewed")).toBe(true);
    expect(await queries.countUnreviewed()).toBe(1);
    expect(await queries.deleteFeedback(item.id as string)).toBe(true);
    expect(await queries.deleteFeedback(item.id as string)).toBe(false);
    expect(await queries.setFeedbackStatus(randomUUID(), "new")).toBe(false);
  });

  it("exports what the filters match", async () => {
    await sql`INSERT INTO feedback ${sql([feedback({ app: "pdf" }), feedback({ app: "web" }), feedback({ app: "pdf" })])}`;
    expect(await queries.exportFeedback({ app: "pdf" })).toHaveLength(2);
    expect(await queries.exportFeedback({}, 1)).toHaveLength(1);
  });

  it("counts visits, uniques and trends over whole UTC days", async () => {
    const window = queries.windowFor(7);
    const regular = randomUUID();
    const inWindow = (hoursAfterStart: number) => new Date(window.start.getTime() + hoursAfterStart * 3_600_000);
    await sql`INSERT INTO visits ${sql([
      visit({ visitor_id: regular, created_at: inWindow(1) }),
      visit({ visitor_id: regular, created_at: inWindow(30), country: "US", referrer: "github.com", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5) Mobile Safari/604.1" }),
      visit({ created_at: inWindow(50), country: "US", app: "pdf", path: "/tools/merge-pdf", user_agent: "Mozilla/5.0 (Windows NT 10.0) Firefox/142.0" }),
      visit({ created_at: new Date(window.start.getTime() - 3_600_000) }),
      visit({ created_at: new Date(window.previousStart.getTime() - 3_600_000) })
    ])}`;

    const stats = await queries.getVisitorStats(7);
    expect(stats.totals).toEqual({ visits: 3, visitors: 2, prev_visits: 1, prev_visitors: 1 });
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.reduce((sum, day) => sum + day.count, 0)).toBe(3);
    expect(stats.daily.filter((day) => day.count === 0).length).toBeGreaterThanOrEqual(4);
    expect(stats.countries).toEqual([{ country: "US", count: 2, visitors: 2 }, { country: "IN", count: 1, visitors: 1 }]);
    expect(stats.referrers).toEqual([{ host: "github.com", count: 1 }]);
    expect(Object.fromEntries(stats.devices.map((row) => [row.device, row.count]))).toEqual({ Desktop: 2, Mobile: 1 });
    expect(Object.fromEntries(stats.browsers.map((row) => [row.browser, row.count]))).toEqual({ Chrome: 1, Safari: 1, Firefox: 1 });
    expect(stats.pages[0]).toEqual({ app: "developer", path: "/json-formatter", count: 2 });

    const overview = await queries.getOverview(7);
    expect(overview.visits.visits).toBe(overview.daily.reduce((sum, day) => sum + day.count, 0));
  });

  it("summarises feedback for the overview", async () => {
    await sql`INSERT INTO feedback ${sql([
      feedback({ rating: 5, category: "thanks" }),
      feedback({ rating: 2 }),
      feedback({ rating: null, tool_name: null, status: "reviewed" }),
      feedback({ rating: 1, created_at: new Date(Date.now() - 10 * DAY) })
    ])}`;
    const overview = await queries.getOverview(7);
    expect(overview.feedback).toEqual({ received: 3, prev_received: 1, rating: 3.5, prev_rating: 1 });
    expect(overview.unreviewed).toBe(3);
    expect(overview.categories).toEqual([{ category: "issue", count: 2 }, { category: "thanks", count: 1 }]);
    expect(overview.tools).toEqual([{ app: "developer", tool_name: "JSON Formatter", count: 2, rating: 3.5 }]);
    expect(overview.recent).toHaveLength(4);
  });

  it("purges only visits older than the retention window", async () => {
    await sql`INSERT INTO visits ${sql([visit({ created_at: new Date(Date.now() - 40 * DAY) }), visit({ created_at: new Date(Date.now() - 5 * DAY) })])}`;
    expect(await queries.purgeOldVisits(30)).toBe(1);
    expect((await sql`SELECT count(*)::int AS n FROM visits`)[0].n).toBe(1);
  });

  it("scrubs referrer URLs and query strings recorded before the privacy migration", async () => {
    await sql`INSERT INTO visits ${sql([
      visit({ referrer: "https://www.google.com/search?q=someone%40example.com", path: "/reset?token=abc#top" }),
      visit({ referrer: "android-app://com.slack/", path: "/plain" })
    ])}`;
    await sql.unsafe(readFileSync("db/migrations/002_indexes_and_privacy.sql", "utf8"));
    const rows = await sql`SELECT referrer, path FROM visits ORDER BY path`;
    expect(rows).toEqual([{ referrer: null, path: "/plain" }, { referrer: "google.com", path: "/reset" }]);
  });

  it("answers the health check", async () => {
    await expect(queries.ping()).resolves.toBeUndefined();
  });
});
