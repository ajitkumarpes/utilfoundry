import { randomUUID } from "node:crypto";
import { corsHeaders, preflightResponse, refuseForeignRequest } from "@/lib/cors";
import { HttpError, logError, readJsonBody } from "@/lib/http";
import { insertFeedback } from "@/lib/queries";
import { clientKey, FEEDBACK_LIMIT, SlidingWindow } from "@/lib/rate-limit";
import { validateFeedback } from "@/lib/validation";

export const runtime = "nodejs";

const limiter = new SlidingWindow(FEEDBACK_LIMIT);

function reply(request: Request, body: unknown, status: number, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...corsHeaders(request), ...headers } });
}

export function OPTIONS(request: Request) {
  return preflightResponse(request);
}

/** Public: the feedback widget on every UtilFoundry site posts here. */
export async function POST(request: Request) {
  const refused = refuseForeignRequest(request);
  if (refused) return refused;

  const decision = limiter.take(clientKey(request));
  if (!decision.allowed) {
    return reply(request, { error: "Too many requests" }, 429, { "Retry-After": String(decision.retryAfterSeconds) });
  }

  try {
    const result = validateFeedback(await readJsonBody(request));
    if (!result.ok) return reply(request, { error: result.error }, 400);
    const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
    await insertFeedback(randomUUID(), result.value, userAgent);
    return reply(request, { ok: true }, 201);
  } catch (error) {
    if (error instanceof HttpError) return reply(request, { error: error.message }, error.status);
    logError("POST /api/feedback", error);
    return reply(request, { error: "Feedback could not be saved. Please try again." }, 500);
  }
}
