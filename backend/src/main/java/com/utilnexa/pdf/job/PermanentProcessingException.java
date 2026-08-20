package com.utilnexa.pdf.job;

/**
 * Thrown when the processor shim explicitly rejects a job's input (HTTP 4xx) rather than
 * failing to run at all. Never retried — retrying a rejected input just burns attempts before
 * showing the user the same real error.
 */
public class PermanentProcessingException extends RuntimeException {
  public PermanentProcessingException(String message) {
    super(message);
  }
}
