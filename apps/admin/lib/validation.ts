/**
 * Validation for the two public endpoints. Anyone can call them — CORS only restrains
 * browsers — so every field is checked for type and size here, and anything that will be
 * rendered back in the dashboard is normalised to something safe to render.
 */

import { isAppId, isFeedbackCategory, type AppId, type FeedbackCategory } from "./apps";

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export type FeedbackInput = {
  app: AppId;
  category: FeedbackCategory;
  toolId: string | null;
  toolName: string | null;
  rating: number | null;
  message: string | null;
  pageUrl: string;
};

export type VisitInput = { app: AppId; path: string; referrerHost: string | null };

export const MAX_MESSAGE_LENGTH = 500;

/** Drops control characters (keeping line breaks and tabs) and trims; empty becomes null. */
export function cleanText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (cleaned.length > max) return undefined;
  return cleaned || null;
}

/**
 * Only http and https survive. This URL is shown as a link in the dashboard, and a
 * `javascript:` URL submitted by anyone with curl would otherwise run in the admin's session.
 */
export function safeHttpUrl(value: unknown, max = 2048): string | null {
  if (typeof value !== "string" || !value || value.length > max) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Keeps only the referring site's host. A full referrer URL can carry search terms, tokens
 * or other personal data in its path and query; which site sent the visit is all a traffic
 * report needs.
 */
export function referrerHost(value: unknown): string | null {
  const url = safeHttpUrl(value);
  return url ? new URL(url).hostname.replace(/^www\./, "") : null;
}

/** A page path without its query string or fragment, which can hold personal data. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 1024) return null;
  const path = value.split(/[?#]/)[0];
  return path.length ? path : "/";
}

function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export function validateFeedback(body: unknown): Validation<FeedbackInput> {
  const input = asRecord(body);
  if (!input) return { ok: false, error: "Request body must be a JSON object" };
  if (!isAppId(input.app)) return { ok: false, error: "Invalid app" };
  if (!isFeedbackCategory(input.category)) return { ok: false, error: "Invalid category" };

  const pageUrl = safeHttpUrl(input.pageUrl);
  if (!pageUrl) return { ok: false, error: "pageUrl must be an http(s) URL" };

  let rating: number | null = null;
  if (input.rating !== undefined && input.rating !== null) {
    if (typeof input.rating !== "number" || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      return { ok: false, error: "rating must be a whole number from 1 to 5" };
    }
    rating = input.rating;
  }

  const message = cleanText(input.message, MAX_MESSAGE_LENGTH);
  if (message === undefined) return { ok: false, error: `message must be text of at most ${MAX_MESSAGE_LENGTH} characters` };
  const toolId = cleanText(input.toolId, 128);
  if (toolId === undefined || (toolId && !/^[a-z0-9-]+$/i.test(toolId))) return { ok: false, error: "Invalid toolId" };
  const toolName = cleanText(input.toolName, 255);
  if (toolName === undefined) return { ok: false, error: "Invalid toolName" };

  return { ok: true, value: { app: input.app, category: input.category, toolId, toolName, rating, message, pageUrl } };
}

export function validateVisit(body: unknown): Validation<VisitInput> {
  const input = asRecord(body);
  if (!input) return { ok: false, error: "Request body must be a JSON object" };
  if (!isAppId(input.app)) return { ok: false, error: "Invalid app" };
  const path = cleanPath(input.path);
  if (!path) return { ok: false, error: "path must start with /" };
  if (input.referrer !== undefined && input.referrer !== null && typeof input.referrer !== "string") {
    return { ok: false, error: "Invalid referrer" };
  }
  return { ok: true, value: { app: input.app, path, referrerHost: referrerHost(input.referrer) } };
}

/** Crawlers, link unfurlers and headless browsers, which would otherwise inflate visit counts. */
export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|httpclient|go-http-client|node-fetch|axios/i.test(userAgent);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
