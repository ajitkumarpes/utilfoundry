/**
 * Date text that is rendered on the server and then again by the browser during hydration.
 *
 * Built by hand rather than with Intl on purpose: Node and each browser ship their own locale
 * data, and they disagree on details ("Sep" or "Sept", "14:05" or "at 14:05"). Any difference
 * is a hydration mismatch, and React then re-renders the whole document on the client — which
 * in Safari threw away the theme set before paint. Local-time formatting that may use Intl
 * happens only after hydration (see LocalTime).
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (value: number) => String(value).padStart(2, "0");

/** "23 Sep", or "Wed 23 Sep", for a YYYY-MM-DD day. */
export function dayLabel(day: string, withWeekday = false): string {
  const date = new Date(`${day}T00:00:00Z`);
  const text = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return withWeekday ? `${WEEKDAYS[date.getUTCDay()]} ${text}` : text;
}

/** "23 Sep 2026, 14:05 UTC". */
export function utcTimestamp(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}
