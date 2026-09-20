import { Suspense } from "react";
import type { Metadata } from "next";
import { isAppId, isFeedbackCategory, isFeedbackStatus, APP_LABELS, CATEGORY_LABELS } from "@/lib/apps";
import { listFeedback } from "@/lib/queries";
import FilterBar from "./FilterBar";
import MarkReviewedButton from "./MarkReviewedButton";

export const metadata: Metadata = { title: "Feedback — UtilFoundry Admin" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const app = typeof params.app === "string" && isAppId(params.app) ? params.app : undefined;
  const category = typeof params.category === "string" && isFeedbackCategory(params.category) ? params.category : undefined;
  const status = typeof params.status === "string" && isFeedbackStatus(params.status) ? params.status : undefined;

  const feedback = await listFeedback({ app, category, status });

  return (
    <>
      <h1>Feedback</h1>

      <Suspense fallback={null}>
        <FilterBar />
      </Suspense>

      {feedback.length === 0 ? (
        <p className="empty-state">No feedback matches these filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>App</th>
              <th>Tool</th>
              <th>Category</th>
              <th>Rating</th>
              <th>Message</th>
              <th>Page</th>
              <th>Submitted</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((row) => (
              <tr key={row.id}>
                <td>{APP_LABELS[row.app]}</td>
                <td>{row.tool_name ?? "—"}</td>
                <td>{CATEGORY_LABELS[row.category]}</td>
                <td>{row.rating ?? "—"}</td>
                <td className="message-cell">{row.message || "—"}</td>
                <td>
                  <a href={row.page_url} target="_blank" rel="noreferrer noopener">
                    Link
                  </a>
                </td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>
                  <span className={`badge ${row.status === "new" ? "badge-new" : "badge-reviewed"}`}>
                    {row.status === "new" ? "New" : "Reviewed"}
                  </span>
                </td>
                <td>
                  <MarkReviewedButton id={row.id} status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
