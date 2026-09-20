import { sql } from "@/lib/db";
import type { AppId, FeedbackCategory, FeedbackStatus } from "@/lib/apps";

export type FeedbackRow = {
  id: string;
  app: AppId;
  tool_id: string | null;
  tool_name: string | null;
  category: FeedbackCategory;
  rating: number | null;
  message: string | null;
  page_url: string;
  status: FeedbackStatus;
  created_at: string;
};

export async function getOverviewStats() {
  const [[newFeedback], [visits], [uniqueVisitors], topCountries, recentFeedback] = await Promise.all([
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM feedback WHERE status = 'new'`,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM visits WHERE created_at > now() - interval '30 days'`,
    sql<{ count: number }[]>`
      SELECT count(DISTINCT visitor_id)::int AS count FROM visits
      WHERE created_at > now() - interval '30 days'
    `,
    sql<{ country: string; count: number }[]>`
      SELECT country, count(*)::int AS count FROM visits
      WHERE created_at > now() - interval '30 days' AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC LIMIT 5
    `,
    sql<FeedbackRow[]>`
      SELECT id, app, tool_id, tool_name, category, rating, message, page_url, status, created_at
      FROM feedback ORDER BY created_at DESC LIMIT 5
    `
  ]);

  return {
    newFeedbackCount: newFeedback?.count ?? 0,
    visits30d: visits?.count ?? 0,
    uniqueVisitors30d: uniqueVisitors?.count ?? 0,
    topCountries,
    recentFeedback
  };
}

export type FeedbackFilters = { app?: AppId; category?: FeedbackCategory; status?: FeedbackStatus };

export async function listFeedback(filters: FeedbackFilters, limit = 100) {
  return sql<FeedbackRow[]>`
    SELECT id, app, tool_id, tool_name, category, rating, message, page_url, status, created_at
    FROM feedback
    WHERE (${filters.app ?? null}::varchar IS NULL OR app = ${filters.app ?? null})
      AND (${filters.category ?? null}::varchar IS NULL OR category = ${filters.category ?? null})
      AND (${filters.status ?? null}::varchar IS NULL OR status = ${filters.status ?? null})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<boolean> {
  const result = await sql`UPDATE feedback SET status = ${status} WHERE id = ${id}`;
  return result.count > 0;
}

export async function getVisitorStats() {
  const [dailyVisits, byCountry, byApp, topPages, [totals]] = await Promise.all([
    sql<{ day: string; count: number }[]>`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM visits
      WHERE created_at > now() - interval '30 days'
      GROUP BY 1 ORDER BY 1 ASC
    `,
    sql<{ country: string; count: number; unique_count: number }[]>`
      SELECT country, count(*)::int AS count, count(DISTINCT visitor_id)::int AS unique_count
      FROM visits
      WHERE created_at > now() - interval '30 days' AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC LIMIT 15
    `,
    sql<{ app: AppId; count: number }[]>`
      SELECT app, count(*)::int AS count FROM visits
      WHERE created_at > now() - interval '30 days'
      GROUP BY app ORDER BY count DESC
    `,
    sql<{ app: AppId; path: string; count: number }[]>`
      SELECT app, path, count(*)::int AS count FROM visits
      WHERE created_at > now() - interval '30 days'
      GROUP BY app, path ORDER BY count DESC LIMIT 10
    `,
    sql<{ visits: number; unique_visitors: number }[]>`
      SELECT count(*)::int AS visits, count(DISTINCT visitor_id)::int AS unique_visitors
      FROM visits WHERE created_at > now() - interval '30 days'
    `
  ]);

  return {
    dailyVisits,
    byCountry,
    byApp,
    topPages,
    totalVisits: totals?.visits ?? 0,
    uniqueVisitors: totals?.unique_visitors ?? 0
  };
}
