import { AlertTriangle, ExternalLink, Heart, Lightbulb, MessageCircle, Monitor } from "lucide-react";
import { APP_LABELS, CATEGORY_LABELS, type FeedbackCategory } from "@/lib/apps";
import { describeBrowser } from "@/lib/format";
import type { FeedbackRow } from "@/lib/queries";
import { safeHttpUrl } from "@/lib/validation";
import { FeedbackActions } from "./FeedbackActions";
import { LocalTime } from "./LocalTime";

const CATEGORY_ICON: Record<FeedbackCategory, typeof MessageCircle> = {
  general: MessageCircle,
  feature_request: Lightbulb,
  issue: AlertTriangle,
  thanks: Heart
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`Rated ${rating} out of 5`}>
      {"★".repeat(rating)}<span className="stars-off">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/** One piece of feedback. Everything in it came from the public, so it is only ever text. */
export function FeedbackCard({ row, compact = false }: { row: FeedbackRow; compact?: boolean }) {
  const Icon = CATEGORY_ICON[row.category];
  const pageUrl = safeHttpUrl(row.page_url);
  return (
    <li className={`feedback-item${row.status === "new" ? " is-new" : ""}`}>
      <div className="feedback-head">
        <span className={`category-badge is-${row.category}`}><Icon size={14} aria-hidden />{CATEGORY_LABELS[row.category]}</span>
        <span className="feedback-where">
          {APP_LABELS[row.app]}{row.tool_name ? <> · <b>{row.tool_name}</b></> : null}
        </span>
        {row.rating ? <Stars rating={row.rating} /> : null}
        <span className={`status-badge is-${row.status}`}>{row.status === "new" ? "New" : "Reviewed"}</span>
      </div>
      <p className={`feedback-message${row.message ? "" : " is-empty"}`}>{row.message ?? "No message — just the category and rating."}</p>
      <div className="feedback-meta">
        <LocalTime iso={row.created_at.toISOString()} />
        {!compact && (
          <>
            {pageUrl ? (
              <a href={pageUrl} target="_blank" rel="noreferrer noopener" className="meta-link" title={pageUrl}>
                <ExternalLink size={13} aria-hidden /> {new URL(pageUrl).host}{new URL(pageUrl).pathname}
              </a>
            ) : (
              <span>Page not recorded</span>
            )}
            <span className="meta-ua" title={row.user_agent ?? undefined}><Monitor size={13} aria-hidden /> {describeBrowser(row.user_agent)}</span>
          </>
        )}
        {!compact && <FeedbackActions id={row.id} status={row.status} />}
      </div>
    </li>
  );
}
