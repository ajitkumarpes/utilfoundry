import { describe, expect, it } from "vitest";
import { cleanPath, cleanText, isBot, isUuid, referrerHost, safeHttpUrl, validateFeedback, validateVisit } from "../lib/validation";

const feedback = (overrides: Record<string, unknown> = {}) => ({
  app: "developer",
  category: "issue",
  pageUrl: "https://dev.utilfoundry.com/json-formatter",
  ...overrides
});

describe("feedback validation", () => {
  it("accepts what the widget sends", () => {
    const result = validateFeedback(feedback({ toolId: "json", toolName: "JSON Formatter", rating: 4, message: "Works" }));
    expect(result).toEqual({
      ok: true,
      value: { app: "developer", category: "issue", toolId: "json", toolName: "JSON Formatter", rating: 4, message: "Works", pageUrl: "https://dev.utilfoundry.com/json-formatter" }
    });
  });

  it("accepts a bare category, such as a thank-you with nothing else", () => {
    expect(validateFeedback(feedback({ category: "thanks" })).ok).toBe(true);
  });

  it("refuses page URLs that would run script when clicked in the dashboard", () => {
    for (const pageUrl of ["javascript:alert(document.cookie)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "/relative", ""]) {
      expect(validateFeedback(feedback({ pageUrl })).ok, pageUrl).toBe(false);
    }
  });

  it("refuses unknown apps, categories and out-of-range ratings", () => {
    expect(validateFeedback(feedback({ app: "other" })).ok).toBe(false);
    expect(validateFeedback(feedback({ category: "spam" })).ok).toBe(false);
    for (const rating of [0, 6, 2.5, "5"]) expect(validateFeedback(feedback({ rating })).ok).toBe(false);
  });

  it("refuses messages over 500 characters and tool ids that are not ids", () => {
    expect(validateFeedback(feedback({ message: "x".repeat(501) })).ok).toBe(false);
    expect(validateFeedback(feedback({ message: "x".repeat(500) })).ok).toBe(true);
    expect(validateFeedback(feedback({ toolId: "<script>" })).ok).toBe(false);
  });

  it("refuses bodies that are not objects", () => {
    for (const body of [null, "text", 42, [feedback()]]) expect(validateFeedback(body).ok).toBe(false);
  });
});

describe("text and URL cleaning", () => {
  it("strips control characters but keeps line breaks", () => {
    expect(cleanText("  line one\u0000\u0007\nline two\t ", 100)).toBe("line one\nline two");
    expect(cleanText("   ", 100)).toBeNull();
    expect(cleanText(5, 100)).toBeUndefined();
  });

  it("keeps only http and https", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHttpUrl("ftp://example.com")).toBeNull();
    expect(safeHttpUrl("https://" + "a".repeat(3000))).toBeNull();
  });

  it("reduces a referrer to its host", () => {
    expect(referrerHost("https://www.google.com/search?q=my+email@example.com")).toBe("google.com");
    expect(referrerHost("android-app://com.slack")).toBeNull();
    expect(referrerHost(undefined)).toBeNull();
  });

  it("drops query strings and fragments from paths", () => {
    expect(cleanPath("/reset?token=secret#x")).toBe("/reset");
    expect(cleanPath("json-formatter")).toBeNull();
    expect(cleanPath("/?q=1")).toBe("/");
  });
});

describe("visit validation", () => {
  it("accepts a beacon and keeps only what is needed", () => {
    expect(validateVisit({ app: "images", path: "/resize?w=10", referrer: "https://github.com/x/y" })).toEqual({
      ok: true,
      value: { app: "images", path: "/resize", referrerHost: "github.com" }
    });
  });

  it("refuses a missing path or a non-string referrer", () => {
    expect(validateVisit({ app: "images" }).ok).toBe(false);
    expect(validateVisit({ app: "images", path: "/", referrer: 5 }).ok).toBe(false);
  });
});

describe("bots and ids", () => {
  it("tells crawlers and scripts from browsers", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")).toBe(false);
  });

  it("recognises UUIDs", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("3f2504e0")).toBe(false);
    expect(isUuid("'; DROP TABLE feedback; --")).toBe(false);
  });
});
