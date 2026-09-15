"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ImageIcon, Loader2 } from "lucide-react";

export type StatusTone = "idle" | "ready" | "error" | "busy";

export function StatusBar({ tone, title, note, children }: {
  tone: StatusTone; title: string; note?: string; children?: ReactNode;
}) {
  const className = tone === "error" ? "is-error" : tone === "ready" ? "" : "is-idle";
  const icon = tone === "error" ? <AlertCircle size={19} />
    : tone === "busy" ? <Loader2 size={19} className="spin" />
      : tone === "ready" ? <CheckCircle2 size={19} />
        : <ImageIcon size={18} />;

  return (
    <section className={`card status-bar ${className}`} role={tone === "error" ? "alert" : "status"}>
      <span className="status-icon">{icon}</span>
      <span className="status-text">
        <strong>{title}</strong>
        {note && <small>{note}</small>}
      </span>
      {children && <span className="status-actions">{children}</span>}
    </section>
  );
}

/** Primary action with an optional dropdown of alternative output formats. */
export function DownloadSplit({ label, disabled, busy, onAction, options, onPick }: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onAction: () => void;
  options?: { value: string; label: string }[];
  onPick?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!options?.length) {
    return (
      <button type="button" className="btn btn-primary" disabled={disabled || busy} onClick={onAction}>
        {busy ? <><Loader2 size={17} className="spin" /> Working…</> : label}
      </button>
    );
  }

  return (
    <span className="split-wrap" ref={ref}>
      <span className="download-split">
        <button type="button" className="btn btn-primary" disabled={disabled || busy} onClick={onAction}>
          {busy ? <><Loader2 size={17} className="spin" /> Working…</> : label}
        </button>
        <button type="button" className="split-toggle" aria-label="More download formats" aria-expanded={open} disabled={disabled || busy} onClick={() => setOpen((value) => !value)}>
          <ChevronDown size={16} />
        </button>
      </span>
      {open && (
        <span className="split-menu">
          {options.map((option) => (
            <button key={option.value} type="button" onClick={() => { setOpen(false); onPick?.(option.value); }}>
              {option.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
