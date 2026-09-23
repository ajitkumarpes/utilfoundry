/** Display helpers shared by the dashboard pages. Server and client both use them. */

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** The flag emoji for a two-letter country code, built from regional indicator letters. */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

export const number = (value: number) => new Intl.NumberFormat("en").format(value);

export function share(value: number, total: number): string {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

/** "Chrome on macOS" from a user-agent string: enough to reproduce a reported issue. */
export function describeBrowser(userAgent: string | null): string {
  if (!userAgent) return "Unknown browser";
  const browser = /edg\//i.test(userAgent) ? "Edge"
    : /opr\/|opera/i.test(userAgent) ? "Opera"
      : /firefox|fxios/i.test(userAgent) ? "Firefox"
        : /chrome|crios/i.test(userAgent) ? "Chrome"
          : /safari/i.test(userAgent) ? "Safari" : "Unknown browser";
  const os = /iphone|ipad|ipod/i.test(userAgent) ? "iOS"
    : /android/i.test(userAgent) ? "Android"
      : /mac os x|macintosh/i.test(userAgent) ? "macOS"
        : /windows/i.test(userAgent) ? "Windows"
          : /linux/i.test(userAgent) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
