package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Mandatory canary per the Round 2 plan: code review alone ("the resolver should block this") is
 * not sufficient evidence this repo accepts — a documented openhtmltopdf issue
 * (github.com/danfickle/openhtmltopdf/issues/444) describes a resource-loading path that bypassed
 * the configured resolver. This spins up a real local listener and asserts, with observed
 * evidence, that HTML referencing it via an &lt;img&gt;, a stylesheet &lt;link&gt;, and an
 * {@code @font-face} all produce zero inbound requests.
 */
class PdfHtmlServiceSsrfTest {

  private final PdfHtmlService service = new PdfHtmlService();
  private HttpServer server;
  private final AtomicInteger requestCount = new AtomicInteger();
  private final List<String> requestedPaths = new CopyOnWriteArrayList<>();
  private int port;

  @BeforeEach
  void startCanaryServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      requestCount.incrementAndGet();
      requestedPaths.add(exchange.getRequestURI().toString());
      byte[] body = "canary".getBytes();
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.start();
    port = server.getAddress().getPort();
  }

  @AfterEach
  void stopCanaryServer() {
    server.stop(0);
  }

  @Test
  void remoteImageStylesheetAndFontProduceZeroInboundRequests() throws Exception {
    String origin = "http://127.0.0.1:" + port;
    String html = "<html><head>"
        + "<link rel=\"stylesheet\" href=\"" + origin + "/style.css\">"
        + "<style>"
        + "@font-face { font-family: 'Evil'; src: url('" + origin + "/font.ttf'); }"
        + "body { font-family: 'Evil', sans-serif; }"
        + "</style>"
        + "</head><body>"
        + "<p>Canary test paragraph.</p>"
        + "<img src=\"" + origin + "/tracking.png\">"
        + "</body></html>";

    byte[] result = service.convert(html, "A4");

    assertTrue(result.length > 0, "expected a non-empty PDF despite the blocked resources");
    assertEquals(0, requestCount.get(),
        "expected zero inbound requests to the canary server, but saw: " + requestedPaths);
  }

  @Test
  void javascriptProtocolImageAlsoProducesZeroInboundRequests() throws Exception {
    byte[] result = service.convert(
        "<p>Before</p><img src=\"javascript:fetch('http://127.0.0.1:" + port + "/x')\"><p>After</p>",
        "A4");

    assertTrue(result.length > 0);
    assertEquals(0, requestCount.get(), "javascript: pseudo-URL must never be fetched or executed");
  }
}
