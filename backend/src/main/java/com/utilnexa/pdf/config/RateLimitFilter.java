package com.utilnexa.pdf.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-client-IP request throttling on /api/**. {@code trustForwardedFor} defaults to false
 * (uses {@code getRemoteAddr()}) because blindly trusting X-Forwarded-For lets a caller spoof
 * their rate-limit identity unless a trusted reverse proxy is actually the one setting it —
 * flip it on only once this sits behind a proxy that overwrites/strips client-supplied values.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

  private static final long IDLE_EVICTION_MILLIS = 10 * 60 * 1000;

  private final int requestsPerMinute;
  private final boolean trustForwardedFor;
  private final ConcurrentHashMap<String, Entry> buckets = new ConcurrentHashMap<>();

  public RateLimitFilter(
      @Value("${app.rate-limit.requests-per-minute}") int requestsPerMinute,
      @Value("${app.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor) {
    this.requestsPerMinute = requestsPerMinute;
    this.trustForwardedFor = trustForwardedFor;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/api/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    Entry entry = buckets.computeIfAbsent(resolveClientIp(request), ip -> new Entry(newBucket()));
    entry.lastAccessMillis = System.currentTimeMillis();

    if (entry.bucket.tryConsume(1)) {
      chain.doFilter(request, response);
    } else {
      response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
      response.setContentType("application/json");
      response.getWriter().write("{\"error\":\"Too many requests. Please slow down and try again shortly.\"}");
    }
  }

  private Bucket newBucket() {
    return Bucket.builder()
        .addLimit(Bandwidth.simple(requestsPerMinute, Duration.ofMinutes(1)))
        .build();
  }

  private String resolveClientIp(HttpServletRequest request) {
    if (trustForwardedFor) {
      String forwarded = request.getHeader("X-Forwarded-For");
      if (forwarded != null && !forwarded.isBlank()) {
        return forwarded.split(",")[0].trim();
      }
    }
    return request.getRemoteAddr();
  }

  @Scheduled(fixedDelay = 5 * 60 * 1000)
  void evictIdleBuckets() {
    long cutoff = System.currentTimeMillis() - IDLE_EVICTION_MILLIS;
    buckets.entrySet().removeIf(e -> e.getValue().lastAccessMillis < cutoff);
  }

  private static final class Entry {
    final Bucket bucket;
    volatile long lastAccessMillis = System.currentTimeMillis();

    Entry(Bucket bucket) {
      this.bucket = bucket;
    }
  }
}
