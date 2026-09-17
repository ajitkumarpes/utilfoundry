package com.utilnexa.pdf.config;

/** Whether a caller may take one more action right now, keyed however the caller likes (this
 * app keys by client IP). Kept separate from {@link RateLimitFilter} so the filter's request
 * handling (IP resolution, 429 response) stays independent of how/where limits are tracked. */
public interface RateLimiter {

  boolean tryConsume(String key);

  /** The same, with a per-minute allowance other than the configured default for this key. */
  default boolean tryConsume(String key, int requestsPerMinute) {
    return tryConsume(key);
  }
}
