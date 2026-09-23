"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, Heart, Lightbulb, MessageCircle, Send, Star, X } from "lucide-react";
import { getTool } from "@/lib/tools";
import { ADMIN_URL } from "@/lib/links";

const APP_ID = "developer";
const MAX_MESSAGE_LENGTH = 500;

type Category = "general" | "feature_request" | "issue" | "thanks";

const OPEN_EVENT = "utilfoundry:open-feedback";
type FeedbackPreset = { category?: Category; message?: string };

/** Opens the feedback dialog from anywhere on the page, e.g. the sidebar's "Suggest a tool". */
export function openFeedback(preset: FeedbackPreset = {}) {
  window.dispatchEvent(new CustomEvent<FeedbackPreset>(OPEN_EVENT, { detail: preset }));
}

const CATEGORIES: { id: Category; label: string; icon: typeof MessageCircle }[] = [
  { id: "general", label: "General Feedback", icon: MessageCircle },
  { id: "feature_request", label: "Feature Request", icon: Lightbulb },
  { id: "issue", label: "Report an Issue", icon: AlertTriangle },
  { id: "thanks", label: "Say Thanks", icon: Heart }
];

/**
 * A floating feedback button on every tool page. Posts to the shared admin service
 * (apps/admin) — a different origin, so this never touches whatever the tool itself
 * is working on. The current tool's name is looked up from the same TOOLS registry
 * the page itself uses, via the URL, and is only sent when "include tool details"
 * stays checked.
 */
export default function FeedbackWidget() {
  const pathname = usePathname();
  const tool = getTool(pathname.replace(/^\//, ""));

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<Category>("general");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState("");
  const [includeDetails, setIncludeDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategory("general");
    setRating(0);
    setHoverRating(0);
    setMessage("");
    setIncludeDetails(true);
    setError(null);
  }

  function open(preset: FeedbackPreset = {}) {
    setSubmitted(false);
    if (preset.category) setCategory(preset.category);
    if (preset.message !== undefined) setMessage(preset.message);
    dialogRef.current?.showModal();
  }

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    const onOpen = (event: Event) => openRef.current((event as CustomEvent<FeedbackPreset>).detail ?? {});
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function close() {
    dialogRef.current?.close();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${ADMIN_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: APP_ID,
          toolId: includeDetails ? tool?.id : undefined,
          toolName: includeDetails ? tool?.name : undefined,
          category,
          rating: rating || undefined,
          message: message || undefined,
          pageUrl: window.location.href
        })
      });
      if (!response.ok) throw new Error("Request failed");
      reset();
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="feedback-fab-wrap">
        <span className="feedback-fab-label" aria-hidden="true">Feedback</span>
        <button type="button" className="feedback-fab" onClick={() => open()} aria-label="Give feedback">
          <MessageCircle size={24} />
        </button>
      </div>

      <dialog ref={dialogRef} className="feedback-dialog">
        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div className="feedback-dialog-head">
              <div>
                <h2>Share Your Feedback</h2>
                <p>Help us improve this tool. Your feedback makes a difference!</p>
              </div>
              <button type="button" className="feedback-close" onClick={close} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="feedback-categories">
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`feedback-category${category === id ? " active" : ""}`}
                  onClick={() => setCategory(id)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <span className="feedback-label">Your rating (optional)</span>
            <div className="feedback-stars" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="feedback-star"
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  aria-pressed={rating === value}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(rating === value ? 0 : value)}
                >
                  <Star size={22} fill={(hoverRating || rating) >= value ? "currentColor" : "none"} />
                </button>
              ))}
              {rating > 0 && <span className="feedback-rating-caption">{rating} out of 5</span>}
            </div>

            <label className="feedback-label" htmlFor="feedback-message">
              Your message
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder="Tell us what you think…"
              rows={4}
            />
            <div className="feedback-counter">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </div>

            {tool && (
              <label className="feedback-checkbox">
                <input
                  type="checkbox"
                  checked={includeDetails}
                  onChange={(event) => setIncludeDetails(event.target.checked)}
                />
                <span>Include tool details (optional)</span>
              </label>
            )}

            {error && (
              <p className="feedback-error" role="alert">
                {error}
              </p>
            )}

            <div className="feedback-actions">
              <button type="button" className="btn btn-outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Send size={16} />
                {submitting ? "Sending…" : "Submit Feedback"}
              </button>
            </div>
          </form>
        ) : (
          <div className="feedback-thanks">
            <CheckCircle2 size={48} className="feedback-thanks-icon" />
            <h2>Thank You!</h2>
            <p>Your feedback has been submitted successfully.</p>
            <button type="button" className="btn btn-primary" onClick={close}>
              Done
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
