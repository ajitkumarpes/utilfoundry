"use client";

import { useState } from "react";
import { dayLabel as label } from "@/lib/dates";

type Day = { day: string; count: number };

/**
 * Visits per UTC day. One series, so the heading names it and there is no legend; days with
 * no visits are drawn as empty slots rather than skipped, so the time axis stays honest.
 * The bars are for sighted mouse users; everyone else gets the same numbers as a table.
 */
export function DailyChart({ data, title }: { data: Day[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((row) => row.count), 0);
  const scaleMax = max === 0 ? 1 : max;
  const total = data.reduce((sum, row) => sum + row.count, 0);
  const middle = Math.floor((data.length - 1) / 2);

  return (
    <figure className="chart">
      <div className="chart-plot" aria-hidden="true" onMouseLeave={() => setActive(null)}>
        <div className="chart-grid">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="chart-bars">
          {data.map((row, index) => (
            <div key={row.day} className={`chart-slot${active === index ? " is-active" : ""}`} onMouseEnter={() => setActive(index)}>
              <span className="chart-bar" style={{ height: `${(row.count / scaleMax) * 100}%` }} />
              {active === index && (
                <span className={`chart-tip${index > data.length * 0.7 ? " is-left" : ""}`}>
                  <b>{row.count} {row.count === 1 ? "visit" : "visits"}</b>
                  {label(row.day, true)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="chart-axis" aria-hidden="true">
        <span>{label(data[0].day)}</span>
        <span>{label(data[middle].day)}</span>
        <span>{label(data[data.length - 1].day)}</span>
      </div>
      <figcaption className="sr-only">{title}: {total} visits over {data.length} days.</figcaption>
      <details className="chart-table">
        <summary>View as table</summary>
        <table>
          <caption className="sr-only">{title}</caption>
          <thead><tr><th scope="col">Day (UTC)</th><th scope="col">Visits</th></tr></thead>
          <tbody>
            {data.map((row) => <tr key={row.day}><td>{label(row.day, true)}</td><td>{row.count}</td></tr>)}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
