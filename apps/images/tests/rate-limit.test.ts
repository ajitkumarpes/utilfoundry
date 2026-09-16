import { describe, expect, it } from "vitest";
import { clientKey, GENERAL_LIMIT, SlidingWindow, WORKER_LIMIT } from "../lib/rate-limit";

const request = (forwardedFor?: string) =>
  new Request("http://localhost/api/process", {
    method: "POST",
    headers: forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor }
  });

describe("sliding window", () => {
  it("admits requests up to the limit and refuses the next one", () => {
    const window = new SlidingWindow(3);
    const now = 1_000_000;
    expect(window.take("a", now).allowed).toBe(true);
    expect(window.take("a", now + 10).allowed).toBe(true);
    expect(window.take("a", now + 20).allowed).toBe(true);
    expect(window.take("a", now + 30).allowed).toBe(false);
  });

  it("counts each client separately", () => {
    const window = new SlidingWindow(1);
    const now = 1_000_000;
    expect(window.take("a", now).allowed).toBe(true);
    expect(window.take("b", now).allowed).toBe(true);
    expect(window.take("a", now).allowed).toBe(false);
  });

  it("lets a blocked client back in once its oldest request ages out", () => {
    const window = new SlidingWindow(2);
    const now = 1_000_000;
    window.take("a", now);
    window.take("a", now + 1_000);
    expect(window.take("a", now + 2_000).allowed).toBe(false);
    // The first request leaves the trailing minute, so one slot frees up.
    expect(window.take("a", now + 60_001).allowed).toBe(true);
  });

  it("tells a refused caller roughly how long to wait", () => {
    const window = new SlidingWindow(1);
    const now = 1_000_000;
    window.take("a", now);
    const refused = window.take("a", now + 10_000);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("forgets clients that have gone quiet instead of holding them forever", () => {
    const window = new SlidingWindow(5);
    const now = 1_000_000;
    window.take("a", now);
    window.take("b", now);
    expect(window.size).toBe(2);
    window.prune(now + 60_001);
    expect(window.size).toBe(0);
  });
});

describe("the limits leave the documented workflows working", () => {
  it("allows a full twenty-image batch, twice over, inside one minute", () => {
    const window = new SlidingWindow(GENERAL_LIMIT);
    const now = 1_000_000;
    for (let request = 0; request < 40; request += 1) {
      expect(window.take("a", now + request * 100).allowed, `request ${request + 1} of 40`).toBe(true);
    }
  });

  it("keeps the expensive worker tools on a much tighter budget", () => {
    expect(WORKER_LIMIT).toBeLessThan(GENERAL_LIMIT);
  });
});

describe("client identity", () => {
  it("keys on the forwarded address the proxy set", () => {
    expect(clientKey(request("203.0.113.9"))).toBe("203.0.113.9");
  });

  it("takes the first entry, which is the one the proxy replaces the header with", () => {
    expect(clientKey(request("203.0.113.9, 10.0.0.1"))).toBe("203.0.113.9");
  });

  it("falls back to a single bucket when no proxy set the header", () => {
    expect(clientKey(request())).toBe("direct");
    expect(clientKey(request("   "))).toBe("direct");
  });
});
