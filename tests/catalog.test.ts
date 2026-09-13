import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

describe("tool catalog integrity", () => {
  it("has one executable handler for every catalog tool", () => {
    const ids = [...page.matchAll(/^\s+id: "([^"]+)"/gm)].map(
      (match) => match[1],
    );
    const runTool = page.slice(
      page.indexOf("async function runTool"),
      page.indexOf("async function copyOutput"),
    );
    const handlers = new Set(
      [...runTool.matchAll(/selectedId === "([^"]+)"/g)].map(
        (match) => match[1],
      ),
    );
    expect(ids).toHaveLength(70);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids)
      expect(handlers.has(id), `${id} has no runTool branch`).toBe(true);

    const starterSection = page.slice(
      page.indexOf("const starterValues"),
      page.indexOf("function prettyJson"),
    );
    const starters = new Set(
      [...starterSection.matchAll(/^\s{2}(?:"([^"]+)"|([\w-]+)):/gm)].map(
        (match) => match[1] ?? match[2],
      ),
    );
    for (const id of ids)
      expect(starters.has(id), `${id} has no safe starter input`).toBe(true);
  });

  it("contains no fake or unfinished tool content", () => {
    expect(page).not.toMatch(/fake|coming soon|not implemented/i);
  });
});
