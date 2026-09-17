package com.utilnexa.pdf.job;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "jobs")
@Getter
@Setter
@NoArgsConstructor
public class Job {

  @Id private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private JobType type;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private JobStatus status;

  @Column(name = "input_key", nullable = false)
  private String inputKey;

  @Column(name = "result_key")
  private String resultKey;

  @Column(name = "original_filename", nullable = false)
  private String originalFilename;

  @Column(columnDefinition = "text")
  private String options;

  @Column(name = "error_message", columnDefinition = "text")
  private String errorMessage;

  @Column(nullable = false)
  private short attempts;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
