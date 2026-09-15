package com.utilnexa.pdf.config;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {

  @Bean
  public S3Client s3Client(
      @Value("${app.s3.endpoint}") String endpoint,
      @Value("${app.s3.access-key}") String accessKey,
      @Value("${app.s3.secret-key}") String secretKey) {
    return S3Client.builder()
        .endpointOverride(URI.create(endpoint))
        .credentialsProvider(credentials(accessKey, secretKey))
        .region(Region.US_EAST_1)
        // MinIO does not do virtual-hosted-style bucket addressing; without this the client
        // fails with a confusing DNS lookup error rather than an obvious one.
        .forcePathStyle(true)
        .build();
  }

  @Bean
  public S3Presigner s3Presigner(
      @Value("${app.s3.public-endpoint}") String publicEndpoint,
      @Value("${app.s3.access-key}") String accessKey,
      @Value("${app.s3.secret-key}") String secretKey) {
    return S3Presigner.builder()
        // Deliberately the browser-reachable endpoint, not app.s3.endpoint (the S3Client bean
        // above uses that one for server-to-server calls, which inside docker compose is the
        // internal `minio` hostname a browser could never resolve) - see application.yml's
        // comment on app.s3.public-endpoint.
        .endpointOverride(URI.create(publicEndpoint))
        .credentialsProvider(credentials(accessKey, secretKey))
        .region(Region.US_EAST_1)
        // Same path-style requirement as the S3Client above - a presigner built without this
        // signs a virtual-hosted-style URL MinIO will never match, which fails at download
        // time rather than at startup, so it's easy to miss without this being explicit.
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .build();
  }

  private AwsCredentialsProvider credentials(String accessKey, String secretKey) {
    return StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
  }
}
