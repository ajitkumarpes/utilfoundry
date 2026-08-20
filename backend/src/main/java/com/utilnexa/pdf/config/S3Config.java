package com.utilnexa.pdf.config;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3Config {

  @Bean
  public S3Client s3Client(
      @Value("${app.s3.endpoint}") String endpoint,
      @Value("${app.s3.access-key}") String accessKey,
      @Value("${app.s3.secret-key}") String secretKey) {
    return S3Client.builder()
        .endpointOverride(URI.create(endpoint))
        .credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
        .region(Region.US_EAST_1)
        // MinIO does not do virtual-hosted-style bucket addressing; without this the client
        // fails with a confusing DNS lookup error rather than an obvious one.
        .forcePathStyle(true)
        .build();
  }
}
