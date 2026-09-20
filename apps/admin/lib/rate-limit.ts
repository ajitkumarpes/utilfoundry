/**
 * Per-client throttling for the public /api/feedback and /api/visit endpoints, which
 * accept unauthenticated requests from four different sites.
 *
 * State lives in memory on purpose: this service runs as a single container with no
 * Redis, so a shared store would be infrastructure the deployment does not have (same
 * choice apps/images made for its own /api/process limiter). The map is bounded — its
 * keys come from client addresses and must not be able to grow memory without limit.
 */

const WINDOW_MS = 60_000;

/** Beyond this many tracked clients in one window, the limiter stops admitting new ones. */
const MAX_TRACKED_CLIENTS = 5_000;

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const FEEDBACK_LIMIT = positiveInt(process.env.RATE_LIMIT_FEEDBACK_PER_MINUTE, 10);
export const VISIT_LIMIT = positiveInt(process.env.RATE_LIMIT_VISIT_PER_MINUTE, 60);
export const LOGIN_LIMIT = positiveInt(process.env.RATE_LIMIT_LOGIN_PER_MINUTE, 10);

export type Decision = { allowed: boolean; retryAfterSeconds: number };

const ALLOWED: Decision = { allowed: true, retryAfterSeconds: 0 };

/** A fixed set of request timestamps per client, trimmed to the trailing window. */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: number) {}

  /** Exposed so tests can report how many clients are being tracked. */
  get size() {
    return this.hits.size;
  }

  take(key: string, now = Date.now()): Decision {
    const cutoff = now - WINDOW_MS;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > cutoff);

    if (recent.length >= this.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] - cutoff) / 1000)) };
    }

    if (!this.hits.has(key) && this.hits.size >= MAX_TRACKED_CLIENTS) {
      this.prune(now);
      if (this.hits.size >= MAX_TRACKED_CLIENTS) return { allowed: false, retryAfterSeconds: 60 };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return ALLOWED;
  }

  /** Drops clients whose last request has aged out, so idle keys do not accumulate. */
  prune(now = Date.now()) {
    const cutoff = now - WINDOW_MS;
    for (const [key, times] of this.hits) {
      if (!times.some((at) => at > cutoff)) this.hits.delete(key);
    }
  }
}

/**
 * Who to count this request against, and the same identity used to resolve GeoIP for
 * /api/visit. Trustworthy because Caddy, which fronts this service in deploy/, sets
 * X-Forwarded-For itself for any client outside its trusted proxies — the same trust
 * model apps/images and apps/pdf/backend already rely on for their own limiters.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "direct";
}
