/**
 * Number formatting with the locale pinned.
 *
 * These counts are rendered on the server and then again in the browser during
 * hydration. `toLocaleString()` with no locale argument uses the server's locale for
 * the first pass and the visitor's for the second, so a reader in India hydrates
 * "5,00,000" onto a server-rendered "500,000" and React throws a hydration mismatch
 * and discards the markup. A fixed locale makes both passes agree; en-GB is the one
 * the rest of this app already formats dates and times with.
 */
export const COUNT_LOCALE = "en-GB";

export const formatCount = (value: number) => value.toLocaleString(COUNT_LOCALE);
