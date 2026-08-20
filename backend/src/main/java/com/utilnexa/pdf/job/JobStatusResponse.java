package com.utilnexa.pdf.job;

import java.time.Instant;
import java.util.UUID;

public record JobStatusResponse(
    UUID jobId,
    String type,
    String status,
    String errorMessage,
    String resultFilename,
    Instant createdAt) {}
