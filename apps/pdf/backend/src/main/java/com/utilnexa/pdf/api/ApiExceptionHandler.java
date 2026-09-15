package com.utilnexa.pdf.api;

import com.utilnexa.pdf.job.JobNotFoundException;
import com.utilnexa.pdf.job.JobNotReadyException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException e) {
    return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<Map<String, String>> tooLarge() {
    return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
        .body(Map.of("error", "Uploaded file is too large."));
  }

  @ExceptionHandler(JobNotFoundException.class)
  ResponseEntity<Map<String, String>> jobNotFound(JobNotFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
  }

  @ExceptionHandler(JobNotReadyException.class)
  ResponseEntity<Map<String, String>> jobNotReady(JobNotReadyException e) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
  }
}
