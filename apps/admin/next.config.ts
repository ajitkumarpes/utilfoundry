import type { NextConfig } from "next";

/**
 * Headers for every response. The Content-Security-Policy is not here: it carries a fresh
 * nonce per page load, so proxy.ts sets it.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["geoip-lite"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        // The public beacon endpoints are read by the sibling UtilFoundry subdomains, which are same-site.
        { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" }
      ]
    }];
  }
};

export default nextConfig;
