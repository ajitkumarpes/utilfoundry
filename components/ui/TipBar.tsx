import type { ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * The full-width note that closes each utility page — one useful thing to know,
 * optionally with somewhere to go next.
 */
export function TipBar({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <aside className="tip-bar">
      <i aria-hidden><Info size={18} /></i>
      <span className="tip-bar-text">
        <strong>{title}</strong>
        <small>{children}</small>
      </span>
      {action}
    </aside>
  );
}
