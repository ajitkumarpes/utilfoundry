"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { APPS, APP_LABELS, CATEGORY_LABELS, FEEDBACK_CATEGORIES } from "@/lib/apps";

const FILTER_KEYS = ["q", "app", "category", "status", "rating"] as const;
type Values = Record<(typeof FILTER_KEYS)[number], string>;

const read = (params: { get(name: string): string | null }): Values =>
  Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""])) as Values;

function toSearch(values: Values) {
  const search = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = key === "q" ? values.q.trim() : values[key];
    if (value) search.set(key, value);
  }
  return search.toString();
}

/**
 * Filters live in the URL, so a filtered inbox can be reloaded, bookmarked or shared.
 *
 * The controls keep their own state rather than reading the URL back: two quick changes
 * would otherwise build the second URL from the first one's stale search params and drop
 * it. The URL is only read back when it changes for a reason other than these controls
 * (a link, back/forward), which is told apart by remembering the URLs asked for here.
 */
export function FeedbackFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const url = params.toString();
  const [values, setValues] = useState(() => read(params));
  const [known, setKnown] = useState<{ url: string; requested: string[] }>({ url, requested: [] });
  const [pending, startTransition] = useTransition();
  const searchTimer = useRef<number | undefined>(undefined);

  if (url !== known.url) {
    const index = known.requested.indexOf(url);
    setKnown({ url, requested: index < 0 ? [] : known.requested.slice(index + 1) });
    if (index < 0) setValues(read(params));
  }

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  function navigate(next: Values) {
    window.clearTimeout(searchTimer.current);
    const search = toSearch(next);
    setKnown((current) => ({ ...current, requested: [...current.requested, search] }));
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
  }

  function change(name: keyof Values, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    // Carries any search still waiting on its debounce, so nothing typed is lost.
    navigate(next);
  }

  const active = FILTER_KEYS.some((key) => values[key].trim());

  return (
    <div className="filters" role="search" aria-busy={pending}>
      <label className="filter-search">
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={values.q}
          placeholder="Search messages, tools and pages"
          aria-label="Search feedback"
          maxLength={100}
          onChange={(event) => {
            const next = { ...values, q: event.target.value };
            setValues(next);
            window.clearTimeout(searchTimer.current);
            searchTimer.current = window.setTimeout(() => navigate(next), 300);
          }}
        />
      </label>
      <select aria-label="App" value={values.app} onChange={(event) => change("app", event.target.value)}>
        <option value="">All apps</option>
        {APPS.map((app) => <option key={app} value={app}>{APP_LABELS[app]}</option>)}
      </select>
      <select aria-label="Type" value={values.category} onChange={(event) => change("category", event.target.value)}>
        <option value="">All types</option>
        {FEEDBACK_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </select>
      <select aria-label="Status" value={values.status} onChange={(event) => change("status", event.target.value)}>
        <option value="">Any status</option>
        <option value="new">New</option>
        <option value="reviewed">Reviewed</option>
      </select>
      <select aria-label="Rating" value={values.rating} onChange={(event) => change("rating", event.target.value)}>
        <option value="">Any rating</option>
        {[5, 4, 3, 2, 1].map((stars) => <option key={stars} value={stars}>{stars} {stars === 1 ? "star" : "stars"}</option>)}
      </select>
      {active && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            const cleared = read(new URLSearchParams());
            setValues(cleared);
            navigate(cleared);
          }}
        >
          <X size={14} aria-hidden /> Clear filters
        </button>
      )}
    </div>
  );
}
