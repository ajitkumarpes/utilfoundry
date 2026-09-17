package com.utilnexa.pdf.config;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicBoolean;

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
  private static final int MAX_FALLBACK_CLIENTS = 10_000;

  private final ProxyManager<String> proxyManager;
  private final int requestsPerMinute;
  private final ConcurrentMap<String, Bucket> fallbackBuckets = new ConcurrentHashMap<>();
  private final AtomicBoolean redisUnavailable = new AtomicBoolean();

  public RedisRateLimiter(
      ProxyManager<String> proxyManager,
      @Value("${app.rate-limit.requests-per-minute}") int requestsPerMinute) {
    this.proxyManager = proxyManager;
    this.requestsPerMinute = requestsPerMinute;
  }

  @Override
  public boolean tryConsume(String key) {
    return tryConsume(key, requestsPerMinute);
  }

  @Override
  public boolean tryConsume(String key, int perMinute) {
    try {
      BucketProxy bucket = proxyManager.builder().build(key, () -> configuration(perMinute));
      boolean allowed = bucket.tryConsume(1);
      if (redisUnavailable.compareAndSet(true, false)) {
        fallbackBuckets.clear();
        log.info("Distributed rate limiter recovered; emergency local buckets cleared.");
      }
      return allowed;
    } catch (RuntimeException e) {
      // Keep tools available during a Redis outage without silently dropping all abuse
      // protection. This fallback is per replica (the best possible guarantee without shared
      // state), bounded to prevent attacker-controlled client keys from growing memory forever,
      // and discarded as soon as Redis recovers.
      if (redisUnavailable.compareAndSet(false, true)) {
        log.warn("Rate limiter could not reach Redis; using bounded local protection.", e);
      }
      Bucket fallback = fallbackBuckets.get(key);
      if (fallback == null) {
        if (fallbackBuckets.size() >= MAX_FALLBACK_CLIENTS) return false;
        fallback = fallbackBuckets.computeIfAbsent(key, ignored -> newFallbackBucket(perMinute));
      }
      return fallback.tryConsume(1);
    }
  }

  private Bucket newFallbackBucket(int perMinute) {
    return Bucket.builder()
        .addLimit(limit -> limit.capacity(perMinute).refillGreedy(perMinute, Duration.ofMinutes(1)))
        .build();
  }

  private BucketConfiguration configuration(int perMinute) {
    return BucketConfiguration.builder()
        .addLimit(limit -> limit.capacity(perMinute).refillGreedy(perMinute, Duration.ofMinutes(1)))
        .build();
  }
}
