"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_URL } from "@/lib/links";

const APP_ID = "developer";

/**
 * Fires one anonymous page-view beacon per navigation, for the visitor-count/location
 * charts on the admin dashboard. No tool input or output is ever included — only the
 * path, so it stays consistent with this app's own "nothing you type leaves this tab"
 * promise, which only ever applied to what you run through a tool, not to which page
 * you're on.
 */
export default function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    fetch(`${ADMIN_URL}/api/visit`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: APP_ID, path: pathname, referrer: document.referrer || undefined })
    }).catch(() => {});
  }, [pathname]);

  return null;
}
