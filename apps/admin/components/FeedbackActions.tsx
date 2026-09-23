"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { FeedbackStatus } from "@/lib/apps";

/** Mark reviewed / new, and delete with a second, explicit confirmation. */
export function FeedbackActions({ id, status }: { id: string; status: FeedbackStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"status" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PATCH" | "DELETE", body?: unknown) {
    setError(null);
    setBusy(method === "PATCH" ? "status" : "delete");
    try {
      const response = await fetch(`/api/admin/feedback/${id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "That did not work. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  const next: FeedbackStatus = status === "new" ? "reviewed" : "new";

  return (
    <span className="feedback-actions">
      {error && <span className="action-error" role="alert">{error}</span>}
      <button type="button" className="btn btn-sm btn-outline" disabled={busy !== null} onClick={() => send("PATCH", { status: next })}>
        {busy === "status" ? <Loader2 size={14} className="spin" aria-hidden /> : next === "reviewed" ? <Check size={14} aria-hidden /> : <RotateCcw size={14} aria-hidden />}
        {next === "reviewed" ? "Mark reviewed" : "Mark as new"}
      </button>
      {confirming ? (
        <>
          <button type="button" className="btn btn-sm btn-danger" disabled={busy !== null} onClick={() => send("DELETE")}>
            {busy === "delete" ? <Loader2 size={14} className="spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
            Delete for good
          </button>
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="btn btn-sm btn-ghost" disabled={busy !== null} onClick={() => setConfirming(true)} aria-label="Delete this feedback">
          <Trash2 size={14} aria-hidden /> Delete
        </button>
      )}
    </span>
  );
}
