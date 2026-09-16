import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_TOOLS,
  TOOL_COUNT,
  TOOL_GROUPS,
  TOOL_ROUTES,
  searchTools,
} from "../lib/tools";

describe("tool catalog", () => {
  it("flattens every group into the searchable list", () => {
    const fromGroups = TOOL_GROUPS.reduce((total, group) => total + group.tools.length, 0);
    expect(ALL_TOOLS).toHaveLength(fromGroups);
    expect(TOOL_COUNT).toBe(fromGroups);
    expect(TOOL_ROUTES).toHaveLength(fromGroups);
  });

  it("carries the group identity onto each tool", () => {
    for (const group of TOOL_GROUPS) {
      for (const tool of group.tools) {
        const flattened = ALL_TOOLS.find((item) => item.href === tool.href);
        expect(flattened, `${tool.href} should appear in ALL_TOOLS`).toBeDefined();
        expect(flattened?.groupId).toBe(group.id);
        expect(flattened?.groupTitle).toBe(group.title);
        expect(flattened?.color).toBe(group.color);
      }
    }
  });

  it("has no duplicate routes, names or group ids", () => {
    expect(new Set(TOOL_ROUTES).size).toBe(TOOL_ROUTES.length);
    expect(new Set(ALL_TOOLS.map((tool) => tool.name)).size).toBe(ALL_TOOLS.length);
    expect(new Set(TOOL_GROUPS.map((group) => group.id)).size).toBe(TOOL_GROUPS.length);
  });

  it("gives every group a title, description, icon and colour", () => {
    for (const group of TOOL_GROUPS) {
      expect(group.title.length).toBeGreaterThan(0);
      expect(group.description.length).toBeGreaterThan(0);
      expect(["layers", "repeat", "file", "optimize", "shield"]).toContain(group.icon);
      expect(["red", "blue", "green", "orange", "purple"]).toContain(group.color);
      expect(group.tools.length).toBeGreaterThan(0);
    }
  });

  /**
   * The catalog drives navigation and search, so a tool page with no catalog entry is
   * unreachable, and a catalog entry with no page is a link to a 404. Neither shows up
   * in a render check of the pages that do exist.
   */
  it("matches the tool pages that actually exist on disk", () => {
    const dirs = readdirSync(join(process.cwd(), "app", "tools"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/tools/${entry.name}`)
      .sort();
    expect([...TOOL_ROUTES].sort()).toEqual(dirs);
  });
});

describe("searchTools", () => {
  it("returns nothing for an empty or whitespace query", () => {
    expect(searchTools("")).toEqual([]);
    expect(searchTools("   ")).toEqual([]);
  });

  it("matches case-insensitively on a partial name", () => {
    const results = searchTools("MERGE");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((tool) => tool.name.toLowerCase().includes("merge"))).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(searchTools("  compress  ")).toEqual(searchTools("compress"));
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchTools("definitely-not-a-tool")).toEqual([]);
  });

  it("caps results at the default limit", () => {
    // "pdf" appears in most names, so this exceeds the cap unless it is applied.
    expect(searchTools("pdf").length).toBeLessThanOrEqual(8);
  });

  it("honours an explicit limit, including zero", () => {
    expect(searchTools("pdf", 3)).toHaveLength(3);
    expect(searchTools("pdf", 0)).toEqual([]);
  });

  it("keeps the group metadata on every result", () => {
    for (const result of searchTools("pdf")) {
      expect(result.groupId.length).toBeGreaterThan(0);
      expect(result.href.startsWith("/tools/")).toBe(true);
    }
  });
});
