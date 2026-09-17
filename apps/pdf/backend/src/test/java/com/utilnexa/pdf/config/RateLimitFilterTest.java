package com.utilnexa.pdf.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

  /** A fixed per-key call budget with no time-based refill - every test here is a single fast,
   * synchronous burst, so a real Bucket4j clock is unnecessary; this only needs to prove
   * RateLimitFilter's own IP-resolution and 429 logic, not re-prove Bucket4j's own algorithm. */
  private static RateLimiter fakeLimiter(int limit) {
    Map<String, AtomicInteger> counts = new ConcurrentHashMap<>();
    return key -> counts.computeIfAbsent(key, k -> new AtomicInteger(0)).incrementAndGet() <= limit;
  }

  @Test
  void allowsRequestsUpToTheLimitThenBlocks() throws Exception {
    RateLimitFilter filter = new RateLimitFilter(fakeLimiter(2), false);
    AtomicInteger passedThrough = new AtomicInteger(0);

    for (int i = 0; i < 3; i++) {
      MockHttpServletRequest request = apiRequest("203.0.113.10");
      MockHttpServletResponse response = new MockHttpServletResponse();
      filter.doFilter(request, response, (req, res) -> passedThrough.incrementAndGet());
      if (i < 2) {
        assertEquals(200, response.getStatus());
      } else {
        assertEquals(429, response.getStatus());
      }
    }

    assertEquals(2, passedThrough.get());
  }

  @Test
  void differentIpsGetIndependentLimits() throws Exception {
    RateLimitFilter filter = new RateLimitFilter(fakeLimiter(1), false);

    MockHttpServletRequest first = apiRequest("203.0.113.10");
    MockHttpServletResponse firstResponse = new MockHttpServletResponse();
    filter.doFilter(first, firstResponse, (req, res) -> {});
    assertEquals(200, firstResponse.getStatus());

    MockHttpServletRequest second = apiRequest("203.0.113.20");
    MockHttpServletResponse secondResponse = new MockHttpServletResponse();
    filter.doFilter(second, secondResponse, (req, res) -> {});
    assertEquals(200, secondResponse.getStatus());
  }

  @Test
  void nonApiPathsAreNotRateLimited() throws Exception {
    RateLimitFilter filter = new RateLimitFilter(fakeLimiter(1), false);
    AtomicInteger passedThrough = new AtomicInteger(0);

    for (int i = 0; i < 5; i++) {
      MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
      request.setRemoteAddr("203.0.113.10");
      MockHttpServletResponse response = new MockHttpServletResponse();
      filter.doFilter(request, response, (req, res) -> passedThrough.incrementAndGet());
    }

    assertEquals(5, passedThrough.get());
  }

  @Test
  void ignoresForwardedForHeaderWhenNotTrusted() throws Exception {
    RateLimitFilter filter = new RateLimitFilter(fakeLimiter(1), false);

    MockHttpServletRequest first = apiRequest("203.0.113.10");
    first.addHeader("X-Forwarded-For", "198.51.100.1");
    MockHttpServletResponse firstResponse = new MockHttpServletResponse();
    filter.doFilter(first, firstResponse, (req, res) -> {});
    assertEquals(200, firstResponse.getStatus());

    // Same actual remote address, spoofed forwarded-for should not grant a separate bucket.
    MockHttpServletRequest second = apiRequest("203.0.113.10");
    second.addHeader("X-Forwarded-For", "198.51.100.2");
    MockHttpServletResponse secondResponse = new MockHttpServletResponse();
    filter.doFilter(second, secondResponse, (req, res) -> {});
    assertEquals(429, secondResponse.getStatus());
  }

  @Test
  void jobStatusAndDownloadDrawOnTheirOwnAllowance() throws Exception {
    Map<String, Integer> limits = new ConcurrentHashMap<>();
    Map<String, AtomicInteger> counts = new ConcurrentHashMap<>();
    RateLimiter limiter = new RateLimiter() {
      @Override
      public boolean tryConsume(String key) {
        return tryConsume(key, 1);
      }

      @Override
      public boolean tryConsume(String key, int perMinute) {
        limits.put(key, perMinute);
        return counts.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet() <= perMinute;
      }
    };
    RateLimitFilter filter = new RateLimitFilter(limiter, false, 3);

    MockHttpServletResponse upload = new MockHttpServletResponse();
    filter.doFilter(apiRequest("203.0.113.10"), upload, (req, res) -> {});
    assertEquals(200, upload.getStatus());
    MockHttpServletResponse secondUpload = new MockHttpServletResponse();
    filter.doFilter(apiRequest("203.0.113.10"), secondUpload, (req, res) -> {});
    assertEquals(429, secondUpload.getStatus(), "the upload allowance is spent");

    for (String path : new String[] {"/api/v1/pdf/jobs/abc", "/api/v1/pdf/jobs/abc", "/api/v1/pdf/jobs/abc/download"}) {
      MockHttpServletRequest read = new MockHttpServletRequest("GET", path);
      read.setRemoteAddr("203.0.113.10");
      MockHttpServletResponse response = new MockHttpServletResponse();
      filter.doFilter(read, response, (req, res) -> {});
      assertEquals(200, response.getStatus(), path + " is still allowed");
    }
    assertEquals(3, limits.get("job-read:203.0.113.10"));

    MockHttpServletRequest submit = new MockHttpServletRequest("POST", "/api/v1/pdf/jobs/abc");
    submit.setRemoteAddr("203.0.113.10");
    MockHttpServletResponse submitResponse = new MockHttpServletResponse();
    filter.doFilter(submit, submitResponse, (req, res) -> {});
    assertEquals(429, submitResponse.getStatus(), "only GET reads are exempt from the upload allowance");
  }

  private MockHttpServletRequest apiRequest(String remoteAddr) {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/pdf/merge");
    request.setRemoteAddr(remoteAddr);
    return request;
  }
}
