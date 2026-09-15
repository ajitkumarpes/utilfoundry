package com.utilnexa.pdf.job;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ContentDisposition;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service
public class S3StorageService {

  // Downloads are consumed within seconds in the normal flow (the UI fetches this URL and
  // triggers the save immediately) and the underlying object is gone within an hour regardless
  // (job retention) - kept short so a leaked URL (browser history, a proxy log) doesn't stay
  // valid for long.
  private static final Duration DOWNLOAD_URL_VALIDITY = Duration.ofMinutes(5);

  private final S3Client s3Client;
  private final S3Presigner s3Presigner;
  private final String bucket;

  public S3StorageService(
      S3Client s3Client, S3Presigner s3Presigner, @Value("${app.s3.bucket}") String bucket) {
    this.s3Client = s3Client;
    this.s3Presigner = s3Presigner;
    this.bucket = bucket;
  }

  public void put(String key, byte[] content, String contentType) {
    s3Client.putObject(
        PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType(contentType == null ? "application/octet-stream" : contentType)
            .build(),
        RequestBody.fromBytes(content));
  }

  public byte[] get(String key) {
    try (ResponseInputStream<GetObjectResponse> response =
        s3Client.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build())) {
      return response.readAllBytes();
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read stored object " + key, e);
    }
  }

  /** A short-lived, directly-downloadable URL - the caller redirects the browser to it rather
   * than proxying the object's bytes back through this service's own JVM. */
  public String presignGet(String key, String filename, String contentType) {
    String disposition = ContentDisposition.attachment().filename(filename).build().toString();

    GetObjectPresignRequest presignRequest =
        GetObjectPresignRequest.builder()
            .signatureDuration(DOWNLOAD_URL_VALIDITY)
            .getObjectRequest(
                b ->
                    b.bucket(bucket)
                        .key(key)
                        .responseContentDisposition(disposition)
                        .responseContentType(contentType))
            .build();

    return s3Presigner.presignGetObject(presignRequest).url().toString();
  }

  public void deleteByPrefix(String prefix) {
    ListObjectsV2Response listing =
        s3Client.listObjectsV2(ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build());

    List<ObjectIdentifier> toDelete =
        listing.contents().stream()
            .map(o -> ObjectIdentifier.builder().key(o.key()).build())
            .collect(Collectors.toList());

    if (toDelete.isEmpty()) return;

    s3Client.deleteObjects(
        DeleteObjectsRequest.builder()
            .bucket(bucket)
            .delete(Delete.builder().objects(toDelete).build())
            .build());
  }
}
