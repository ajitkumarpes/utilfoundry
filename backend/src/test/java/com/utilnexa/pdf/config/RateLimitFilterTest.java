package com.utilnexa.pdf.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

  @Test
  void allowsRequestsUpToTheLimitThenBlocks() throws Exception {
    RateLimitFilter filter = new RateLimitFilter(2, false);
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
    RateLimitFilter filter = new RateLimitFilter(1, false);

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
    RateLimitFilter filter = new RateLimitFilter(1, false);
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
    RateLimitFilter filter = new RateLimitFilter(1, false);

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

  private MockHttpServletRequest apiRequest(String remoteAddr) {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/pdf/merge");
    request.setRemoteAddr(remoteAddr);
    return request;
  }
}
