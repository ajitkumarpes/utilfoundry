package com.utilnexa.pdf.job;

import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Talks to the processor shim (Python/FastAPI, running Tesseract/ocrmypdf and LibreOffice).
 * The shim is a pure stateless executor: bytes in, bytes out, no knowledge of jobs/queues.
 */
@Component
public class ProcessorClient {

  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);

  private final String baseUrl;

  public ProcessorClient(@Value("${app.processor.base-url}") String baseUrl) {
    this.baseUrl = baseUrl;
  }

  public byte[] ocr(byte[] content, String filename, String language, Duration readTimeout) {
    return call("/process/ocr", content, filename, "language", language, readTimeout);
  }

  public byte[] officeConvert(
      byte[] content, String filename, String targetFormat, Duration readTimeout) {
    return call("/process/office-convert", content, filename, "target_format", targetFormat, readTimeout);
  }

  private byte[] call(
      String path,
      byte[] content,
      String filename,
      String paramName,
      String paramValue,
      Duration readTimeout) {
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    body.add("file", namedResource(content, filename));
    body.add(paramName, paramValue);

    try {
      return buildClient(readTimeout)
          .post()
          .uri(path)
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .body(body)
          .retrieve()
          .body(byte[].class);
    } catch (HttpClientErrorException e) {
      // The shim explicitly rejected this input (4xx) - permanent, never retried.
      throw new PermanentProcessingException(extractMessage(e));
    }
    // HttpServerErrorException / ResourceAccessException (connection refused, timeout, shim
    // crashed mid-request) propagate as-is and are treated as transient by JobDispatcher.
  }

  private ByteArrayResource namedResource(byte[] content, String filename) {
    return new ByteArrayResource(content) {
      @Override
      public String getFilename() {
        return filename;
      }
    };
  }

  private String extractMessage(HttpClientErrorException e) {
    try {
      Map<?, ?> body = e.getResponseBodyAs(Map.class);
      Object detail = body == null ? null : body.get("detail");
      return detail != null ? detail.toString() : e.getMessage();
    } catch (Exception parseFailure) {
      return e.getMessage();
    }
  }

  private RestClient buildClient(Duration readTimeout) {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout((int) CONNECT_TIMEOUT.toMillis());
    factory.setReadTimeout((int) readTimeout.toMillis());
    return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
  }
}
