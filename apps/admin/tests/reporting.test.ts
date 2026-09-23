import { describe, expect, it } from "vitest";
import { dayLabel, utcTimestamp } from "../lib/dates";
import { feedbackFiltersFrom, pageFrom } from "../lib/filters";
import { countryFlag, countryName, describeBrowser, share } from "../lib/format";
import { fillDays, parsePeriod, percentChange } from "../lib/period";
import { windowFor } from "../lib/queries";

describe("reporting periods", () => {
  it("accepts only the offered periods", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod(["90"])).toBe(90);
    expect(parsePeriod("365")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
  });

  it("uses whole UTC days, with an equal window before it for the trend", () => {
    const window = windowFor(7, Date.UTC(2026, 8, 23, 15, 30));
    expect(window.start.toISOString()).toBe("2026-09-17T00:00:00.000Z");
    expect(window.previousStart.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(window.chartStart).toEqual(window.start);
  });

  it("fills days without visits with zero, oldest first", () => {
    const days = fillDays([{ day: "2026-09-22", count: 4 }], 3, new Date(Date.UTC(2026, 8, 23, 12)));
    expect(days).toEqual([{ day: "2026-09-21", count: 0 }, { day: "2026-09-22", count: 4 }, { day: "2026-09-23", count: 0 }]);
  });

  it("reports change only when there is something to compare with", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("inbox filters from the URL", () => {
  it("keeps valid filters and drops the rest", () => {
    expect(feedbackFiltersFrom({ app: "pdf", category: "issue", status: "new", rating: "2", q: "  crash " })).toEqual({
      app: "pdf", category: "issue", status: "new", rating: 2, q: "crash"
    });
    expect(feedbackFiltersFrom({ app: "evil", category: "x", status: "done", rating: "9", q: "" })).toEqual({
      app: undefined, category: undefined, status: undefined, rating: undefined, q: undefined
    });
  });

  it("bounds the search text and the page number", () => {
    expect(feedbackFiltersFrom({ q: "x".repeat(500) }).q).toHaveLength(100);
    expect(pageFrom({ page: "3" })).toBe(3);
    expect(pageFrom({ page: "-1" })).toBe(1);
    expect(pageFrom({ page: "abc" })).toBe(1);
  });
});

describe("display helpers", () => {
  it("names countries and draws their flags", () => {
    expect(countryName("IN")).toBe("India");
    expect(countryName("gb")).toBe("United Kingdom");
    expect(countryFlag("IN")).toBe("🇮🇳");
    expect(countryFlag("??")).toBe("🏳️");
  });

  it("summarises a user agent", () => {
    expect(describeBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1")).toBe("Safari on iOS");
    expect(describeBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0")).toBe("Edge on Windows");
    expect(describeBrowser(null)).toBe("Unknown browser");
  });

  it("formats shares", () => {
    expect(share(1, 3)).toBe("33%");
    expect(share(1, 0)).toBe("0%");
  });
});

describe("dates rendered on both server and client", () => {
  it("formats days and timestamps the same way in every runtime, without Intl", () => {
    expect(dayLabel("2026-09-23")).toBe("23 Sep");
    expect(dayLabel("2026-09-23", true)).toBe("Wed 23 Sep");
    expect(dayLabel("2026-01-04", true)).toBe("Sun 4 Jan");
    expect(utcTimestamp("2026-09-23T04:05:00.000Z")).toBe("23 Sep 2026, 04:05 UTC");
    // A time just before midnight UTC stays on its UTC day, whatever the machine's timezone.
    expect(utcTimestamp("2026-12-31T23:59:59.000Z")).toBe("31 Dec 2026, 23:59 UTC");
  });
});
