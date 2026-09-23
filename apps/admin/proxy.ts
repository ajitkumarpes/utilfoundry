import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/csrf";
import { sessionCookieName, verifySessionToken } from "@/lib/session";

/**
 * Runs before every page and admin API call:
 *  - pages get a fresh CSP nonce, so only this app's own scripts can run;
 *  - /admin and /api/admin require a valid session (the login screen and endpoint excepted);
 *  - state-changing admin API calls must come from this site's own pages (CSRF).
 * The public /api/feedback, /api/visit and /api/health endpoints pass straight through.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin/");
  if (pathname.startsWith("/api/") && !isAdminApi) return NextResponse.next();

  if (isAdminApi && !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }

  const isPublic = pathname === "/admin/login" || pathname === "/api/admin/login";
  const authenticated = verifySessionToken(request.cookies.get(sessionCookieName())?.value);

  if (!isPublic && !authenticated && (isAdminApi || pathname.startsWith("/admin"))) {
    if (isAdminApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/admin/login" && authenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Prefetches still pass the session check above; they only skip the nonce, which is
  // generated for full page loads.
  if (isAdminApi || request.headers.get("next-router-prefetch")) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Style attributes (chart bar heights) cannot carry a nonce; styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Deliberately no `missing: [prefetch headers]` exclusion: that header is set by the client,
// so excluding it would let anyone skip the session check by sending it.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"]
};
