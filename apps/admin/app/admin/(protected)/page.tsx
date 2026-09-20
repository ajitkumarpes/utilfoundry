import Link from "next/link";
import type { Metadata } from "next";
import { getOverviewStats } from "@/lib/queries";
import { APP_LABELS, CATEGORY_LABELS } from "@/lib/apps";

export const metadata: Metadata = { title: "Overview — UtilFoundry Admin" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const stats = await getOverviewStats();

  return (
    <>
      <h1>Overview</h1>

      <div className="overview-grid">
        <div className="card stat-card">
          <h3>New feedback</h3>
          <p>{stats.newFeedbackCount}</p>
        </div>
        <div className="card stat-card">
          <h3>Visits (30d)</h3>
          <p>{stats.visits30d}</p>
        </div>
        <div className="card stat-card">
          <h3>Unique visitors (30d)</h3>
          <p>{stats.uniqueVisitors30d}</p>
        </div>
      </div>

      <section className="admin-section">
        <h2>Top countries (30d)</h2>
        {stats.topCountries.length === 0 ? (
          <p className="empty-state">No visits recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCountries.map((row) => (
                <tr key={row.country}>
                  <td>{row.country}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h2>Recent feedback</h2>
        {stats.recentFeedback.length === 0 ? (
          <p className="empty-state">No feedback submitted yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Category</th>
                <th>Rating</th>
                <th>Message</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentFeedback.map((row) => (
                <tr key={row.id}>
                  <td>{APP_LABELS[row.app]}</td>
                  <td>{CATEGORY_LABELS[row.category]}</td>
                  <td>{row.rating ?? "—"}</td>
                  <td className="message-cell">{row.message || "—"}</td>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/feedback" className="btn">
            View all feedback
          </Link>
        </p>
      </section>
    </>
  );
}
