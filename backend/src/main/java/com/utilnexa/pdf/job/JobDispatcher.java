package com.utilnexa.pdf.job;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Pulls job ids off the Redis queue and drives them to completion. Runs on its own thread pool,
 * separate from Tomcat's request threads, so a stuck conversion can never block the synchronous
 * PDFBox endpoints or the job submit/status API.
 *
 * <p>Postgres (via {@link JobRepository}), not this dispatcher's in-memory state, is the source
 * of truth for job status - that's what lets {@link JobMaintenanceTask} reconcile jobs left
 * behind if the JVM itself dies mid-job.
 */
@Component
public class JobDispatcher {

  private static final Logger log = LoggerFactory.getLogger(JobDispatcher.class);
  private static final int MAX_ATTEMPTS = 3;
  private static final Duration RETRY_BACKOFF = Duration.ofSeconds(8);
  private static final Duration OFFICE_TIMEOUT = Duration.ofSeconds(150);
  private static final Duration OCR_TIMEOUT = Duration.ofMinutes(11);
  private static final Duration POLL_TIMEOUT = Duration.ofSeconds(5);

  private final StringRedisTemplate redisTemplate;
  private final JobRepository jobRepository;
  private final S3StorageService storage;
  private final ProcessorClient processorClient;
  private final ObjectMapper objectMapper;
  private final int poolSize;

  private ExecutorService executor;
  private volatile boolean running = true;

  public JobDispatcher(
      StringRedisTemplate redisTemplate,
      JobRepository jobRepository,
      S3StorageService storage,
      ProcessorClient processorClient,
      ObjectMapper objectMapper,
      @Value("${app.dispatcher.pool-size:4}") int poolSize) {
    this.redisTemplate = redisTemplate;
    this.jobRepository = jobRepository;
    this.storage = storage;
    this.processorClient = processorClient;
    this.objectMapper = objectMapper;
    this.poolSize = poolSize;
  }

  @PostConstruct
  public void start() {
    executor = Executors.newFixedThreadPool(poolSize);
    for (int i = 0; i < poolSize; i++) {
      executor.submit(this::loop);
    }
  }

  @PreDestroy
  public void stop() {
    running = false;
    if (executor != null) {
      executor.shutdownNow();
    }
  }

  private void loop() {
    while (running) {
      try {
        String jobId = redisTemplate.opsForList().rightPop(JobService.QUEUE_KEY, POLL_TIMEOUT);
        if (jobId == null) continue;
        processOne(UUID.fromString(jobId));
      } catch (Exception e) {
        log.error("Dispatcher loop error", e);
      }
    }
  }

  private void processOne(UUID jobId) {
    Optional<Job> maybeJob = jobRepository.findById(jobId);
    if (maybeJob.isEmpty()) return;

    Job job = maybeJob.get();
    if (job.getStatus() == JobStatus.SUCCEEDED || job.getStatus() == JobStatus.FAILED) return;

    job.setStatus(JobStatus.PROCESSING);
    job.setUpdatedAt(Instant.now());
    jobRepository.save(job);

    try {
      byte[] input = storage.get(job.getInputKey());
      byte[] result = invokeProcessor(job, input);

      String resultKey = "jobs/" + job.getId() + "/output/result";
      storage.put(resultKey, result, "application/octet-stream");

      job.setResultKey(resultKey);
      job.setStatus(JobStatus.SUCCEEDED);
      job.setUpdatedAt(Instant.now());
      jobRepository.save(job);
    } catch (PermanentProcessingException e) {
      fail(job, e.getMessage());
    } catch (Exception e) {
      log.warn("Job {} failed on attempt {}", jobId, job.getAttempts() + 1, e);
      retryOrFail(job, "Processing failed: " + e.getMessage());
    }
  }

  private byte[] invokeProcessor(Job job, byte[] input) {
    if (job.getType() == JobType.OCR) {
      return processorClient.ocr(input, job.getOriginalFilename(), readLanguage(job), OCR_TIMEOUT);
    }
    return processorClient.officeConvert(
        input, job.getOriginalFilename(), job.getType().targetFormat(), OFFICE_TIMEOUT);
  }

  private String readLanguage(Job job) {
    if (job.getOptions() == null) return "eng";
    try {
      Map<?, ?> options = objectMapper.readValue(job.getOptions(), Map.class);
      Object language = options.get("language");
      return language != null ? language.toString() : "eng";
    } catch (Exception e) {
      return "eng";
    }
  }

  private void retryOrFail(Job job, String message) {
    short attempts = (short) (job.getAttempts() + 1);
    job.setAttempts(attempts);
    if (attempts >= MAX_ATTEMPTS) {
      fail(job, message);
      return;
    }
    job.setStatus(JobStatus.QUEUED);
    job.setUpdatedAt(Instant.now());
    jobRepository.save(job);

    // Without a real delay here, idle dispatcher threads re-pop a requeued job almost
    // instantly (confirmed directly: 3 attempts logged 33ms apart in testing) - a processor
    // restart taking even a few seconds would burn all 3 attempts before it ever comes back.
    // This sleeps the one thread handling this job's retry; the other pool threads stay free.
    try {
      Thread.sleep(RETRY_BACKOFF.toMillis());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return;
    }
    redisTemplate.opsForList().leftPush(JobService.QUEUE_KEY, job.getId().toString());
  }

  private void fail(Job job, String message) {
    job.setStatus(JobStatus.FAILED);
    job.setErrorMessage(message);
    job.setUpdatedAt(Instant.now());
    jobRepository.save(job);
  }
}
