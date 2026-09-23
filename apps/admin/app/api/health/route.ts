import { logError } from "@/lib/http";
import { ping } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** For the container health check and uptime monitors: up only if the database answers. */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await Promise.race([
      ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("database did not answer within 3s")), 3000))
    ]);
    return Response.json({ status: "ok", database: "ok" }, { headers });
  } catch (error) {
    logError("GET /api/health", error);
    return Response.json({ status: "error", database: "unreachable" }, { status: 503, headers });
  }
}
