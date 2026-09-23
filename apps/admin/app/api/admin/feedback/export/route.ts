import { APP_LABELS, CATEGORY_LABELS } from "@/lib/apps";
import { toCsv } from "@/lib/csv";
import { feedbackFiltersFrom } from "@/lib/filters";
import { logError } from "@/lib/http";
import { exportFeedback } from "@/lib/queries";

export const runtime = "nodejs";

/** The feedback matching the inbox's current filters, as CSV. */
export async function GET(request: Request) {
  try {
    const filters = feedbackFiltersFrom(Object.fromEntries(new URL(request.url).searchParams));
    const rows = await exportFeedback(filters);
    const csv = toCsv(
      ["Submitted (UTC)", "App", "Tool", "Category", "Rating", "Message", "Page", "Status", "Browser", "ID"],
      rows.map((row) => [
        row.created_at, APP_LABELS[row.app], row.tool_name, CATEGORY_LABELS[row.category], row.rating,
        row.message, row.page_url, row.status, row.user_agent, row.id
      ])
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="utilfoundry-feedback-${stamp}.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    logError("GET /api/admin/feedback/export", error);
    return Response.json({ error: "The export could not be created" }, { status: 500 });
  }
}
