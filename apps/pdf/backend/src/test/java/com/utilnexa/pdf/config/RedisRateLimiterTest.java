package com.utilnexa.pdf.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.distributed.proxy.RemoteBucketBuilder;

import org.junit.jupiter.api.Test;

class RedisRateLimiterTest {

  @SuppressWarnings("unchecked")
  @Test
  void allowsWhenTheBucketHasCapacity() {
    ProxyManager<String> proxyManager = mock(ProxyManager.class);
    RemoteBucketBuilder<String> builder = mock(RemoteBucketBuilder.class);
    BucketProxy bucket = mock(BucketProxy.class);
    when(proxyManager.builder()).thenReturn(builder);
    when(builder.build(any(), any(java.util.function.Supplier.class))).thenReturn(bucket);
    when(bucket.tryConsume(1)).thenReturn(true);

    assertTrue(new RedisRateLimiter(proxyManager, 20).tryConsume("203.0.113.10"));
  }

  @SuppressWarnings("unchecked")
  @Test
  void blocksWhenTheBucketIsExhausted() {
    ProxyManager<String> proxyManager = mock(ProxyManager.class);
    RemoteBucketBuilder<String> builder = mock(RemoteBucketBuilder.class);
    BucketProxy bucket = mock(BucketProxy.class);
    when(proxyManager.builder()).thenReturn(builder);
    when(builder.build(any(), any(java.util.function.Supplier.class))).thenReturn(bucket);
    when(bucket.tryConsume(1)).thenReturn(false);

    assertFalse(new RedisRateLimiter(proxyManager, 20).tryConsume("203.0.113.10"));
  }

  @SuppressWarnings("unchecked")
  @Test
  void fallsBackToBoundedLocalProtectionWhenRedisIsUnreachable() {
    // The timing characteristics of a real outage (how fast this throws, how long recovery
    // takes) are covered by live testing against docker compose, not here - a mocked exception
    // is enough to prove the contract this class actually owns: never let a Redis problem
    // become a 5xx for tools that have nothing to do with Redis.
    ProxyManager<String> proxyManager = mock(ProxyManager.class);
    when(proxyManager.builder()).thenThrow(new RuntimeException("simulated Redis outage"));

    RedisRateLimiter limiter = new RedisRateLimiter(proxyManager, 2);
    assertTrue(limiter.tryConsume("203.0.113.10"));
    assertTrue(limiter.tryConsume("203.0.113.10"));
    assertFalse(limiter.tryConsume("203.0.113.10"));
  }
}
