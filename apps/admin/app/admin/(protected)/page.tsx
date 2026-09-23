import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Eye, Inbox, MessageSquareText, Star, Users } from "lucide-react";
import { BarList, Panel } from "@/components/BarList";
import { DailyChart } from "@/components/DailyChart";
import { FeedbackCard } from "@/components/FeedbackCard";
import { PageHeader, PeriodTabs } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { APP_LABELS, CATEGORY_LABELS } from "@/lib/apps";
import { countryFlag, countryName, number, share } from "@/lib/format";
import { parsePeriod, percentChange } from "@/lib/period";
import { getOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OverviewPage({ searchParams }: Props) {
  const period = parsePeriod((await searchParams).period);
  const data = await getOverview(period);
  const { visits, feedback } = data;
  const totalVisits = data.daily.reduce((sum, day) => sum + day.count, 0);
  const categoryTotal = data.categories.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <PageHeader title="Overview" subtitle={`How the UtilFoundry sites did over the last ${period} days.`}>
        <PeriodTabs period={period} basePath="/admin" />
      </PageHeader>

      <div className="stat-grid">
        <StatCard label="Visits" value={number(visits.visits)} icon={Eye} tone="blue" change={percentChange(visits.visits, visits.prev_visits)} />
        <StatCard label="Unique visitors" value={number(visits.visitors)} icon={Users} tone="cyan" change={percentChange(visits.visitors, visits.prev_visitors)} />
        <StatCard label="Feedback received" value={number(feedback.received)} icon={MessageSquareText} tone="purple" change={percentChange(feedback.received, feedback.prev_received)} />
        <StatCard
          label="Average rating"
          value={feedback.rating === null ? "—" : `${feedback.rating.toFixed(1)} / 5`}
          icon={Star}
          tone="amber"
          change={feedback.rating !== null && feedback.prev_rating !== null ? percentChange(feedback.rating, feedback.prev_rating) : null}
          hint={feedback.rating === null ? "No ratings in this period" : undefined}
        />
        <StatCard
          label="Awaiting review"
          value={number(data.unreviewed)}
          icon={Inbox}
          tone="green"
          hint={data.unreviewed ? "Feedback marked new" : "Inbox is clear"}
        />
      </div>

      <Panel title="Visits per day" action={<span className="panel-note">UTC · {number(totalVisits)} in total</span>}>
        {totalVisits ? <DailyChart data={data.daily} title="Visits per day" /> : <p className="empty">No visits recorded in this period yet.</p>}
      </Panel>

      <div className="panel-grid">
        <Panel title="Top countries" action={<Link href={`/admin/visitors?period=${period}`} className="panel-link">All visitors <ArrowRight size={14} aria-hidden /></Link>}>
          <BarList
            valueLabel="Visits"
            empty="No located visits in this period."
            rows={data.countries.map((row) => ({
              key: row.country,
              label: <><span className="flag" aria-hidden>{countryFlag(row.country)}</span>{countryName(row.country)}</>,
              value: row.count,
              secondary: share(row.count, visits.visits)
            }))}
          />
        </Panel>
        <Panel title="Feedback by type">
          <BarList
            valueLabel="Submissions"
            empty="No feedback in this period."
            rows={data.categories.map((row) => ({
              key: row.category,
              label: CATEGORY_LABELS[row.category],
              value: row.count,
              secondary: share(row.count, categoryTotal)
            }))}
          />
        </Panel>
        <Panel title="Most-discussed tools">
          <BarList
            valueLabel="Submissions"
            empty="No feedback about a specific tool in this period."
            rows={data.tools.map((row) => ({
              key: `${row.app}-${row.tool_name}`,
              label: <>{row.tool_name}<small className="muted-inline">{APP_LABELS[row.app]}</small></>,
              value: row.count,
              secondary: row.rating === null ? undefined : `★ ${row.rating.toFixed(1)}`
            }))}
          />
        </Panel>
      </div>

      <Panel title="Latest feedback" action={<Link href="/admin/feedback" className="panel-link">Open inbox <ArrowRight size={14} aria-hidden /></Link>}>
        {data.recent.length ? (
          <ul className="feedback-list is-compact">
            {data.recent.map((row) => <FeedbackCard key={row.id} row={row} compact />)}
          </ul>
        ) : (
          <p className="empty">No feedback yet. It will appear here as soon as someone sends some.</p>
        )}
      </Panel>
    </>
  );
}
