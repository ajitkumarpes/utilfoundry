package com.utilnexa.pdf.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

@Component
public class ObjectStorageHealthIndicator implements HealthIndicator {

  private final S3Client s3Client;
  private final String bucket;

  public ObjectStorageHealthIndicator(
      S3Client s3Client, @Value("${app.s3.bucket}") String bucket) {
    this.s3Client = s3Client;
    this.bucket = bucket;
  }

  @Override
  public Health health() {
    try {
      s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
      return Health.up().withDetail("service", "S3-compatible object storage").build();
    } catch (Exception e) {
      return Health.down().withException(e).build();
    }
  }
}
