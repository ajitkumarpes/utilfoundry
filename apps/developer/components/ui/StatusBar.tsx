import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, Terminal } from "lucide-react";

export type StatusTone = "idle" | "ready" | "error" | "busy";

export function StatusBar({ tone, title, note, children }: {
  tone: StatusTone; title: string; note?: string; children?: ReactNode;
}) {
  const className = tone === "error" ? "is-error" : tone === "ready" ? "" : "is-idle";
  const icon = tone === "error" ? <AlertCircle size={19} />
    : tone === "busy" ? <Loader2 size={19} className="spin" />
      : tone === "ready" ? <CheckCircle2 size={19} />
        : <Terminal size={18} />;

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
