import { randomInt, randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../playwright.config";

export const sql = postgres(E2E.databaseUrl, { max: 2, onnotice: () => {} });
/** The dashboard's own origin for the running project (WebKit goes through https). */
export const base = () => test.info().project.use.baseURL!;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * A different "client address" per call, so per-address rate limits never leak between tests.
 * Playwright restarts the worker after a failure, which resets module state, so the addresses
 * start from a random block rather than a fixed counter the server has already seen.
 */
let ipCounter = randomInt(0, 1 << 24);
export const freshIp = () => {
  const n = ipCounter++ & 0xffffff;
  return `10.${n >> 16}.${(n >> 8) & 255}.${n & 255}`;
};

export async function reset() {
  await sql`TRUNCATE feedback, visits`;
}

export const FEEDBACK_TOTAL = 30;

/** A small, fully known data set, so every number on screen can be checked exactly. */
export async function seed() {
  const now = Date.now();
  const base = { user_agent: CHROME_MAC };
  const feedback = [
    { app: "developer", tool_id: "json", tool_name: "JSON Formatter", category: "issue", rating: 2, message: "Pasting a huge file freezes the tab", status: "new", ago: 1 * HOUR },
    { app: "images", tool_id: "image-compressor", tool_name: "Image Compressor", category: "feature_request", rating: 4, message: "Batch ZIP download please", status: "new", ago: 2 * HOUR },
    { app: "pdf", tool_id: null, tool_name: "Merge PDF", category: "issue", rating: 1, message: "Lost page order", status: "reviewed", ago: 3 * HOUR },
    { app: "web", tool_id: null, tool_name: null, category: "thanks", rating: 5, message: null, status: "new", ago: 4 * HOUR },
    { app: "developer", tool_id: "base64", tool_name: "Base64 Encoder", category: "general", rating: 4, message: '=HYPERLINK("http://evil.example") in a message', status: "new", ago: 5 * HOUR },
    ...Array.from({ length: FEEDBACK_TOTAL - 5 }, (_, index) => ({
      app: "developer", tool_id: "regex", tool_name: "Regex Tester", category: "general", rating: 3,
      message: `Regex note ${index + 1}`, status: index % 2 ? "reviewed" : "new", ago: (index + 1) * 12 * HOUR
    }))
  ].map(({ ago, ...row }) => ({
    id: randomUUID(), ...base, ...row, page_url: `https://${row.app}.utilfoundry.test/${row.tool_id ?? ""}`, created_at: new Date(now - ago)
  }));
  await sql`INSERT INTO feedback ${sql(feedback)}`;

  const visitor = () => randomUUID();
  const [asha, lee] = [visitor(), visitor()];
  const visits = [
    ...Array.from({ length: 10 }, (_, index) => ({ country: "IN", visitor_id: index < 6 ? asha : visitor(), path: "/json-formatter", app: "developer", referrer: null })),
    ...Array.from({ length: 6 }, () => ({ country: "US", visitor_id: lee, path: "/image-compressor", app: "images", referrer: "github.com" })),
    ...Array.from({ length: 4 }, () => ({ country: "GB", visitor_id: visitor(), path: "/tools/merge-pdf", app: "pdf", referrer: "google.com" }))
  ].map((row, index) => ({ id: randomUUID(), region: null, city: null, user_agent: CHROME_MAC, ...row, created_at: new Date(now - (index % 3) * HOUR) }));
  // Older visits: inside the 30-day window but outside the 7-day one.
  const older = Array.from({ length: 5 }, () => ({
    id: randomUUID(), app: "web", path: "/", visitor_id: visitor(), country: "DE", region: null, city: null, referrer: null, user_agent: CHROME_MAC,
    created_at: new Date(now - 20 * DAY)
  }));
  await sql`INSERT INTO visits ${sql([...visits, ...older])}`;
}

/** Signs in through the real endpoint; the cookie lands in the page's browser context. */
export async function signIn(page: Page) {
  const response = await page.context().request.post("/api/admin/login", {
    data: { password: E2E.password },
    headers: { origin: base(), "x-forwarded-for": freshIp() }
  });
  expect(response.status(), await response.text()).toBe(200);
}
