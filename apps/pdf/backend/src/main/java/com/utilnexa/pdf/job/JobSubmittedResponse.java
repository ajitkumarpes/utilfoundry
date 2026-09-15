package com.utilnexa.pdf.job;

import java.util.UUID;

public record JobSubmittedResponse(UUID jobId, String status) {}
