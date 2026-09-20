"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { APPS, APP_LABELS, CATEGORY_LABELS, FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from "@/lib/apps";

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    router.push(`/admin/feedback?${params.toString()}`);
  }

  return (
    <div className="filters">
      <select
        aria-label="Filter by app"
        value={searchParams.get("app") ?? ""}
        onChange={(event) => updateParam("app", event.target.value)}
      >
        <option value="">All apps</option>
        {APPS.map((app) => (
          <option key={app} value={app}>
            {APP_LABELS[app]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by category"
        value={searchParams.get("category") ?? ""}
        onChange={(event) => updateParam("category", event.target.value)}
      >
        <option value="">All categories</option>
        {FEEDBACK_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by status"
        value={searchParams.get("status") ?? ""}
        onChange={(event) => updateParam("status", event.target.value)}
      >
        <option value="">All statuses</option>
        {FEEDBACK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status === "new" ? "New" : "Reviewed"}
          </option>
        ))}
      </select>
    </div>
  );
}
