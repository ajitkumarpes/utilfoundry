package com.utilnexa.pdf.job;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class JobMaintenanceTaskTest {

  @Mock private JobRepository jobRepository;
  @Mock private S3StorageService storage;

  @Test
  void deletesDatabaseRowOnlyAfterStoredArtifactsAreDeleted() {
    Job job = expiredJob();
    when(jobRepository.findByCreatedAtBefore(any(Instant.class))).thenReturn(List.of(job));

    new JobMaintenanceTask(jobRepository, storage, 1).purgeExpiredJobs();

    verify(storage).deleteByPrefix("jobs/" + job.getId() + "/");
    verify(jobRepository).deleteAll(List.of(job));
  }

  @Test
  void retainsDatabaseRowWhenArtifactDeletionFailsSoCleanupCanRetry() {
    Job job = expiredJob();
    when(jobRepository.findByCreatedAtBefore(any(Instant.class))).thenReturn(List.of(job));
    org.mockito.Mockito.doThrow(new IllegalStateException("storage unavailable"))
        .when(storage)
        .deleteByPrefix("jobs/" + job.getId() + "/");

    new JobMaintenanceTask(jobRepository, storage, 1).purgeExpiredJobs();

    verify(jobRepository, never()).deleteAll(any());
  }

  private static Job expiredJob() {
    Job job = new Job();
    job.setId(UUID.randomUUID());
    job.setType(JobType.OCR);
    job.setStatus(JobStatus.SUCCEEDED);
    job.setInputKey("jobs/input.pdf");
    job.setOriginalFilename("input.pdf");
    job.setCreatedAt(Instant.now().minusSeconds(7200));
    job.setUpdatedAt(job.getCreatedAt());
    return job;
  }
}
