/** The four UtilFoundry sites this service collects feedback and visits from. */
export const APPS = ["web", "developer", "images", "pdf"] as const;
export type AppId = (typeof APPS)[number];

export function isAppId(value: unknown): value is AppId {
  return typeof value === "string" && (APPS as readonly string[]).includes(value);
}

export const APP_LABELS: Record<AppId, string> = {
  web: "Landing page",
  developer: "Developer tools",
  images: "Image tools",
  pdf: "PDF platform"
};

export const FEEDBACK_CATEGORIES = ["general", "feature_request", "issue", "thanks"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: "General feedback",
  feature_request: "Feature request",
  issue: "Report an issue",
  thanks: "Say thanks"
};

export const FEEDBACK_STATUSES = ["new", "reviewed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}
