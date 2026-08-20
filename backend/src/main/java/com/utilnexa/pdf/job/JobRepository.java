package com.utilnexa.pdf.job;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobRepository extends JpaRepository<Job, UUID> {
  List<Job> findByStatusAndUpdatedAtBefore(JobStatus status, Instant threshold);

  List<Job> findByCreatedAtBefore(Instant threshold);
}
