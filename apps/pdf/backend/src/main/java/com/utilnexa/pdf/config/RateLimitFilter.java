package com.utilnexa.pdf.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-client-IP request throttling on /api/**. Blindly trusting X-Forwarded-For lets a caller
 * spoof their rate-limit identity, so {@code trustForwardedFor} stays false wherever this runs
 * without a proxy. The production profile turns it on because Caddy, which fronts this app in
 * deploy/, overwrites the header with the real peer for any untrusted client; with it off
 * behind that proxy every caller on the internet shares one bucket, because the only address
 * {@code getRemoteAddr()} can see is Caddy's own.
 * Limit tracking itself lives behind {@link RateLimiter} - {@link RedisRateLimiter} in
 * production, so the limit is shared across every backend replica rather than per-instance.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

  /** GET /api/v1/pdf/jobs/{id} and its /download: a status lookup and a signed link, no file work. */
  private static final Pattern JOB_READ = Pattern.compile("^/api/v1/pdf/jobs/[^/]+(/download)?$");
  static final int DEFAULT_JOB_READS_PER_MINUTE = 120;

  private final RateLimiter rateLimiter;
  private final boolean trustForwardedFor;
  private final int jobReadsPerMinute;

  @Autowired
  public RateLimitFilter(
      RateLimiter rateLimiter,
      @Value("${app.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor,
      @Value("${app.rate-limit.job-reads-per-minute:" + DEFAULT_JOB_READS_PER_MINUTE + "}") int jobReadsPerMinute) {
    this.rateLimiter = rateLimiter;
    this.trustForwardedFor = trustForwardedFor;
    this.jobReadsPerMinute = jobReadsPerMinute;
  }

  public RateLimitFilter(RateLimiter rateLimiter, boolean trustForwardedFor) {
    this(rateLimiter, trustForwardedFor, DEFAULT_JOB_READS_PER_MINUTE);
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/api/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String client = resolveClientIp(request);
    // Checking on a running job and fetching its result draw on their own, larger allowance.
    // Sharing the upload allowance let a conversion's own status checks run a visitor out of
    // requests, so the finished file's download was refused with a 429.
    boolean allowed = isJobRead(request)
        ? rateLimiter.tryConsume("job-read:" + client, jobReadsPerMinute)
        : rateLimiter.tryConsume(client);
    if (allowed) {
      chain.doFilter(request, response);
    } else {
      response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
      response.setContentType("application/json");
      response.getWriter().write("{\"error\":\"Too many requests. Please slow down and try again shortly.\"}");
    }
  }

  private static boolean isJobRead(HttpServletRequest request) {
    return "GET".equals(request.getMethod()) && JOB_READ.matcher(request.getRequestURI()).matches();
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
