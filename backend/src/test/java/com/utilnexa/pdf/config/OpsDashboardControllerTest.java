package com.utilnexa.pdf.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;

class OpsDashboardControllerTest {

  private final OpsDashboardController controller = new OpsDashboardController();

  @Test
  void servesDashboardWithSecurityHeaders() {
    ResponseEntity<Resource> response = controller.dashboard();

    assertEquals(200, response.getStatusCode().value());
    assertTrue(response.getHeaders().getContentType().toString().startsWith("text/html"));
    assertEquals("no-store", response.getHeaders().getCacheControl());
    assertTrue(response.getHeaders().getFirst("Content-Security-Policy").contains("default-src 'self'"));
    assertNotNull(response.getBody());
    assertTrue(response.getBody().exists());
  }

  @Test
  void servesExternalCssAndJavascriptAssets() {
    assertTrue(controller.stylesheet().getBody().exists());
    assertTrue(controller.script().getBody().exists());
  }
}
