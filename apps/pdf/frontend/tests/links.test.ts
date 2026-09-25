import { afterEach, describe, expect, it, vi } from "vitest";

// ADMIN_URL is read once at import, so each case loads a fresh copy of the module.
const load = async () => (await import("../lib/links")).ADMIN_URL;

describe("where feedback and page views are sent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to the production admin service", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_URL", "");
    expect(await load()).toBe("https://admin.utilfoundry.com");
  });

  it("follows NEXT_PUBLIC_ADMIN_URL when a build sets it", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_URL", "http://localhost:3099");
    expect(await load()).toBe("http://localhost:3099");
  });
});
