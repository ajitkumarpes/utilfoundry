import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://dev.utilfoundry.com,https://images.utilfoundry.com");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("corsHeaders", () => {
  it("echoes back an allow-listed origin with credentials enabled", async () => {
    const { corsHeaders } = await import("../lib/cors");
    const request = new Request("http://localhost/api/feedback", { headers: { origin: "https://dev.utilfoundry.com" } });
    const headers = corsHeaders(request) as Record<string, string>;
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://dev.utilfoundry.com");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("returns no CORS headers for an origin not on the allow-list", async () => {
    const { corsHeaders } = await import("../lib/cors");
    const request = new Request("http://localhost/api/feedback", { headers: { origin: "https://evil.example.com" } });
    expect(corsHeaders(request)).toEqual({});
  });

  it("returns no CORS headers when there is no Origin header at all", async () => {
    const { corsHeaders } = await import("../lib/cors");
    const request = new Request("http://localhost/api/feedback");
    expect(corsHeaders(request)).toEqual({});
  });
});

describe("preflightResponse", () => {
  it("returns 204 with allow-methods/headers for an allowed origin", async () => {
    const { preflightResponse } = await import("../lib/cors");
    const request = new Request("http://localhost/api/feedback", {
      method: "OPTIONS",
      headers: { origin: "https://images.utilfoundry.com" }
    });
    const response = preflightResponse(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://images.utilfoundry.com");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("refuses a disallowed origin", async () => {
    const { preflightResponse } = await import("../lib/cors");
    const request = new Request("http://localhost/api/feedback", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example.com" }
    });
    expect(preflightResponse(request).status).toBe(403);
  });
});
