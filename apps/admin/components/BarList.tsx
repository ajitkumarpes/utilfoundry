import { number } from "@/lib/format";

export type BarRow = { key: string; label: React.ReactNode; value: number; secondary?: string };

/** A ranked list with a share bar behind each row — the whole card reads like a table. */
export function BarList({ rows, valueLabel, empty }: { rows: BarRow[]; valueLabel: string; empty: string }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <table className="bar-list">
      <thead className="sr-only">
        <tr><th scope="col">Name</th><th scope="col">{valueLabel}</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>
              <span className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} aria-hidden />
              <span className="bar-label">{row.label}</span>
            </td>
            <td>
              {number(row.value)}
              {row.secondary && <small>{row.secondary}</small>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
