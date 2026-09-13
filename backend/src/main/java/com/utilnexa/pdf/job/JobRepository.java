package com.utilnexa.pdf.job;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface JobRepository extends JpaRepository<Job, UUID> {
  List<Job> findByStatusAndUpdatedAtBefore(JobStatus status, Instant threshold);

  List<Job> findByCreatedAtBefore(Instant threshold);

  Optional<Job> findFirstByStatusOrderByCreatedAtAsc(JobStatus status);

  /** Atomically claims a queued job. Multiple backend replicas may discover the same row, but
   * only one can transition it to PROCESSING and perform the work. */
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Transactional
  @Query("""
      update Job j
         set j.status = :processing, j.updatedAt = :now
       where j.id = :id and j.status = :queued
      """)
  int claimQueued(
      @Param("id") UUID id,
      @Param("queued") JobStatus queued,
      @Param("processing") JobStatus processing,
      @Param("now") Instant now);
}
