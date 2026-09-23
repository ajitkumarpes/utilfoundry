"use client";

import { useSyncExternalStore } from "react";
import { utcTimestamp } from "@/lib/dates";

/** The current minute, as a store: stable within a minute, so rendering stays pure. */
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const subscribeMinute = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
};

function relative(date: Date, now: number) {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return "just now";
}

/**
 * A timestamp in the viewer's own timezone. The server renders it in UTC (and says so), and
 * the browser switches it to local time after hydration, so the markup never mismatches.
 */
export function LocalTime({ iso, withRelative = true }: { iso: string; withRelative?: boolean }) {
  const now = useSyncExternalStore(subscribeMinute, currentMinute, () => 0);
  const onClient = now !== 0;
  const date = new Date(iso);
  const absolute = onClient ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : utcTimestamp(iso);
  return (
    <time dateTime={iso} title={absolute}>
      {withRelative && onClient ? relative(date, now) : absolute}
    </time>
  );
}
