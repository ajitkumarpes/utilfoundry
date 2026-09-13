package com.utilnexa.pdf.job;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import tools.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JobDispatcherTest {

  private JobRepository repository;
  private S3StorageService storage;
  private ProcessorClient processor;
  private JobDispatcher dispatcher;

  @BeforeEach
  void setUp() {
    repository = mock(JobRepository.class);
    storage = mock(S3StorageService.class);
    processor = mock(ProcessorClient.class);
    dispatcher = new JobDispatcher(repository, storage, processor, new ObjectMapper(), 1);
  }

  @Test
  void processesOnlyAnAtomicallyClaimedJob() {
    Job job = job(JobStatus.PROCESSING);
    when(repository.findById(job.getId())).thenReturn(Optional.of(job));
    when(storage.get(job.getInputKey())).thenReturn("input".getBytes());
    when(processor.officeConvert(
            any(byte[].class), eq("report.docx"), eq("pdf"), any(Duration.class)))
        .thenReturn("output".getBytes());

    dispatcher.processOne(job.getId());

    assertEquals(JobStatus.SUCCEEDED, job.getStatus());
    verify(storage).put(
        eq("jobs/" + job.getId() + "/output/result"),
        any(byte[].class),
        eq("application/octet-stream"));
    verify(repository).save(job);
  }

  @Test
  void ignoresAJobThatWasNotClaimedByThisWorker() {
    Job job = job(JobStatus.QUEUED);
    when(repository.findById(job.getId())).thenReturn(Optional.of(job));

    dispatcher.processOne(job.getId());

    verify(storage, never()).get(any());
    verify(repository, never()).save(any());
  }

  private Job job(JobStatus status) {
    Job job = new Job();
    job.setId(UUID.randomUUID());
    job.setType(JobType.WORD_TO_PDF);
    job.setStatus(status);
    job.setInputKey("jobs/input");
    job.setOriginalFilename("report.docx");
    job.setAttempts((short) 0);
    job.setCreatedAt(Instant.now());
    job.setUpdatedAt(Instant.now());
    return job;
  }
}
