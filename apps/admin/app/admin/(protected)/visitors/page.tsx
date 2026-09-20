import type { Metadata } from "next";
import { getVisitorStats } from "@/lib/queries";
import { APP_LABELS } from "@/lib/apps";
import VisitsChart from "./VisitsChart";

export const metadata: Metadata = { title: "Visitors — UtilFoundry Admin" };
export const dynamic = "force-dynamic";

export default async function VisitorsPage() {
  const stats = await getVisitorStats();
  const maxCountryCount = Math.max(1, ...stats.byCountry.map((row) => row.count));

  return (
    <>
      <h1>Visitors</h1>

      <div className="overview-grid">
        <div className="card stat-card">
          <h3>Visits (30d)</h3>
          <p>{stats.totalVisits}</p>
        </div>
        <div className="card stat-card">
          <h3>Unique visitors (30d)</h3>
          <p>{stats.uniqueVisitors}</p>
        </div>
      </div>

      <section className="admin-section">
        <h2>Visits per day</h2>
        <div className="card">
          {stats.dailyVisits.length === 0 ? (
            <p className="empty-state">No visits recorded yet.</p>
          ) : (
            <VisitsChart data={stats.dailyVisits} />
          )}
        </div>
      </section>

      <div className="two-col">
        <section className="admin-section">
          <h2>By country</h2>
          {stats.byCountry.length === 0 ? (
            <p className="empty-state">No visits recorded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Visits</th>
                  <th>Unique</th>
                  <th style={{ width: "40%" }}></th>
                </tr>
              </thead>
              <tbody>
                {stats.byCountry.map((row) => (
                  <tr key={row.country}>
                    <td>{row.country}</td>
                    <td>{row.count}</td>
                    <td>{row.unique_count}</td>
                    <td>
                      <div className="country-bar">
                        <span style={{ width: `${(row.count / maxCountryCount) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-section">
          <h2>By app</h2>
          {stats.byApp.length === 0 ? (
            <p className="empty-state">No visits recorded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {stats.byApp.map((row) => (
                  <tr key={row.app}>
                    <td>{APP_LABELS[row.app]}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="admin-section">
        <h2>Top pages</h2>
        {stats.topPages.length === 0 ? (
          <p className="empty-state">No visits recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Path</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {stats.topPages.map((row) => (
                <tr key={`${row.app}-${row.path}`}>
                  <td>{APP_LABELS[row.app]}</td>
                  <td>{row.path}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
