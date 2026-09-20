import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { corsHeaders, preflightResponse } from "@/lib/cors";
import { clientKey, SlidingWindow, VISIT_LIMIT } from "@/lib/rate-limit";
import { lookupGeo } from "@/lib/geo";
import { isAppId } from "@/lib/apps";

export const runtime = "nodejs";

const limiter = new SlidingWindow(VISIT_LIMIT);
const MAX_TEXT_LENGTH = 2048;

const VISITOR_COOKIE = "uf_vid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isProd = process.env.NODE_ENV === "production";

function jsonResponse(body: unknown, status: number, request: Request, extraHeaders: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...corsHeaders(request), ...extraHeaders }
  });
}

export async function OPTIONS(request: Request) {
  return preflightResponse(request);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const decision = limiter.take(key);
  if (!decision.allowed) {
    return jsonResponse({ error: "Too many requests" }, 429, request, { "Retry-After": String(decision.retryAfterSeconds) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request);
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "Invalid request body" }, 400, request);
  }

  const { app, path, referrer } = body as Record<string, unknown>;
  if (!isAppId(app)) return jsonResponse({ error: "Invalid app" }, 400, request);
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ error: "Invalid path" }, 400, request);
  }
  if (referrer !== undefined && referrer !== null && (typeof referrer !== "string" || referrer.length > MAX_TEXT_LENGTH)) {
    return jsonResponse({ error: "Invalid referrer" }, 400, request);
  }

  const existingVisitorId = readCookie(request, VISITOR_COOKIE);
  const visitorId = existingVisitorId && UUID_RE.test(existingVisitorId) ? existingVisitorId : randomUUID();
  const geo = lookupGeo(key);
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;

  await sql`
    INSERT INTO visits (id, app, path, visitor_id, country, region, city, referrer, user_agent)
    VALUES (
      ${randomUUID()}, ${app}, ${path}, ${visitorId}, ${geo.country}, ${geo.region}, ${geo.city},
      ${referrer ?? null}, ${userAgent}
    )
  `;

  // SameSite=None is required so the cookie is sent on the cross-origin fetch from
  // whichever app the visitor is actually on; browsers require Secure alongside it,
  // so in local (non-HTTPS) dev this cookie is simply not set and every visit reads
  // as a new visitor — a known, documented limitation that only affects local dev.
  const secureFlag = isProd ? " Secure;" : "";
  const cookie = `${VISITOR_COOKIE}=${visitorId}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; HttpOnly;${secureFlag} SameSite=None`;
  return jsonResponse({ ok: true }, 201, request, { "Set-Cookie": cookie });
}
