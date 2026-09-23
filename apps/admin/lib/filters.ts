import { isAppId, isFeedbackCategory, isFeedbackStatus } from "./apps";
import type { FeedbackFilters } from "./queries";

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the feedback inbox's filters from a query string, ignoring anything invalid. */
export function feedbackFiltersFrom(params: Params): FeedbackFilters {
  const app = first(params.app);
  const category = first(params.category);
  const status = first(params.status);
  const rating = Number(first(params.rating));
  const q = first(params.q)?.trim().slice(0, 100);
  return {
    app: isAppId(app) ? app : undefined,
    category: isFeedbackCategory(category) ? category : undefined,
    status: isFeedbackStatus(status) ? status : undefined,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
    q: q || undefined
  };
}

export function pageFrom(params: Params): number {
  const page = Number(first(params.page));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}
