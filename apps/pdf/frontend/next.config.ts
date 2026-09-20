import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

/** The API may live on another origin (http://localhost:8091 in local compose), so allow it for fetch. */
function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091").origin;
  } catch {
    return "";
  }
}

// The feedback widget and visit beacon fetch() this origin directly, which CSP's
// connect-src must allow explicitly — it does not fall under 'self'.
function adminOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.utilfoundry.com").origin;
  } catch {
    return "https://admin.utilfoundry.com";
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  // Page thumbnails are canvas renders turned into data: URLs; results are blob: downloads.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // The theme is set by an inline script before first paint, so the page never flashes.
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  // pdf.js renders thumbnails in a module worker served from this origin.
  "worker-src 'self' blob:",
  `connect-src 'self' ${apiOrigin()} ${adminOrigin()}${isDevelopment ? " ws: http://localhost:*" : ""}`.trim()
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  }
};

export default nextConfig;
