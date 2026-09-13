package com.utilnexa.pdf.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ProcessorHealthIndicator implements HealthIndicator {

  private static final Duration TIMEOUT = Duration.ofSeconds(2);

  private final RestClient restClient;

  public ProcessorHealthIndicator(@Value("${app.processor.base-url}") String baseUrl) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout((int) TIMEOUT.toMillis());
    requestFactory.setReadTimeout((int) TIMEOUT.toMillis());
    this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
  }

  @Override
  public Health health() {
    try {
      ProcessorHealth response = restClient.get().uri("/health").retrieve().body(ProcessorHealth.class);
      if (response != null && "ok".equalsIgnoreCase(response.status())) {
        return Health.up().withDetail("service", "document processor").build();
      }
      return Health.down().withDetail("reason", "Unexpected processor response").build();
    } catch (Exception e) {
      return Health.down().withException(e).build();
    }
  }

  private record ProcessorHealth(String status) {}
}
