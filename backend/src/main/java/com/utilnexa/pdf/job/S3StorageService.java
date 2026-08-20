package com.utilnexa.pdf.job;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
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

@Service
public class S3StorageService {

  private final S3Client s3Client;
  private final String bucket;

  public S3StorageService(S3Client s3Client, @Value("${app.s3.bucket}") String bucket) {
    this.s3Client = s3Client;
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
