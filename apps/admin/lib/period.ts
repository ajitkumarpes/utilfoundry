/** The reporting windows the dashboard offers, in days. */
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(value: unknown): Period {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return (PERIODS as readonly number[]).includes(days) ? (days as Period) : 30;
}

/** Percentage change from `previous` to `current`, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Every UTC day in the window, oldest first, so a day without visits shows as a zero, not a gap. */
export function fillDays(rows: Array<{ day: string; count: number }>, days: number, today = new Date()): Array<{ day: string; count: number }> {
  const counts = new Map(rows.map((row) => [row.day, row.count]));
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return { day, count: counts.get(day) ?? 0 };
  });
}
