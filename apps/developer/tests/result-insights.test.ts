import { describe, expect, it } from "vitest";
import { tokenizeDiff } from "../lib/highlight";
import { insightsFor, relativeTime } from "../lib/result-insights";
import { runTool } from "../lib/run-tool";
import { STARTERS, defaultOption } from "../lib/samples";
import { joinDocuments, splitDocuments, splitInputFor } from "../lib/split-input";
import { outputViews } from "../lib/tool-options";
import { TOOLS } from "../lib/tools";

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);
const value = (list: ReturnType<typeof insightsFor>, label: string) => list.find((item) => item.label === label);

describe("two-document input", () => {
  it("round-trips each tool's example through its two editors", () => {
    for (const id of ["diff", "json-diff", "json-schema", "openapi-diff", "jwt-rsa"]) {
      expect(splitInputFor(id), id).not.toBeNull();
      const [first, second] = splitDocuments(STARTERS[id]);
      expect(first, id).not.toBe("");
      expect(second, id).not.toBe("");
      expect(joinDocuments(first, second), id).toBe(STARTERS[id].replace(/\r\n/g, "\n"));
    }
  });

  it("splits on the first separator, as the tool handlers do", () => {
    expect(splitDocuments("a\n---\nb\n---\nc")).toEqual(["a", "b\n---\nc"]);
    expect(splitDocuments("only one")).toEqual(["only one", ""]);
  });

  it("treats two empty editors as no input rather than a lone separator", () => {
    expect(joinDocuments("", "")).toBe("");
    expect(joinDocuments("a", "")).toBe("a\n---\n");
  });

  it("leaves single-document tools alone", () => {
    expect(splitInputFor("json")).toBeNull();
  });
});

describe("result details", () => {
  it("reads a token's expiry relative to now, and flags one that has passed", () => {
    const decoded = (exp: number) => JSON.stringify({ header: { alg: "HS256" }, payload: { sub: "42", exp } });
    const future = insightsFor("jwt", "", "", decoded(NOW / 1000 + 3 * 86400), NOW);
    expect(value(future, "Expires")).toMatchObject({ value: "in 3 days", tone: "good" });
    const past = insightsFor("jwt", "", "", decoded(NOW / 1000 - 2 * 3600), NOW);
    expect(value(past, "Expires")).toMatchObject({ value: "2 hours ago", tone: "bad" });
    expect(value(past, "Subject")?.value).toBe("42");
  });

  it("warns about an unsigned token and one that never expires", () => {
    const list = insightsFor("jwt", "", "", JSON.stringify({ header: { alg: "none" }, payload: { sub: "x" } }), NOW);
    expect(value(list, "Algorithm")).toMatchObject({ value: "none", tone: "warn" });
    expect(value(list, "Expires")?.tone).toBe("warn");
  });

  it("decodes a signed token's own claims", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInJvbGUiOiJhZG1pbiJ9.VJC0w9_pXIl5W2vaeUwcHZAhSYahCMSeONYyK4n5Sn4";
    const list = insightsFor("jwt-sign", "sign", "", token, NOW);
    expect(value(list, "Algorithm")?.value).toBe("HS256");
    expect(value(list, "Subject")?.value).toBe("42");
  });

  it("rates a generated password by its real alphabet", () => {
    const list = insightsFor("password", "24", "", "a".repeat(24), NOW);
    // 67 symbols: 24 × log2(67) ≈ 145.6 bits.
    expect(value(list, "Entropy")?.value).toBe("≈ 146 bits");
    expect(value(list, "Strength")).toMatchObject({ value: "Very strong", tone: "good", meter: 1 });
    expect(value(insightsFor("password", "8", "", "a".repeat(8), NOW), "Strength")?.tone).toBe("bad");
  });

  it("reads a UUID's version and variant", () => {
    const list = insightsFor("uuid", "", "", "062ffa87-f188-48d0-9aa5-16e86650d810", NOW);
    expect(value(list, "Version")?.value).toBe("v4 (random)");
    expect(value(list, "Variant")?.value).toBe("RFC 9562");
  });

  it("gives a colour a swatch of itself", () => {
    const list = insightsFor("color", "", "", JSON.stringify({ hex: "#4263EB", rgb: "rgb(66, 99, 235)", hsl: "hsl(228, 81%, 59%)" }), NOW);
    expect(value(list, "Colour")).toMatchObject({ value: "#4263EB", swatch: "#4263EB" });
  });

  it("knows an expired card from a current one", () => {
    const track = (expiryYYMM: string) => JSON.stringify({ pan: "411111••••••1111", expiryYYMM, serviceCode: "201" });
    expect(value(insightsFor("track2", "", "", track("2512"), NOW), "Expiry")).toMatchObject({ value: "12/2025", tone: "bad" });
    expect(value(insightsFor("track2", "", "", track("2609"), NOW), "Expiry")?.tone).toBe("good");
  });

  it("counts what a diff added and removed", () => {
    const list = insightsFor("diff", "", "", "-a\n+b\n+c\n d", NOW);
    expect(value(list, "Added")?.value).toBe("2");
    expect(value(list, "Removed")?.value).toBe("1");
  });

  it("classifies a status code", () => {
    expect(value(insightsFor("status", "", "404", "Not Found", NOW), "Class")).toMatchObject({ value: "4xx · Client error", tone: "warn" });
  });

  it("describes every tool's own example without throwing", async () => {
    for (const tool of TOOLS) {
      const option = defaultOption(tool.id);
      const input = STARTERS[tool.id] ?? "";
      const output = await runTool(tool.id, { input, option, pattern: "\\b[A-Z][a-z]+\\b", flags: "g", secret: "change-me-locally" });
      const list = insightsFor(tool.id, option, input, output, NOW);
      for (const item of list) {
        expect(item.value, `${tool.id} ${item.label}`).not.toMatch(/undefined|NaN|\[object Object\]/);
      }
    }
  });
});

describe("relative times", () => {
  it("uses the largest whole unit", () => {
    expect(relativeTime(NOW + 90_000, NOW)).toBe("in 2 minutes");
    expect(relativeTime(NOW - 86_400_000, NOW)).toBe("yesterday");
    expect(relativeTime(NOW + 400 * 86_400_000, NOW)).toBe("next year");
    expect(relativeTime(NOW, NOW)).toBe("now");
  });
});

describe("output views", () => {
  it("offers a tree for JSON documents and nothing for plain text", () => {
    expect(outputViews("json", '{"a":1}')).toEqual(["code", "tree"]);
    expect(outputViews("hash", "abc123")).toEqual([]);
    expect(outputViews("json", "")).toEqual([]);
  });

  it("shows Markdown rendered first, and an image as itself", () => {
    expect(outputViews("markdown", "<p>x</p>")).toEqual(["preview", "code"]);
    expect(outputViews("qr", "data:image/png;base64,AAAA")).toEqual([]);
    expect(outputViews("image-base64", "data:image/png;base64,AAAA")).toEqual(["code", "preview"]);
  });
});

describe("diff colouring", () => {
  it("gives back every character exactly once, in order", () => {
    const source = "-before\n+after\n same\n";
    expect(tokenizeDiff(source).map((token) => token.text).join("")).toBe(source);
    expect(tokenizeDiff(source).map((token) => token.type)).toEqual(["removed", "added", "plain"]);
  });
});
