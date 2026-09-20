"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_URL } from "@/lib/links";

const APP_ID = "web";

/** Fires one anonymous page-view beacon per navigation, for the admin dashboard. */
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
