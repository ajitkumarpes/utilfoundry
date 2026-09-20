import { clientKey, LOGIN_LIMIT, SlidingWindow } from "@/lib/rate-limit";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/session";

export const runtime = "nodejs";

const limiter = new SlidingWindow(LOGIN_LIMIT);

export async function POST(request: Request) {
  const decision = limiter.take(clientKey(request));
  if (!decision.allowed) {
    return Response.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const password = typeof body === "object" && body !== null ? (body as Record<string, unknown>).password : undefined;
  if (typeof password !== "string" || !verifyPassword(password)) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  return Response.json({ ok: true }, { status: 200, headers: { "Set-Cookie": sessionCookie(token) } });
}
