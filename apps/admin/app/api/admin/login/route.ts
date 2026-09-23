import { HttpError, readJsonBody } from "@/lib/http";
import { clientKey, LOGIN_GLOBAL_LIMIT, LOGIN_LIMIT, SlidingWindow } from "@/lib/rate-limit";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/session";

export const runtime = "nodejs";

const perClient = new SlidingWindow(LOGIN_LIMIT);
const overall = new SlidingWindow(LOGIN_GLOBAL_LIMIT);

const tooMany = (seconds: number) =>
  Response.json(
    { error: `Too many sign-in attempts. Try again in ${seconds} seconds.` },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );

export async function POST(request: Request) {
  const client = perClient.take(clientKey(request));
  if (!client.allowed) return tooMany(client.retryAfterSeconds);
  const everyone = overall.take("all");
  if (!everyone.allowed) return tooMany(everyone.retryAfterSeconds);

  let password: unknown;
  try {
    const body = await readJsonBody(request, 1024);
    password = body && typeof body === "object" ? (body as Record<string, unknown>).password : undefined;
  } catch (error) {
    return Response.json({ error: "Invalid request" }, { status: error instanceof HttpError ? error.status : 400 });
  }

  if (typeof password !== "string" || !verifyPassword(password)) {
    // A short, fixed pause on every failure slows down guessing without hurting a person.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return Response.json({ error: "That password is not correct." }, { status: 401 });
  }

  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(createSessionToken()), "Cache-Control": "no-store" } });
}
