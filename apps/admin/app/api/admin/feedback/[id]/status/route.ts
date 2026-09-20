import { isFeedbackStatus } from "@/lib/apps";
import { setFeedbackStatus } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const status = typeof body === "object" && body !== null ? (body as Record<string, unknown>).status : undefined;
  if (!isFeedbackStatus(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await setFeedbackStatus(id, status);
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
