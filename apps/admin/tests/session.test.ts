import { beforeEach, describe, expect, it } from "vitest";
import { clearSessionCookie, createSessionToken, sessionCookie, sessionCookieName, verifyPassword, verifySessionToken } from "../lib/session";

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "a".repeat(64);
  process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
});

const NOW = 1_700_000_000_000;

describe("session tokens", () => {
  it("accepts a fresh token", () => {
    expect(verifySessionToken(createSessionToken(NOW), NOW + 1_000)).toBe(true);
  });

  it("gives every sign-in its own token", () => {
    expect(createSessionToken(NOW)).not.toBe(createSessionToken(NOW));
  });

  it("expires after twelve hours", () => {
    const token = createSessionToken(NOW);
    expect(verifySessionToken(token, NOW + 11.9 * 3_600_000)).toBe(true);
    expect(verifySessionToken(token, NOW + 12.1 * 3_600_000)).toBe(false);
  });

  it("rejects a token whose expiry was pushed out", () => {
    const [, nonce, signature] = createSessionToken(NOW).split(".");
    expect(verifySessionToken(`${NOW + 999_999_999}.${nonce}.${signature}`, NOW)).toBe(false);
  });

  it("signs everyone out when the password changes", () => {
    const token = createSessionToken(NOW);
    process.env.ADMIN_PASSWORD = "a-brand-new-password";
    expect(verifySessionToken(token, NOW + 1_000)).toBe(false);
  });

  it("signs everyone out when the secret changes", () => {
    const token = createSessionToken(NOW);
    process.env.ADMIN_SESSION_SECRET = "b".repeat(64);
    expect(verifySessionToken(token, NOW + 1_000)).toBe(false);
  });

  it("rejects garbage", () => {
    for (const token of [null, undefined, "", "abc", "1.2", "1.2.3.4", `${NOW + 1}..`]) {
      expect(verifySessionToken(token, NOW)).toBe(false);
    }
  });
});

describe("password check", () => {
  it("accepts only the configured password", () => {
    expect(verifyPassword("correct-horse-battery-staple")).toBe(true);
    expect(verifyPassword("correct-horse-battery-stapl")).toBe(false);
    expect(verifyPassword("")).toBe(false);
  });
});

describe("session cookie", () => {
  it("is host-only, HttpOnly, Secure and Lax in production", () => {
    const cookie = sessionCookie("token", true);
    expect(cookie).toMatch(/^__Host-uf_admin=token;/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("drops the prefix and Secure flag for plain-http development", () => {
    expect(sessionCookieName(false)).toBe("uf_admin");
    expect(sessionCookie("t", false)).not.toContain("Secure");
    expect(clearSessionCookie(false)).toContain("Max-Age=0");
  });
});
