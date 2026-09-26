"use client";

import { useEffect, type ReactNode } from "react";

/**
 * One numbered pane of the bench. When `expanded`, the card fills the window over a dimmed
 * page — for reading a long document — and Esc or the toggle brings it back.
 */
export function StepCard({ step, title, subtitle, actions, children, expanded = false, onCollapse, className }: {
  step: number;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  expanded?: boolean;
  onCollapse?: () => void;
  className?: string;
}) {
  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCollapse?.();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, onCollapse]);

  return (
    <>
      {expanded && <div className="step-backdrop" aria-hidden onClick={onCollapse} />}
      <section
        className={["card step-card", expanded ? "is-expanded" : "", className ?? ""].filter(Boolean).join(" ")}
        aria-label={expanded ? `${title} (full screen)` : undefined}
      >
        <div className="step-head">
          <span className="step-badge" aria-hidden>{step}</span>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="step-head-actions">{actions}</div>}
        </div>
        {children}
      </section>
    </>
  );
}
