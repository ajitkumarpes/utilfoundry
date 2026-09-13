package com.utilnexa.pdf.job;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Two housekeeping duties: purge job artifacts past their retention window (this is what
 * actually enforces the "processed privately, removed automatically" promise for async jobs,
 * not just the claim), and reap jobs stuck in PROCESSING because the JVM died mid-job - Postgres
 * is the source of truth, so a dispatcher crash never leaves a job silently stuck forever.
 */
@Component
public class JobMaintenanceTask {

  private static final Logger log = LoggerFactory.getLogger(JobMaintenanceTask.class);
  private static final int MAX_ATTEMPTS = 3;

  private final JobRepository jobRepository;
  private final S3StorageService storage;
  private final int retentionHours;

  public JobMaintenanceTask(
      JobRepository jobRepository,
      S3StorageService storage,
      @Value("${app.jobs.retention-hours:1}") int retentionHours) {
    this.jobRepository = jobRepository;
    this.storage = storage;
    this.retentionHours = retentionHours;
  }

  @Scheduled(fixedDelay = 15 * 60 * 1000)
  public void purgeExpiredJobs() {
    Instant threshold = Instant.now().minus(retentionHours, ChronoUnit.HOURS);
    List<Job> expired = jobRepository.findByCreatedAtBefore(threshold);
    List<Job> purged = new ArrayList<>(expired.size());

    for (Job job : expired) {
      try {
        storage.deleteByPrefix("jobs/" + job.getId() + "/");
        purged.add(job);
      } catch (Exception e) {
        // Keep the database row so the next maintenance pass can retry the object deletion.
        // Deleting the row here would make the retained object undiscoverable and break the
        // advertised retention guarantee.
        log.warn("Failed to delete storage for expired job {}", job.getId(), e);
      }
    }

    if (!purged.isEmpty()) {
      jobRepository.deleteAll(purged);
      log.info("Purged {} expired job(s)", purged.size());
    }
  }

  @Scheduled(fixedDelay = 60 * 1000)
  public void reapStaleProcessingJobs() {
    Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);
    List<Job> stale = jobRepository.findByStatusAndUpdatedAtBefore(JobStatus.PROCESSING, threshold);

    for (Job job : stale) {
      short attempts = (short) (job.getAttempts() + 1);
      job.setAttempts(attempts);
      job.setUpdatedAt(Instant.now());

      if (attempts >= MAX_ATTEMPTS) {
        job.setStatus(JobStatus.FAILED);
        job.setErrorMessage("Processing did not complete in time.");
        jobRepository.save(job);
      } else {
        job.setStatus(JobStatus.QUEUED);
        jobRepository.save(job);
      }
      log.warn("Reaped stale PROCESSING job {} (attempt {})", job.getId(), attempts);
    }
  }
}
