"use client";

import { useState } from "react";

type DailyVisit = { day: string; count: number };

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A single series (visits per day), so no legend is needed — the section heading
 * already names what's plotted. Bars are capped at 24px, 4px rounded at the data
 * end, with a 2px surface gap between them; the <details> table view is the
 * non-visual fallback for the same data, always present rather than gated behind JS.
 */
export default function VisitsChart({ data }: { data: DailyVisit[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((row) => row.count));

  return (
    <div>
      <div className="bar-chart" role="img" aria-label={`Visits per day over the last 30 days, peaking at ${max}`}>
        {data.map((row, index) => (
          <div
            key={row.day}
            className="bar"
            tabIndex={0}
            style={{ height: `${Math.max(2, (row.count / max) * 100)}%`, position: "relative" }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered((current) => (current === index ? null : current))}
            aria-label={`${formatDay(row.day)}: ${row.count} visits`}
          >
            {hovered === index && (
              <div className="bar-tooltip">
                <strong>{row.count}</strong> visits
                <br />
                {formatDay(row.day)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bar-chart-caption">
        <span>{data.length > 0 ? formatDay(data[0].day) : ""}</span>
        <span>{data.length > 0 ? formatDay(data[data.length - 1].day) : ""}</span>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>View as table</summary>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Day</th>
              <th>Visits</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.day}>
                <td>{formatDay(row.day)}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
