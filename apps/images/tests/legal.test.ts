import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BROWSER_TOOL_NAMES, SERVER_ENGINES, SHARP_TOOL_NAMES, WORKER_TOOL_NAMES } from "../lib/legal";
import { CONTACT_EMAIL } from "../lib/links";
import { READY_TOOLS, TOOLS } from "../lib/tools";

const privacy = readFileSync(new URL("../app/(tool)/privacy/page.tsx", import.meta.url), "utf8");
const terms = readFileSync(new URL("../app/(tool)/terms/page.tsx", import.meta.url), "utf8");

/**
 * The privacy policy names every tool that uploads a file. These tests fail when the
 * catalogue grows in a way the policy does not already describe, because a policy that
 * silently falls behind the code is worse than none.
 */
describe("privacy policy tracks the catalogue", () => {
  it("classifies every engine in use as either browser-side or server-side", () => {
    // A new engine has to be added to SERVER_ENGINES or consciously left out of it,
    // which is the decision this test exists to force.
    const known = new Set([
      "canvas", "server", "worker", "pdf", "text",
      "inspect", "color", "compose", "favicon", "frames", "diff", "none"
    ]);
    const used = new Set(TOOLS.map((tool) => tool.engine));
    expect([...used].filter((engine) => !known.has(engine)), "unclassified engine").toEqual([]);
  });

  it("puts every live tool in exactly one of the three lists", () => {
    const listed = [...BROWSER_TOOL_NAMES, ...SHARP_TOOL_NAMES, ...WORKER_TOOL_NAMES];
    expect(listed.length).toBe(READY_TOOLS.length);
    expect(new Set(listed).size).toBe(READY_TOOLS.length);
  });

  it("sorts the uploading tools into the paragraph that matches their engine", () => {
    for (const tool of READY_TOOLS) {
      const uploads = SERVER_ENGINES.includes(tool.engine);
      expect(BROWSER_TOOL_NAMES.includes(tool.name), `${tool.id} is in the wrong list`).toBe(!uploads);
    }
  });
});

describe("the tool pages do not contradict the policy", () => {
  it("never advertises local processing on a tool that uploads the file", () => {
    for (const tool of TOOLS.filter((item) => SERVER_ENGINES.includes(item.engine))) {
      for (const highlight of tool.highlights) {
        expect(highlight.toLowerCase(), `${tool.id} claims local processing but uploads`)
          .not.toMatch(/locally|in your browser|never uploaded|offline/);
      }
    }
  });

  it("never advertises server processing on a tool that stays in the browser", () => {
    for (const tool of TOOLS.filter((item) => !SERVER_ENGINES.includes(item.engine))) {
      for (const highlight of tool.highlights) {
        expect(highlight.toLowerCase(), `${tool.id} claims server processing but is local`)
          .not.toMatch(/our server|this server/);
      }
    }
  });
});

describe("the legal pages are publishable", () => {
  it("leaves no placeholder to be filled in later", () => {
    for (const [name, source] of [["privacy", privacy], ["terms", terms]] as const) {
      expect(source, `${name} still has a placeholder`).not.toMatch(/to be filled in|TBD|TODO|LOREM/i);
    }
  });

  it("gives a reachable contact address on both pages", () => {
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    expect(privacy).toContain("CONTACT_EMAIL");
    expect(terms).toContain("CONTACT_EMAIL");
  });
});
