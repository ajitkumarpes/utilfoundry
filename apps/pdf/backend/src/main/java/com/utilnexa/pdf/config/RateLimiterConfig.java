package com.utilnexa.pdf.config;

import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ClientSideConfig;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;

import io.lettuce.core.ClientOptions;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.SocketOptions;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RateLimiterConfig {

  // RedisRateLimiter falls back locally on any exception, but that only helps if Redis being down
  // actually throws promptly. Measured live: with Lettuce's own defaults, a stopped Redis
  // container left two concurrent requests hanging for roughly two minutes (queued, waiting for
  // reconnection) before they finally reached the fallback - graceful degradation in name only
  // at that point, since
  // request threads pile up for the same length of time either way. Short-circuited here instead
  // of trusting the defaults: a short command timeout for the first request that hits the outage
  // before Lettuce has noticed, and REJECT_COMMANDS so every request after that fails instantly
  // once it has.
  private static final Duration REDIS_TIMEOUT = Duration.ofMillis(300);

  @Bean(destroyMethod = "shutdown")
  public RedisClient rateLimiterRedisClient(
      // Same defaults Spring Data Redis's own auto-configuration falls back to when these are
      // unset (true in this app's base, non-docker profile - application-docker.yml is the only
      // place that sets them explicitly) - matched here so this client points at the same Redis
      // the job queue does in every profile, not just the docker one.
      @Value("${spring.data.redis.host:localhost}") String host,
      @Value("${spring.data.redis.port:6379}") int port) {
    // A plain Lettuce client, deliberately separate from Spring Data Redis's own
    // LettuceConnectionFactory (used by the job queue) - bucket4j-redis drives Lettuce directly
    // and needs its own client, not Spring Data's higher-level abstraction over it. Same
    // host/port properties either way, so it's still one Redis, just two client handles onto it.
    RedisURI uri =
        RedisURI.builder()
            .withHost(host)
            .withPort(port)
            .withTimeout(REDIS_TIMEOUT)
            .build();
    RedisClient client = RedisClient.create(uri);
    client.setOptions(
        ClientOptions.builder()
            .socketOptions(SocketOptions.builder().connectTimeout(REDIS_TIMEOUT).build())
            .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
            .build());
    return client;
  }

  @Bean
  public ProxyManager<String> rateLimiterProxyManager(RedisClient redisClient) {
    ClientSideConfig clientSideConfig =
        ClientSideConfig.getDefault()
            .withExpirationAfterWriteStrategy(
                ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(
                    Duration.ofMinutes(1)));
    LettuceBasedProxyManager<byte[]> byteKeyed =
        LettuceBasedProxyManager.builderFor(redisClient)
            // TTL = time for this bucket to fully refill its consumed tokens, plus this Duration
            // as jitter on top (confirmed against bucket4j's docs, not guessed from the method
            // name - a fully-drained 20-per-minute bucket measured ~107s live, matching ~60s
            // natural refill + ~60s of this jitter, not 60s flat). Lets Redis expire a client's
            // key on its own rather than a scheduled sweep running in every replica; the jitter
            // just avoids recreating a bucket seconds after it would have expired anyway.
            .withClientSideConfig(clientSideConfig)
            .build();
    return byteKeyed.withMapper(key -> key.getBytes(StandardCharsets.UTF_8));
  }
}
