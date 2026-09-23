/**
 * CSV for the feedback export. Feedback text is written by anyone on the internet, so a
 * cell starting with = + - @ (or a tab/return) is prefixed with a quote: spreadsheet
 * programs would otherwise run it as a formula when the file is opened.
 */

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
