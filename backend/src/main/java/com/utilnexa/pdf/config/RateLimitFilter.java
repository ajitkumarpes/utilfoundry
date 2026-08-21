package com.utilnexa.pdf.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-client-IP request throttling on /api/**. {@code trustForwardedFor} defaults to false
 * (uses {@code getRemoteAddr()}) because blindly trusting X-Forwarded-For lets a caller spoof
 * their rate-limit identity unless a trusted reverse proxy is actually the one setting it —
 * flip it on only once this sits behind a proxy that overwrites/strips client-supplied values.
 * Limit tracking itself lives behind {@link RateLimiter} - {@link RedisRateLimiter} in
 * production, so the limit is shared across every backend replica rather than per-instance.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

  private final RateLimiter rateLimiter;
  private final boolean trustForwardedFor;

  public RateLimitFilter(
      RateLimiter rateLimiter,
      @Value("${app.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor) {
    this.rateLimiter = rateLimiter;
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
    if (rateLimiter.tryConsume(resolveClientIp(request))) {
      chain.doFilter(request, response);
    } else {
      response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
      response.setContentType("application/json");
      response.getWriter().write("{\"error\":\"Too many requests. Please slow down and try again shortly.\"}");
    }
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
}
