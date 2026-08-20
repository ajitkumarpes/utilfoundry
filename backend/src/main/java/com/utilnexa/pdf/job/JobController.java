package com.utilnexa.pdf.job;

import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/pdf")
public class JobController {

  private final JobService jobService;

  public JobController(JobService jobService) {
    this.jobService = jobService;
  }

  @PostMapping(value = "/ocr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<JobSubmittedResponse> ocr(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "language", required = false) String language) {
    return accepted(jobService.submitOcr(file, language));
  }

  @PostMapping(value = "/word-to-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<JobSubmittedResponse> wordToPdf(@RequestPart("file") MultipartFile file) {
    return accepted(jobService.submitOfficeConversion(JobType.WORD_TO_PDF, file));
  }

  @PostMapping(value = "/excel-to-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<JobSubmittedResponse> excelToPdf(@RequestPart("file") MultipartFile file) {
    return accepted(jobService.submitOfficeConversion(JobType.EXCEL_TO_PDF, file));
  }

  @PostMapping(value = "/ppt-to-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<JobSubmittedResponse> pptToPdf(@RequestPart("file") MultipartFile file) {
    return accepted(jobService.submitOfficeConversion(JobType.PPT_TO_PDF, file));
  }

  @PostMapping(value = "/pdf-to-word", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<JobSubmittedResponse> pdfToWord(@RequestPart("file") MultipartFile file) {
    return accepted(jobService.submitOfficeConversion(JobType.PDF_TO_WORD, file));
  }

  @PostMapping(value = "/pdf-to-ppt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<JobSubmittedResponse> pdfToPpt(@RequestPart("file") MultipartFile file) {
    return accepted(jobService.submitOfficeConversion(JobType.PDF_TO_PPT, file));
  }

  @GetMapping("/jobs/{id}")
  public JobStatusResponse status(@PathVariable UUID id) {
    Job job = jobService.getStatus(id);
    return new JobStatusResponse(
        job.getId(),
        job.getType().name(),
        job.getStatus().name(),
        job.getErrorMessage(),
        job.getStatus() == JobStatus.SUCCEEDED ? jobService.resultFilenameFor(job) : null,
        job.getCreatedAt());
  }

  @GetMapping("/jobs/{id}/download")
  public ResponseEntity<byte[]> download(@PathVariable UUID id) {
    JobService.DownloadableResult result = jobService.getDownloadableResult(id);

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.parseMediaType(result.contentType()));
    headers.setContentLength(result.content().length);
    headers.setContentDisposition(
        ContentDisposition.attachment().filename(result.filename()).build());
    headers.setCacheControl("no-store, max-age=0");

    return ResponseEntity.ok().headers(headers).body(result.content());
  }

  private ResponseEntity<JobSubmittedResponse> accepted(Job job) {
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(new JobSubmittedResponse(job.getId(), job.getStatus().name()));
  }
}
