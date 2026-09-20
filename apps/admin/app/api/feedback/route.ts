import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { corsHeaders, preflightResponse } from "@/lib/cors";
import { clientKey, FEEDBACK_LIMIT, SlidingWindow } from "@/lib/rate-limit";
import { isAppId, isFeedbackCategory } from "@/lib/apps";

export const runtime = "nodejs";

const limiter = new SlidingWindow(FEEDBACK_LIMIT);
const MAX_MESSAGE_LENGTH = 500;
const MAX_TEXT_LENGTH = 2048;

function jsonResponse(body: unknown, status: number, request: Request, extraHeaders: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...corsHeaders(request), ...extraHeaders }
  });
}

export async function OPTIONS(request: Request) {
  return preflightResponse(request);
}

export async function POST(request: Request) {
  const decision = limiter.take(clientKey(request));
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

  const { app, toolId, toolName, category, rating, message, pageUrl } = body as Record<string, unknown>;

  if (!isAppId(app)) return jsonResponse({ error: "Invalid app" }, 400, request);
  if (!isFeedbackCategory(category)) return jsonResponse({ error: "Invalid category" }, 400, request);
  if (typeof pageUrl !== "string" || pageUrl.length === 0 || pageUrl.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ error: "Invalid pageUrl" }, 400, request);
  }
  if (rating !== undefined && rating !== null) {
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonResponse({ error: "Invalid rating" }, 400, request);
    }
  }
  if (message !== undefined && message !== null) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: "Message is too long" }, 400, request);
    }
  }
  if (toolId !== undefined && toolId !== null && (typeof toolId !== "string" || toolId.length > 128)) {
    return jsonResponse({ error: "Invalid toolId" }, 400, request);
  }
  if (toolName !== undefined && toolName !== null && (typeof toolName !== "string" || toolName.length > 255)) {
    return jsonResponse({ error: "Invalid toolName" }, 400, request);
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;

  await sql`
    INSERT INTO feedback (id, app, tool_id, tool_name, category, rating, message, page_url, user_agent)
    VALUES (
      ${randomUUID()}, ${app}, ${toolId ?? null}, ${toolName ?? null}, ${category},
      ${rating ?? null}, ${message ?? null}, ${pageUrl}, ${userAgent}
    )
  `;

  return jsonResponse({ ok: true }, 201, request);
}
