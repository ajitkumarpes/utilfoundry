import { clearSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
}
