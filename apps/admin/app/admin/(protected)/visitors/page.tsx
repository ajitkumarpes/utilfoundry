import type { Metadata } from "next";
import { CalendarDays, Eye, Globe2, Users } from "lucide-react";
import { BarList, Panel } from "@/components/BarList";
import { DailyChart } from "@/components/DailyChart";
import { PageHeader, PeriodTabs } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { APP_LABELS } from "@/lib/apps";
import { countryFlag, countryName, number, share } from "@/lib/format";
import { parsePeriod, percentChange } from "@/lib/period";
import { getVisitorStats } from "@/lib/queries";

export const metadata: Metadata = { title: "Visitors" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function VisitorsPage({ searchParams }: Props) {
  const period = parsePeriod((await searchParams).period);
  const stats = await getVisitorStats(period);
  const { totals } = stats;
  const topCountry = stats.countries[0];
  const chartTotal = stats.daily.reduce((sum, day) => sum + day.count, 0);

  return (
    <>
      <PageHeader title="Visitors" subtitle={`Anonymous page views over the last ${period} days. No IP address is stored.`}>
        <PeriodTabs period={period} basePath="/admin/visitors" />
      </PageHeader>

      <div className="stat-grid">
        <StatCard label="Visits" value={number(totals.visits)} icon={Eye} tone="blue" change={percentChange(totals.visits, totals.prev_visits)} />
        <StatCard label="Unique visitors" value={number(totals.visitors)} icon={Users} tone="cyan" change={percentChange(totals.visitors, totals.prev_visitors)} />
        <StatCard label="Visits per day" value={number(Math.round((totals.visits / period) * 10) / 10)} icon={CalendarDays} tone="purple" hint={`Average over ${period} days`} />
        <StatCard
          label="Top country"
          value={topCountry ? `${countryFlag(topCountry.country)} ${countryName(topCountry.country)}` : "—"}
          icon={Globe2}
          tone="green"
          hint={topCountry ? `${share(topCountry.count, totals.visits)} of visits` : "No located visits yet"}
        />
      </div>

      <Panel title="Visits per day" action={<span className="panel-note">UTC · {number(chartTotal)} in total</span>}>
        {chartTotal ? <DailyChart data={stats.daily} title="Visits per day" /> : <p className="empty">No visits recorded in this period yet.</p>}
      </Panel>

      <div className="panel-grid">
        <Panel title="Countries">
          <BarList
            valueLabel="Visits"
            empty="No located visits in this period."
            rows={stats.countries.map((row) => ({
              key: row.country,
              label: <><span className="flag" aria-hidden>{countryFlag(row.country)}</span>{countryName(row.country)}</>,
              value: row.count,
              secondary: `${number(row.visitors)} unique`
            }))}
          />
        </Panel>
        <Panel title="Sites">
          <BarList
            valueLabel="Visits"
            empty="No visits in this period."
            rows={stats.apps.map((row) => ({ key: row.app, label: APP_LABELS[row.app], value: row.count, secondary: share(row.count, totals.visits) }))}
          />
        </Panel>
        <Panel title="Top pages">
          <BarList
            valueLabel="Visits"
            empty="No visits in this period."
            rows={stats.pages.map((row) => ({
              key: `${row.app}${row.path}`,
              label: <><code className="path">{row.path}</code><small className="muted-inline">{APP_LABELS[row.app]}</small></>,
              value: row.count
            }))}
          />
        </Panel>
        <Panel title="Referrers">
          <BarList
            valueLabel="Visits"
            empty="No visits arrived from another site in this period."
            rows={stats.referrers.map((row) => ({ key: row.host, label: row.host, value: row.count }))}
          />
        </Panel>
        <Panel title="Devices">
          <BarList
            valueLabel="Visits"
            empty="No visits in this period."
            rows={stats.devices.map((row) => ({ key: row.device, label: row.device, value: row.count, secondary: share(row.count, totals.visits) }))}
          />
        </Panel>
        <Panel title="Browsers">
          <BarList
            valueLabel="Visits"
            empty="No visits in this period."
            rows={stats.browsers.map((row) => ({ key: row.browser, label: row.browser, value: row.count, secondary: share(row.count, totals.visits) }))}
          />
        </Panel>
      </div>
    </>
  );
}
