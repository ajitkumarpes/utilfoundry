import { clearSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  return Response.json({ ok: true }, { status: 200, headers: { "Set-Cookie": clearSessionCookie() } });
}
