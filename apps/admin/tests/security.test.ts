import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "../lib/csrf";
import { toCsv } from "../lib/csv";
import { checkEnv, visitRetentionDays } from "../lib/env";
import { HttpError, readJsonBody } from "../lib/http";

const post = (headers: Record<string, string>) => new Request("https://admin.utilfoundry.com/api/admin/feedback/x", { method: "POST", headers });

describe("same-origin check for admin API calls", () => {
  it("lets same-origin requests through", () => {
    expect(isSameOriginRequest(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(post({ origin: "https://admin.utilfoundry.com", host: "admin.utilfoundry.com" }))).toBe(true);
  });

  it("refuses cross-site and same-site-but-other-origin requests", () => {
    expect(isSameOriginRequest(post({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(post({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginRequest(post({ origin: "https://evil.example", host: "admin.utilfoundry.com" }))).toBe(false);
  });

  it("refuses a state-changing request with no origin information at all", () => {
    expect(isSameOriginRequest(post({}))).toBe(false);
  });

  it("does not interfere with reads", () => {
    expect(isSameOriginRequest(new Request("https://admin.utilfoundry.com/api/admin/feedback/export"))).toBe(true);
  });
});

describe("request body limit", () => {
  const request = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/feedback", { method: "POST", body, headers });

  it("parses a small JSON body", async () => {
    expect(await readJsonBody(request('{"a":1}'))).toEqual({ a: 1 });
  });

  it("refuses a body that declares itself too large", async () => {
    await expect(readJsonBody(request("{}", { "content-length": "999999" }), 100)).rejects.toMatchObject({ status: 413 });
  });

  it("refuses a body that turns out too large while streaming", async () => {
    await expect(readJsonBody(request(JSON.stringify({ a: "x".repeat(500) })), 100)).rejects.toBeInstanceOf(HttpError);
  });

  it("refuses what is not JSON", async () => {
    await expect(readJsonBody(request("not json"))).rejects.toMatchObject({ status: 400 });
  });
});

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line\nbreak", null]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",\r\n');
  });

  it("defuses spreadsheet formulas written by the public", () => {
    const csv = toCsv(["message"], [["=HYPERLINK(\"http://evil\")"], ["+1"], ["-2"], ["@SUM(A1)"], ["plain"]]);
    expect(csv).toBe("message\r\n\"'=HYPERLINK(\"\"http://evil\"\")\"\r\n'+1\r\n'-2\r\n'@SUM(A1)\r\nplain\r\n");
  });

  it("writes dates as ISO 8601", () => {
    expect(toCsv(["at"], [[new Date("2026-01-02T03:04:05Z")]])).toContain("2026-01-02T03:04:05.000Z");
  });
});

describe("configuration check", () => {
  const good = {
    DATABASE_URL: "postgres://u:p@db:5432/admin",
    ADMIN_PASSWORD: "a-long-enough-password",
    ADMIN_SESSION_SECRET: "f".repeat(64),
    CORS_ALLOWED_ORIGINS: "https://utilfoundry.com,https://dev.utilfoundry.com"
  };

  it("passes a complete production configuration", () => {
    expect(checkEnv(good, true)).toEqual([]);
  });

  it("refuses placeholders and short secrets in production", () => {
    const names = (env: Record<string, string>) => checkEnv({ ...good, ...env }, true).map((problem) => problem.name);
    expect(names({ ADMIN_PASSWORD: "replace-with-a-long-random-secret" })).toContain("ADMIN_PASSWORD");
    expect(names({ ADMIN_PASSWORD: "short" })).toContain("ADMIN_PASSWORD");
    expect(names({ ADMIN_SESSION_SECRET: "too-short" })).toContain("ADMIN_SESSION_SECRET");
    expect(names({ ADMIN_SESSION_SECRET: good.ADMIN_PASSWORD.padEnd(40, "x"), ADMIN_PASSWORD: good.ADMIN_PASSWORD.padEnd(40, "x") })).toContain("ADMIN_SESSION_SECRET");
    expect(names({ CORS_ALLOWED_ORIGINS: "" })).toContain("CORS_ALLOWED_ORIGINS");
    expect(names({ CORS_ALLOWED_ORIGINS: "http://dev.utilfoundry.com" })).toContain("CORS_ALLOWED_ORIGINS");
    expect(names({ DATABASE_URL: "mysql://x" })).toContain("DATABASE_URL");
    expect(names({ VISIT_RETENTION_DAYS: "soon" })).toContain("VISIT_RETENTION_DAYS");
  });

  it("allows localhost origins, so a production build can be tried on one machine", () => {
    expect(checkEnv({ ...good, CORS_ALLOWED_ORIGINS: "http://localhost:3020" }, true)).toEqual([]);
  });

  it("only requires the essentials in development", () => {
    expect(checkEnv({ DATABASE_URL: good.DATABASE_URL, ADMIN_PASSWORD: "x", ADMIN_SESSION_SECRET: "y" }, false)).toEqual([]);
    expect(checkEnv({}, false).map((problem) => problem.name)).toEqual(["DATABASE_URL", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"]);
  });

  it("keeps visits about thirteen months unless told otherwise", () => {
    expect(visitRetentionDays({})).toBe(395);
    expect(visitRetentionDays({ VISIT_RETENTION_DAYS: "90" })).toBe(90);
    expect(visitRetentionDays({ VISIT_RETENTION_DAYS: "-1" })).toBe(395);
  });
});
