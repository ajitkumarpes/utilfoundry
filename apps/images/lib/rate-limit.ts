/**
 * Per-client throttling for /api/process, the only path here that costs real CPU:
 * Sharp re-encodes, and the OCR and model runs in the worker behind it.
 *
 * Two buckets, because the costs are an order of magnitude apart. The batch tools
 * send one request per image and allow twenty at a time, so a general limit tight
 * enough to matter would break the app's own documented workflow; the worker tools
 * take a single file each and are the expensive ones, so they get their own much
 * tighter budget on top of the general one.
 *
 * State lives in memory on purpose: this app runs as a single container with no
 * Redis, so a shared store would be infrastructure the deployment does not have.
 * The map is bounded — its keys come from client addresses and must not be able to
 * grow memory without limit.
 */

const WINDOW_MS = 60_000;

/** Beyond this many tracked clients in one window, the limiter stops admitting new ones. */
const MAX_TRACKED_CLIENTS = 5_000;

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const GENERAL_LIMIT = positiveInt(process.env.RATE_LIMIT_PER_MINUTE, 120);
export const WORKER_LIMIT = positiveInt(process.env.RATE_LIMIT_WORKER_PER_MINUTE, 12);

export type Decision = { allowed: boolean; retryAfterSeconds: number };

const ALLOWED: Decision = { allowed: true, retryAfterSeconds: 0 };

/** A fixed set of request timestamps per client, trimmed to the trailing window. */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: number) {}

  /** Exposed so the route can report how many clients are being tracked in tests. */
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
      // Still full after pruning: refuse rather than let the map grow. A flood of
      // distinct addresses is the case this protects against, and admitting it
      // unthrottled would defeat the limiter it is part of.
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
 * Who to count this request against.
 *
 * X-Forwarded-For is the only client identity a Next route handler can see. It is
 * trustworthy here because Caddy, which fronts this app in deploy/, overwrites the
 * header with the real peer for any client outside its `trusted_proxies` — measured
 * against caddy:2.10-alpine, where a request carrying a forged X-Forwarded-For
 * arrives upstream with the forgery discarded. Exposing this app to the internet
 * without such a proxy would let a caller choose its own rate-limit identity.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "direct";
}
