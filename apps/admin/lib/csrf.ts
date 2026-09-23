/**
 * Cross-site request forgery guard for the admin API. The session cookie is SameSite=Lax,
 * which already keeps it off cross-site POSTs in current browsers; this checks the request
 * really came from this site's own pages as well, so the protection does not rest on one
 * browser feature alone.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSameOriginRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;

  // Sent by every current browser; "same-origin" is the only acceptable value for a POST here.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
