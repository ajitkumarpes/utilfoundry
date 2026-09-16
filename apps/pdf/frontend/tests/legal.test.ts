import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, GOVERNING_LAW, LAST_UPDATED, OPERATOR } from "../lib/legal";

// This suite runs under jsdom, where import.meta.url resolves against a fake location;
// the vitest working directory is this app, so paths are taken from there.
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const privacy = read("app/privacy/page.tsx");
const terms = read("app/terms/page.tsx");

describe("the legal pages are publishable", () => {
  it("leaves no placeholder to be filled in later", () => {
    for (const [name, source] of [["privacy", privacy], ["terms", terms]] as const) {
      expect(source, `${name} still has a placeholder`).not.toMatch(/to be filled in|TBD|TODO|LOREM/i);
    }
  });

  it("states a contact address, an operator, a governing law and a date", () => {
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    expect(OPERATOR).not.toHaveLength(0);
    expect(GOVERNING_LAW).not.toHaveLength(0);
    expect(LAST_UPDATED).not.toHaveLength(0);
  });

  it("puts the contact address and the date on both pages", () => {
    for (const source of [privacy, terms]) {
      expect(source).toContain("CONTACT_EMAIL");
      expect(source).toContain("LAST_UPDATED");
    }
    expect(terms).toContain("GOVERNING_LAW");
  });
});
