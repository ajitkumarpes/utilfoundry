import { describe, expect, it } from "vitest";
import { clientKey, SlidingWindow } from "../lib/rate-limit";

const request = (forwardedFor?: string) =>
  new Request("http://localhost/api/feedback", {
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
    expect(window.take("a", now + 60_001).allowed).toBe(true);
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

describe("client identity", () => {
  it("keys on the forwarded address the proxy set", () => {
    expect(clientKey(request("203.0.113.9"))).toBe("203.0.113.9");
  });

  it("takes the first entry, which is the one the proxy replaces the header with", () => {
    expect(clientKey(request("203.0.113.9, 10.0.0.1"))).toBe("203.0.113.9");
  });

  it("falls back to a single bucket when no proxy set the header", () => {
    expect(clientKey(request())).toBe("direct");
  });
});
