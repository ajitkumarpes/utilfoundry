import Link from "next/link";
import { PERIODS, type Period } from "@/lib/period";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}

/** Links rather than state, so a period is part of the URL and survives a reload or a shared link. */
export function PeriodTabs({ period, basePath }: { period: Period; basePath: string }) {
  return (
    <nav className="segmented" aria-label="Reporting period">
      {PERIODS.map((days) => (
        <Link key={days} href={`${basePath}?period=${days}`} aria-current={days === period ? "page" : undefined} scroll={false}>
          {days} days
        </Link>
      ))}
    </nav>
  );
}
