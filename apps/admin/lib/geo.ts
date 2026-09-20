import geoip from "geoip-lite";

export type GeoInfo = { country: string | null; region: string | null; city: string | null };

const EMPTY: GeoInfo = { country: null, region: null, city: null };

/**
 * Country/region/city for a client address, resolved from the bundled GeoLite2-style
 * database inside the geoip-lite package — no network call, no third party ever sees
 * a visitor's IP. The IP itself is never returned or stored; only this derived,
 * coarse location is.
 */
export function lookupGeo(ip: string): GeoInfo {
  if (!ip || ip === "direct") return EMPTY;
  const result = geoip.lookup(ip);
  if (!result) return EMPTY;
  return { country: result.country || null, region: result.region || null, city: result.city || null };
}
