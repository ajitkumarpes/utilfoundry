package com.utilnexa.pdf.config;

import io.swagger.v3.oas.annotations.Hidden;
import java.util.Objects;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Human-friendly local operations dashboard. Actuator remains the machine-readable source. */
@Hidden
@Controller
@ConditionalOnProperty(name = "app.ops.enabled", havingValue = "true", matchIfMissing = true)
public class OpsDashboardController {

  private static final String CONTENT_SECURITY_POLICY =
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
          + "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

  @GetMapping(value = {"/ops", "/ops/"}, produces = MediaType.TEXT_HTML_VALUE)
  public ResponseEntity<Resource> dashboard() {
    return response("ops/index.html", MediaType.TEXT_HTML);
  }

  @GetMapping(value = "/ops/assets/ops.css", produces = "text/css")
  public ResponseEntity<Resource> stylesheet() {
    return response("ops/ops.css", MediaType.parseMediaType("text/css"));
  }

  @GetMapping(value = "/ops/assets/ops.js", produces = "text/javascript")
  public ResponseEntity<Resource> script() {
    return response("ops/ops.js", MediaType.parseMediaType("text/javascript"));
  }

  private ResponseEntity<Resource> response(String path, MediaType mediaType) {
    Resource resource = new ClassPathResource(path);
    if (!resource.exists()) {
      throw new IllegalStateException("Missing operations dashboard resource: " + path);
    }
    return ResponseEntity.ok()
        .contentType(mediaType)
        .cacheControl(CacheControl.noStore())
        .header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        .header("X-Content-Type-Options", "nosniff")
        .header("Referrer-Policy", "no-referrer")
        .body(Objects.requireNonNull(resource));
  }
}
