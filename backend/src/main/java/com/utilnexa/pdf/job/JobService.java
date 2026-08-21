package com.utilnexa.pdf.job;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utilnexa.pdf.service.ImageToPdfService;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class JobService {

  static final String QUEUE_KEY = "jobs:queue";
  private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;

  private final JobRepository jobRepository;
  private final S3StorageService storage;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;
  private final ImageToPdfService imageToPdfService;

  public JobService(
      JobRepository jobRepository,
      S3StorageService storage,
      StringRedisTemplate redisTemplate,
      ObjectMapper objectMapper,
      ImageToPdfService imageToPdfService) {
    this.jobRepository = jobRepository;
    this.storage = storage;
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
    this.imageToPdfService = imageToPdfService;
  }

  public Job submitOcr(MultipartFile file, String language) {
    String lang = language == null || language.isBlank() ? "eng" : language;
    if (!Set.of("eng", "hin").contains(lang)) {
      throw new IllegalArgumentException("language must be eng or hin.");
    }
    validateFile(
        file,
        Set.of("application/pdf", "image/jpeg", "image/png"),
        Set.of(".pdf", ".jpg", ".jpeg", ".png"));

    // The processor's OCR endpoint only ever sees a PDF - keeps its input contract uniform and
    // keeps "is this a valid PDF/image" validation on one side. Reuses the existing
    // ImageToPdfService rather than teaching the shim to also handle raw images.
    byte[] pdfBytes;
    String pdfFilename;
    if (isPdf(file)) {
      pdfBytes = readBytes(file);
      pdfFilename = file.getOriginalFilename();
    } else {
      try {
        pdfBytes = imageToPdfService.convert(List.of(file));
      } catch (IOException e) {
        throw new IllegalStateException("Could not convert the image to PDF.", e);
      }
      pdfFilename = stripExtension(file.getOriginalFilename()) + ".pdf";
    }

    return submitBytes(JobType.OCR, pdfBytes, pdfFilename, writeJson(Map.of("language", lang)));
  }

  public Job submitOfficeConversion(JobType type, MultipartFile file) {
    switch (type) {
      case WORD_TO_PDF ->
          validateFile(
              file,
              Set.of(
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
              Set.of(".doc", ".docx"));
      case EXCEL_TO_PDF ->
          validateFile(
              file,
              Set.of(
                  "application/vnd.ms-excel",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
              Set.of(".xls", ".xlsx"));
      case PPT_TO_PDF ->
          validateFile(
              file,
              Set.of(
                  "application/vnd.ms-powerpoint",
                  "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
              Set.of(".ppt", ".pptx"));
      case PDF_TO_WORD, PDF_TO_PPT ->
          validateFile(file, Set.of("application/pdf"), Set.of(".pdf"));
      case OCR -> throw new IllegalArgumentException("Use submitOcr for OCR jobs.");
    }
    return submitBytes(type, readBytes(file), file.getOriginalFilename(), null);
  }

  private Job submitBytes(JobType type, byte[] content, String filename, String options) {
    UUID id = UUID.randomUUID();
    String inputKey = "jobs/" + id + "/input/" + filename;

    storage.put(inputKey, content, "application/octet-stream");

    Job job = new Job();
    job.setId(id);
    job.setType(type);
    job.setStatus(JobStatus.QUEUED);
    job.setInputKey(inputKey);
    job.setOriginalFilename(filename);
    job.setOptions(options);
    job.setAttempts((short) 0);
    Instant now = Instant.now();
    job.setCreatedAt(now);
    job.setUpdatedAt(now);

    try {
      jobRepository.save(job);
    } catch (RuntimeException e) {
      // Don't leave an orphaned input object with no row to ever clean it up.
      storage.deleteByPrefix("jobs/" + id + "/");
      throw e;
    }

    redisTemplate.opsForList().leftPush(QUEUE_KEY, id.toString());
    return job;
  }

  public Job getStatus(UUID id) {
    return jobRepository.findById(id).orElseThrow(() -> new JobNotFoundException(id));
  }

  public record DownloadUrl(String url, String filename) {}

  public DownloadUrl getDownloadUrl(UUID id) {
    Job job = getStatus(id);
    if (job.getStatus() == JobStatus.FAILED) {
      throw new JobNotReadyException(
          job.getErrorMessage() != null ? job.getErrorMessage() : "This job failed.");
    }
    if (job.getStatus() != JobStatus.SUCCEEDED || job.getResultKey() == null) {
      throw new JobNotReadyException("This job is still processing.");
    }
    String filename = resultFilenameFor(job);
    String url = storage.presignGet(job.getResultKey(), filename, contentTypeFor(job.getType()));
    return new DownloadUrl(url, filename);
  }

  public String resultFilenameFor(Job job) {
    String base = stripExtension(job.getOriginalFilename());
    return switch (job.getType()) {
      case OCR -> base + "-searchable.pdf";
      case WORD_TO_PDF, EXCEL_TO_PDF, PPT_TO_PDF -> base + ".pdf";
      case PDF_TO_WORD -> base + ".docx";
      case PDF_TO_PPT -> base + ".pptx";
    };
  }

  private String contentTypeFor(JobType type) {
    return switch (type) {
      case OCR, WORD_TO_PDF, EXCEL_TO_PDF, PPT_TO_PDF -> "application/pdf";
      case PDF_TO_WORD -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case PDF_TO_PPT -> "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    };
  }

  private String stripExtension(String filename) {
    if (filename == null) return "file";
    int dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.substring(0, dot) : filename;
  }

  private boolean isPdf(MultipartFile file) {
    String type = file.getContentType();
    String name = file.getOriginalFilename();
    return "application/pdf".equalsIgnoreCase(type)
        || (name != null && name.toLowerCase().endsWith(".pdf"));
  }

  private byte[] readBytes(MultipartFile file) {
    try {
      return file.getBytes();
    } catch (IOException e) {
      throw new IllegalStateException("Could not read the uploaded file.", e);
    }
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to serialize job options.", e);
    }
  }

  private void validateFile(MultipartFile file, Set<String> mimeTypes, Set<String> extensions) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("A file is required.");
    }
    if (file.getSize() > MAX_FILE_BYTES) {
      throw new IllegalArgumentException("The file must be 50 MB or smaller.");
    }
    String name =
        file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
    boolean extensionOk = extensions.stream().anyMatch(name::endsWith);
    boolean typeOk = file.getContentType() != null && mimeTypes.contains(file.getContentType());
    if (!extensionOk && !typeOk) {
      throw new IllegalArgumentException("Unsupported file type for this tool.");
    }
  }
}
