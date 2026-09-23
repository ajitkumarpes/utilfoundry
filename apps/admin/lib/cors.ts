/**
 * Allow-list for the public /api/feedback and /api/visit endpoints, called
 * cross-origin from web/developer/images/pdf. Mirrors apps/pdf/backend's
 * CORS_ALLOWED_ORIGINS pattern: a comma-separated env var, split and trimmed into an
 * exact allow-list. /api/visit sets a cookie, so the origin must be echoed back
 * specifically (never "*") and Allow-Credentials must be set.
 */

function configuredOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
  if (configuredOrigins().includes(origin)) return true;
  // No fixed set of local ports across four independently-run dev servers, so any
  // localhost origin is accepted outside production.
  if (process.env.NODE_ENV !== "production") return /^http:\/\/localhost:\d+$/.test(origin);
  return false;
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin"
  };
}

export function preflightResponse(request: Request): Response {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}

/**
 * CORS only stops a browser from reading a response; a page on another site can still *send*
 * a "simple" POST (text/plain, no preflight) and have it stored. So a request that names an
 * Origin must name an allowed one, and the body must be declared as JSON — which a browser
 * can only send cross-origin after a preflight this service answers. Server-side callers
 * send no Origin and are left to the rate limiter.
 */
export function refuseForeignRequest(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers: { "Cache-Control": "no-store", Vary: "Origin" } });
  }
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) {
    return Response.json({ error: "Send the body as application/json" }, { status: 415, headers: { "Cache-Control": "no-store", ...corsHeaders(request) } });
  }
  return null;
}
