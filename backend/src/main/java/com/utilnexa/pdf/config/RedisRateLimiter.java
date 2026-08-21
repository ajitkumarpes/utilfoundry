package com.utilnexa.pdf.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Shared across every backend instance via Redis (see {@link RateLimiterConfig}), so the
 * configured limit is a real ceiling regardless of how many replicas are running - a
 * ConcurrentHashMap-backed limiter, the previous approach, gives each replica its own
 * independent budget instead of a shared one. */
@Component
public class RedisRateLimiter implements RateLimiter {

  private static final Logger log = LoggerFactory.getLogger(RedisRateLimiter.class);

  private final ProxyManager<String> proxyManager;
  private final int requestsPerMinute;

  public RedisRateLimiter(
      ProxyManager<String> proxyManager,
      @Value("${app.rate-limit.requests-per-minute}") int requestsPerMinute) {
    this.proxyManager = proxyManager;
    this.requestsPerMinute = requestsPerMinute;
  }

  @Override
  public boolean tryConsume(String key) {
    try {
      BucketProxy bucket = proxyManager.builder().build(key, this::configuration);
      return bucket.tryConsume(1);
    } catch (RuntimeException e) {
      // Fail open, not closed. Most of this app's tools (merge, split, compress, ...) are pure
      // in-memory PDFBox work with no Redis dependency of their own - a Redis outage should not
      // take those down too just because the rate limiter can no longer be consulted. Logged at
      // WARN so a sustained outage is still visible, not silently masked.
      log.warn("Rate limiter could not reach Redis - allowing the request through unlimited.", e);
      return true;
    }
  }

  private BucketConfiguration configuration() {
    return BucketConfiguration.builder()
        .addLimit(Bandwidth.simple(requestsPerMinute, Duration.ofMinutes(1)))
        .build();
  }
}
