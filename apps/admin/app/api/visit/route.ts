import { randomUUID } from "node:crypto";
import { corsHeaders, preflightResponse, refuseForeignRequest } from "@/lib/cors";
import { lookupGeo } from "@/lib/geo";
import { HttpError, logError, readJsonBody } from "@/lib/http";
import { insertVisit } from "@/lib/queries";
import { clientKey, SlidingWindow, VISIT_LIMIT } from "@/lib/rate-limit";
import { isBot, isUuid, validateVisit } from "@/lib/validation";

export const runtime = "nodejs";

const limiter = new SlidingWindow(VISIT_LIMIT);
const VISITOR_COOKIE = "uf_vid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function reply(request: Request, status: number, headers: HeadersInit = {}, body: unknown = { ok: status < 300 }) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...corsHeaders(request), ...headers } });
}

export function OPTIONS(request: Request) {
  return preflightResponse(request);
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator !== -1 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

/** Public: one anonymous page-view per navigation, from the beacon on every UtilFoundry site. */
export async function POST(request: Request) {
  const refused = refuseForeignRequest(request);
  if (refused) return refused;

  const key = clientKey(request);
  const decision = limiter.take(key);
  if (!decision.allowed) return reply(request, 429, { "Retry-After": String(decision.retryAfterSeconds) });

  try {
    const result = validateVisit(await readJsonBody(request, 4 * 1024));
    if (!result.ok) return reply(request, 400, {}, { error: result.error });

    const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
    // Crawlers and monitors are acknowledged but not counted.
    if (isBot(userAgent)) return reply(request, 202);

    const existing = readCookie(request, VISITOR_COOKIE);
    const visitorId = isUuid(existing) ? existing : randomUUID();
    await insertVisit(randomUUID(), visitorId, result.value, lookupGeo(key), userAgent);

    // The UtilFoundry sites are subdomains of one registrable domain, so this beacon is a
    // same-site request and a Lax cookie is sent with it — no third-party cookie needed.
    const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
    const cookie = `${VISITOR_COOKIE}=${visitorId}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; HttpOnly;${secure} SameSite=Lax`;
    return reply(request, 201, { "Set-Cookie": cookie });
  } catch (error) {
    if (error instanceof HttpError) return reply(request, error.status, {}, { error: error.message });
    logError("POST /api/visit", error);
    return reply(request, 500, {}, { error: "Visit could not be recorded" });
  }
}
