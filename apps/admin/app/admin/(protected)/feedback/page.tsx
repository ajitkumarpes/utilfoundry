import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { FeedbackCard } from "@/components/FeedbackCard";
import { FeedbackFilters } from "@/components/FeedbackFilters";
import { PageHeader } from "@/components/PageHeader";
import { feedbackFiltersFrom, pageFrom } from "@/lib/filters";
import { number } from "@/lib/format";
import { listFeedback, PAGE_SIZE } from "@/lib/queries";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

function queryString(params: Params, changes: Record<string, string | null>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string" && value) next.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const text = next.toString();
  return text ? `?${text}` : "";
}

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = feedbackFiltersFrom(params);
  const page = pageFrom(params);
  const { rows, total, pages } = await listFeedback(filters, page);
  // e.g. after the last item on the last page was deleted or marked reviewed away.
  if (page > pages) redirect(`/admin/feedback${queryString(params, { page: pages > 1 ? String(pages) : null })}`);
  const filtered = Object.values(filters).some((value) => value !== undefined);
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  const exportHref = `/api/admin/feedback/export${queryString(params, { page: null })}`;

  return (
    <>
      <PageHeader title="Feedback" subtitle="Everything sent from the feedback button on the UtilFoundry sites.">
        <a href={exportHref} className="btn btn-outline" download>
          <Download size={16} aria-hidden /> Export CSV
        </a>
      </PageHeader>

      <Suspense fallback={<div className="filters" />}>
        <FeedbackFilters />
      </Suspense>

      <p className="result-count" aria-live="polite">
        {total
          ? `Showing ${number(from)}–${number(to)} of ${number(total)}`
          : filtered ? "No feedback matches these filters." : "No feedback yet. It will appear here as soon as someone sends some."}
      </p>

      {rows.length > 0 && (
        <ul className="feedback-list">
          {rows.map((row) => <FeedbackCard key={row.id} row={row} />)}
        </ul>
      )}

      {pages > 1 && (
        <nav className="pagination" aria-label="Pages">
          {page > 1 ? (
            <Link href={queryString(params, { page: String(page - 1) }) || "?"} className="btn btn-outline btn-sm" rel="prev">
              <ChevronLeft size={15} aria-hidden /> Newer
            </Link>
          ) : <span />}
          <span>Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={queryString(params, { page: String(page + 1) })} className="btn btn-outline btn-sm" rel="next">
              Older <ChevronRight size={15} aria-hidden />
            </Link>
          ) : <span />}
        </nav>
      )}
    </>
  );
}
