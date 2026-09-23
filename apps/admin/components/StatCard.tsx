import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "purple" | "amber" | "cyan";
  /** Percent change against the previous period; null when there is nothing to compare. */
  change?: number | null;
  hint?: string;
};

export function StatCard({ label, value, icon: Icon, tone, change, hint }: StatCardProps) {
  const direction = change === undefined || change === null ? null : change > 0 ? "up" : change < 0 ? "down" : "flat";
  const TrendIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  return (
    <section className="card stat-card">
      <div className="stat-head">
        <span className={`stat-icon tone-${tone}`}><Icon size={18} aria-hidden /></span>
        <h2>{label}</h2>
      </div>
      <p className="stat-value">{value}</p>
      <p className="stat-foot">
        {direction && (
          <span className={`trend is-${direction}`}>
            <TrendIcon size={14} aria-hidden />
            {change! > 0 ? "+" : ""}{change}%
          </span>
        )}
        <span>{hint ?? (direction ? "vs previous period" : "No earlier data to compare")}</span>
      </p>
    </section>
  );
}
