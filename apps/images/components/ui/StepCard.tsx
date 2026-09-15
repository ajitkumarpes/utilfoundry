import type { ReactNode } from "react";

export function StepCard({ step, title, subtitle, actions, children }: {
  step: number; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="card step-card">
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
  );
}
