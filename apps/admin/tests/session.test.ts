import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-value";
  process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
});

describe("session tokens", () => {
  it("round-trips a freshly created token as valid", async () => {
    const { createSessionToken, verifySessionToken } = await import("../lib/session");
    const now = 1_700_000_000_000;
    const token = await createSessionToken(now);
    expect(await verifySessionToken(token, now + 1_000)).toBe(true);
  });

  it("rejects a token once it has expired", async () => {
    const { createSessionToken, verifySessionToken } = await import("../lib/session");
    const now = 1_700_000_000_000;
    const token = await createSessionToken(now);
    const thirteenHoursLater = now + 13 * 60 * 60 * 1000;
    expect(await verifySessionToken(token, thirteenHoursLater)).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const { createSessionToken, verifySessionToken } = await import("../lib/session");
    const now = 1_700_000_000_000;
    const token = await createSessionToken(now);
    const [, signature] = token.split(".");
    const tampered = `${now + 999_999_999}.${signature}`;
    expect(await verifySessionToken(tampered, now + 1_000)).toBe(false);
  });

  it("rejects garbage input", async () => {
    const { verifySessionToken } = await import("../lib/session");
    expect(await verifySessionToken(null)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("not-a-real-token")).toBe(false);
  });
});

describe("password check", () => {
  it("accepts the configured password", async () => {
    const { verifyPassword } = await import("../lib/session");
    expect(verifyPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects anything else", async () => {
    const { verifyPassword } = await import("../lib/session");
    expect(verifyPassword("wrong")).toBe(false);
    expect(verifyPassword("")).toBe(false);
  });
});
