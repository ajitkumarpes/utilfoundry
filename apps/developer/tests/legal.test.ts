import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL } from "../lib/links";

// fileURLToPath, not URL.pathname: a checkout under a path with a space stays encoded otherwise.
const root = fileURLToPath(new URL("../", import.meta.url));
const privacy = readFileSync(join(root, "app/(tool)/privacy/page.tsx"), "utf8");
const terms = readFileSync(join(root, "app/(tool)/terms/page.tsx"), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/**
 * The privacy policy claims this app cannot upload your input. That claim stops being
 * true the moment someone adds a route handler or a server action, so it is asserted
 * here rather than trusted.
 */
describe("the no-upload claim holds", () => {
  it("has no API route anywhere in the app directory", () => {
    const routes = walk(join(root, "app")).filter((path) => /\/route\.(ts|tsx|js|mjs)$/.test(path));
    expect(routes, "an API route would give this app somewhere to upload to").toEqual([]);
    expect(existsSync(join(root, "app/api"))).toBe(false);
  });

  it("declares no server action", () => {
    const sources = [join(root, "app"), join(root, "lib"), join(root, "components")]
      .flatMap(walk)
      .filter((path) => /\.(ts|tsx)$/.test(path));
    const offenders = sources.filter((path) => /^\s*["']use server["']/m.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
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
