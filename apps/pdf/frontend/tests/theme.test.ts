import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_COOKIE,
  getAppliedTheme,
  isThemeId,
  setThemeCookie,
} from "../lib/theme";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  // Expire anything a previous test wrote.
  document.cookie = `${THEME_COOKIE}=;path=/;max-age=0`;
});

describe("theme catalog", () => {
  it("offers four themes with unique ids", () => {
    expect(THEMES).toHaveLength(4);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(4);
  });

  it("gives every theme a label and a two-colour swatch", () => {
    for (const theme of THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.swatch).toHaveLength(2);
      for (const colour of theme.swatch) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("defaults to a theme that exists", () => {
    expect(THEMES.some((theme) => theme.id === DEFAULT_THEME)).toBe(true);
  });
});

describe("isThemeId", () => {
  it("accepts every id in the catalog", () => {
    for (const theme of THEMES) expect(isThemeId(theme.id)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isThemeId("neon")).toBe(false);
    expect(isThemeId("")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });
});

describe("getAppliedTheme", () => {
  it("falls back to the default when the root carries no theme", () => {
    expect(getAppliedTheme()).toBe(DEFAULT_THEME);
  });

  it("reads a theme the init script applied", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme.id);
      expect(getAppliedTheme()).toBe(theme.id);
    }
  });

  it("falls back when the attribute holds something unknown", () => {
    document.documentElement.setAttribute("data-theme", "neon");
    expect(getAppliedTheme()).toBe(DEFAULT_THEME);
  });
});

describe("setThemeCookie", () => {
  it("writes the chosen theme under the shared cookie name", () => {
    setThemeCookie("ocean");
    expect(document.cookie).toContain(`${THEME_COOKIE}=ocean`);
  });

  it("replaces a previously chosen theme", () => {
    setThemeCookie("dark");
    setThemeCookie("sepia");
    expect(document.cookie).toContain(`${THEME_COOKIE}=sepia`);
    expect(document.cookie).not.toContain(`${THEME_COOKIE}=dark`);
  });
});
