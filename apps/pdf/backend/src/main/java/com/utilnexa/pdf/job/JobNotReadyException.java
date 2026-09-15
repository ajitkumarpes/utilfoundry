package com.utilnexa.pdf.job;

public class JobNotReadyException extends RuntimeException {
  public JobNotReadyException(String message) {
    super(message);
  }
}
