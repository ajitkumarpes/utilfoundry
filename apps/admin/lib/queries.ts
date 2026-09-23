import type { Sql } from "postgres";
import { db } from "./db";
import type { AppId, FeedbackCategory, FeedbackStatus } from "./apps";
import type { FeedbackInput, VisitInput } from "./validation";
import type { GeoInfo } from "./geo";
import { fillDays, type Period } from "./period";

const DAY_MS = 86_400_000;

export type FeedbackRow = {
  id: string;
  app: AppId;
  tool_id: string | null;
  tool_name: string | null;
  category: FeedbackCategory;
  rating: number | null;
  message: string | null;
  page_url: string;
  user_agent: string | null;
  status: FeedbackStatus;
  created_at: Date;
};

type Window = { start: Date; previousStart: Date; chartStart: Date };

/**
 * A window of whole UTC days ending today, and the same number of days before it for the
 * trend. The chart and the totals use the same window, so the numbers on one screen agree.
 */
export function windowFor(days: Period, now = Date.now()): Window {
  const today = new Date(now);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * DAY_MS;
  return { start: new Date(start), previousStart: new Date(start - days * DAY_MS), chartStart: new Date(start) };
}

async function visitTotals(sql: Sql, window: Window) {
  const [row] = await sql<{ visits: number; visitors: number; prev_visits: number; prev_visitors: number }[]>`
    SELECT
      count(*) FILTER (WHERE created_at >= ${window.start})::int AS visits,
      count(DISTINCT visitor_id) FILTER (WHERE created_at >= ${window.start})::int AS visitors,
      count(*) FILTER (WHERE created_at < ${window.start})::int AS prev_visits,
      count(DISTINCT visitor_id) FILTER (WHERE created_at < ${window.start})::int AS prev_visitors
    FROM visits WHERE created_at >= ${window.previousStart}
  `;
  return row;
}

async function dailyVisits(sql: Sql, window: Window, days: Period) {
  const rows = await sql<{ day: string; count: number }[]>`
    SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS count
    FROM visits WHERE created_at >= ${window.chartStart}
    GROUP BY 1
  `;
  return fillDays(rows, days);
}

export async function getOverview(days: Period) {
  const sql = db();
  const window = windowFor(days);
  const [visits, [feedback], [unreviewed], daily, countries, categories, tools, recent] = await Promise.all([
    visitTotals(sql, window),
    sql<{ received: number; prev_received: number; rating: number | null; prev_rating: number | null }[]>`
      SELECT
        count(*) FILTER (WHERE created_at >= ${window.start})::int AS received,
        count(*) FILTER (WHERE created_at < ${window.start})::int AS prev_received,
        round(avg(rating) FILTER (WHERE created_at >= ${window.start}), 1)::float AS rating,
        round(avg(rating) FILTER (WHERE created_at < ${window.start}), 1)::float AS prev_rating
      FROM feedback WHERE created_at >= ${window.previousStart}
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM feedback WHERE status = 'new'`,
    dailyVisits(sql, window, days),
    sql<{ country: string; count: number }[]>`
      SELECT country, count(*)::int AS count FROM visits
      WHERE created_at >= ${window.start} AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC, country LIMIT 6
    `,
    sql<{ category: FeedbackCategory; count: number }[]>`
      SELECT category, count(*)::int AS count FROM feedback
      WHERE created_at >= ${window.start}
      GROUP BY category ORDER BY count DESC, category
    `,
    sql<{ app: AppId; tool_name: string; count: number; rating: number | null }[]>`
      SELECT app, tool_name, count(*)::int AS count, round(avg(rating), 1)::float AS rating FROM feedback
      WHERE created_at >= ${window.start} AND tool_name IS NOT NULL
      GROUP BY app, tool_name ORDER BY count DESC, tool_name LIMIT 5
    `,
    sql<FeedbackRow[]>`
      SELECT id, app, tool_id, tool_name, category, rating, message, page_url, user_agent, status, created_at
      FROM feedback ORDER BY created_at DESC LIMIT 6
    `
  ]);
  return { visits, feedback, unreviewed: unreviewed.count, daily, countries, categories, tools, recent };
}

export type FeedbackFilters = {
  app?: AppId;
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  rating?: number;
  q?: string;
};

function feedbackWhere(sql: Sql, filters: FeedbackFilters) {
  const pattern = filters.q ? `%${filters.q.replace(/[\\%_]/g, "\\$&")}%` : null;
  return sql`
    WHERE true
    ${filters.app ? sql`AND app = ${filters.app}` : sql``}
    ${filters.category ? sql`AND category = ${filters.category}` : sql``}
    ${filters.status ? sql`AND status = ${filters.status}` : sql``}
    ${filters.rating ? sql`AND rating = ${filters.rating}` : sql``}
    ${pattern ? sql`AND (message ILIKE ${pattern} OR tool_name ILIKE ${pattern} OR page_url ILIKE ${pattern})` : sql``}
  `;
}

export const PAGE_SIZE = 25;

export async function listFeedback(filters: FeedbackFilters, page = 1) {
  const sql = db();
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
  const [rows, [{ total }]] = await Promise.all([
    sql<FeedbackRow[]>`
      SELECT id, app, tool_id, tool_name, category, rating, message, page_url, user_agent, status, created_at
      FROM feedback ${feedbackWhere(sql, filters)}
      ORDER BY created_at DESC, id
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM feedback ${feedbackWhere(sql, filters)}`
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Everything matching the filters, newest first, capped so one export cannot exhaust memory. */
export async function exportFeedback(filters: FeedbackFilters, limit = 10_000) {
  const sql = db();
  return sql<FeedbackRow[]>`
    SELECT id, app, tool_id, tool_name, category, rating, message, page_url, user_agent, status, created_at
    FROM feedback ${feedbackWhere(sql, filters)}
    ORDER BY created_at DESC, id
    LIMIT ${limit}
  `;
}

export async function countUnreviewed(): Promise<number> {
  const [row] = await db()<{ count: number }[]>`SELECT count(*)::int AS count FROM feedback WHERE status = 'new'`;
  return row.count;
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<boolean> {
  const result = await db()`UPDATE feedback SET status = ${status} WHERE id = ${id}`;
  return result.count > 0;
}

export async function deleteFeedback(id: string): Promise<boolean> {
  const result = await db()`DELETE FROM feedback WHERE id = ${id}`;
  return result.count > 0;
}

export async function insertFeedback(id: string, input: FeedbackInput, userAgent: string | null) {
  await db()`
    INSERT INTO feedback (id, app, tool_id, tool_name, category, rating, message, page_url, user_agent)
    VALUES (${id}, ${input.app}, ${input.toolId}, ${input.toolName}, ${input.category},
            ${input.rating}, ${input.message}, ${input.pageUrl}, ${userAgent})
  `;
}

export async function insertVisit(id: string, visitorId: string, input: VisitInput, geo: GeoInfo, userAgent: string | null) {
  await db()`
    INSERT INTO visits (id, app, path, visitor_id, country, region, city, referrer, user_agent)
    VALUES (${id}, ${input.app}, ${input.path}, ${visitorId}, ${geo.country}, ${geo.region}, ${geo.city},
            ${input.referrerHost}, ${userAgent})
  `;
}

export async function getVisitorStats(days: Period) {
  const sql = db();
  const window = windowFor(days);
  const [totals, daily, countries, apps, pages, referrers, devices, browsers] = await Promise.all([
    visitTotals(sql, window),
    dailyVisits(sql, window, days),
    sql<{ country: string; count: number; visitors: number }[]>`
      SELECT country, count(*)::int AS count, count(DISTINCT visitor_id)::int AS visitors FROM visits
      WHERE created_at >= ${window.start} AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC, country LIMIT 12
    `,
    sql<{ app: AppId; count: number }[]>`
      SELECT app, count(*)::int AS count FROM visits
      WHERE created_at >= ${window.start}
      GROUP BY app ORDER BY count DESC, app
    `,
    sql<{ app: AppId; path: string; count: number }[]>`
      SELECT app, path, count(*)::int AS count FROM visits
      WHERE created_at >= ${window.start}
      GROUP BY app, path ORDER BY count DESC, path LIMIT 10
    `,
    sql<{ host: string; count: number }[]>`
      SELECT referrer AS host, count(*)::int AS count FROM visits
      WHERE created_at >= ${window.start} AND referrer IS NOT NULL
      GROUP BY referrer ORDER BY count DESC, referrer LIMIT 8
    `,
    sql<{ device: string; count: number }[]>`
      SELECT CASE
          WHEN user_agent ~* 'ipad|tablet' THEN 'Tablet'
          WHEN user_agent ~* 'mobi|iphone|android' THEN 'Mobile'
          ELSE 'Desktop' END AS device,
        count(*)::int AS count
      FROM visits WHERE created_at >= ${window.start}
      GROUP BY 1 ORDER BY count DESC
    `,
    sql<{ browser: string; count: number }[]>`
      SELECT CASE
          WHEN user_agent ~* 'edg/' THEN 'Edge'
          WHEN user_agent ~* 'opr/|opera' THEN 'Opera'
          WHEN user_agent ~* 'firefox|fxios' THEN 'Firefox'
          WHEN user_agent ~* 'chrome|crios' THEN 'Chrome'
          WHEN user_agent ~* 'safari' THEN 'Safari'
          ELSE 'Other' END AS browser,
        count(*)::int AS count
      FROM visits WHERE created_at >= ${window.start}
      GROUP BY 1 ORDER BY count DESC
    `
  ]);
  return { totals, daily, countries, apps, pages, referrers, devices, browsers };
}

/** Deletes page views older than the retention window; returns how many went. */
export async function purgeOldVisits(retentionDays: number): Promise<number> {
  const result = await db()`DELETE FROM visits WHERE created_at < now() - make_interval(days => ${retentionDays})`;
  return result.count;
}

export async function ping(): Promise<void> {
  await db()`SELECT 1`;
}
