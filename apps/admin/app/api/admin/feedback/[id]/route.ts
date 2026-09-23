import { isFeedbackStatus } from "@/lib/apps";
import { HttpError, logError, readJsonBody } from "@/lib/http";
import { deleteFeedback, setFeedbackStatus } from "@/lib/queries";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ error: "Feedback not found" }, { status: 404 });

/** Marks one item reviewed or new. */
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    const body = await readJsonBody(request, 1024);
    const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
    if (!isFeedbackStatus(status)) return Response.json({ error: "status must be new or reviewed" }, { status: 400 });
    return (await setFeedbackStatus(id, status)) ? Response.json({ ok: true, status }) : notFound();
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    logError("PATCH /api/admin/feedback/[id]", error);
    return Response.json({ error: "The change could not be saved" }, { status: 500 });
  }
}

/** Removes one item for good, e.g. spam. */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    return (await deleteFeedback(id)) ? Response.json({ ok: true }) : notFound();
  } catch (error) {
    logError("DELETE /api/admin/feedback/[id]", error);
    return Response.json({ error: "The feedback could not be deleted" }, { status: 500 });
  }
}
