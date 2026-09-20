"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeedbackStatus } from "@/lib/apps";

export default function MarkReviewedButton({ id, status }: { id: string; status: FeedbackStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const nextStatus: FeedbackStatus = status === "new" ? "reviewed" : "new";

  async function handleClick() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/feedback/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="btn" onClick={handleClick} disabled={loading}>
      {loading ? "Saving…" : status === "new" ? "Mark reviewed" : "Mark new"}
    </button>
  );
}
