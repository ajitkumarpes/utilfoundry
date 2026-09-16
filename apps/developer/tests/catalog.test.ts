import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HANDLERS } from "../lib/run-tool";
import { STARTERS, defaultOption } from "../lib/samples";
import { CATEGORY_ORDER, DEFAULT_TOOL, TOOLS, getTool, getToolById } from "../lib/tools";

describe("tool catalog integrity", () => {
  it("lists seventy tools with unique ids and slugs", () => {
    expect(TOOLS).toHaveLength(70);
    expect(new Set(TOOLS.map((tool) => tool.id)).size).toBe(70);
    expect(new Set(TOOLS.map((tool) => tool.slug)).size).toBe(70);
  });

  it("has one executable handler for every catalog tool", () => {
    for (const tool of TOOLS) {
      expect(typeof HANDLERS[tool.id], `${tool.id} has no handler`).toBe("function");
    }
  });

  it("leaves no handler without a catalog entry", () => {
    for (const id of Object.keys(HANDLERS)) {
      expect(getToolById(id), `${id} runs but is not in the catalog`).toBeDefined();
    }
  });

  it("gives every tool a safe starter input and a starting option", () => {
    for (const tool of TOOLS) {
      expect(Object.hasOwn(STARTERS, tool.id), `${tool.id} has no safe starter input`).toBe(true);
      expect(defaultOption(tool.id).length).toBeGreaterThan(0);
    }
  });

  it("uses URL-safe slugs that resolve back to the tool", () => {
    for (const tool of TOOLS) {
      expect(tool.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(getTool(tool.slug)?.id).toBe(tool.id);
    }
    expect(getTool(DEFAULT_TOOL)).toBeDefined();
  });

  it("sorts every tool into a category the sidebar renders", () => {
    for (const tool of TOOLS) expect(CATEGORY_ORDER).toContain(tool.category);
    for (const category of CATEGORY_ORDER) {
      expect(TOOLS.some((tool) => tool.category === category), `${category} has no tools`).toBe(true);
    }
  });

  it("describes each tool for its page heading and search engines", () => {
    for (const tool of TOOLS) {
      expect(tool.description.length, `${tool.id} needs a fuller description`).toBeGreaterThan(40);
      expect(tool.tagline.length).toBeGreaterThan(0);
      expect(tool.inputLabel.length).toBeGreaterThan(0);
    }
  });

  it("contains no fake or unfinished tool content", () => {
    const source = ["../lib/tools.ts", "../lib/run-tool.ts", "../components/Workbench.tsx"]
      .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/fake|coming soon|not implemented/i);
  });
});
