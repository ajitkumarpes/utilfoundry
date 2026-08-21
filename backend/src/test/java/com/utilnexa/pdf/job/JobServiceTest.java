package com.utilnexa.pdf.job;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utilnexa.pdf.service.ImageToPdfService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockMultipartFile;

class JobServiceTest {

  private JobRepository jobRepository;
  private S3StorageService storage;
  private StringRedisTemplate redisTemplate;
  private ListOperations<String, String> listOperations;
  private ImageToPdfService imageToPdfService;
  private JobService service;

  @BeforeEach
  void setUp() {
    jobRepository = mock(JobRepository.class);
    storage = mock(S3StorageService.class);
    redisTemplate = mock(StringRedisTemplate.class);
    listOperations = mock(ListOperations.class);
    imageToPdfService = mock(ImageToPdfService.class);
    when(redisTemplate.opsForList()).thenReturn(listOperations);
    when(jobRepository.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

    service = new JobService(jobRepository, storage, redisTemplate, new ObjectMapper(), imageToPdfService);
  }

  @Test
  void submitOfficeConversionRejectsWrongFileType() {
    MockMultipartFile pdfFile = new MockMultipartFile("file", "doc.pdf", "application/pdf", new byte[] {1});

    assertThrows(
        IllegalArgumentException.class,
        () -> service.submitOfficeConversion(JobType.WORD_TO_PDF, pdfFile));
    verify(storage, never()).put(anyString(), any(), any());
  }

  @Test
  void submitOfficeConversionAcceptsCorrectFileType() {
    MockMultipartFile docx =
        new MockMultipartFile(
            "file",
            "report.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "content".getBytes());

    Job job = service.submitOfficeConversion(JobType.WORD_TO_PDF, docx);

    assertEquals(JobType.WORD_TO_PDF, job.getType());
    assertEquals(JobStatus.QUEUED, job.getStatus());
    assertEquals("report.docx", job.getOriginalFilename());
    verify(storage).put(anyString(), any(), any());
    verify(listOperations).leftPush(JobService.QUEUE_KEY, job.getId().toString());
  }

  @Test
  void submitOcrRejectsInvalidLanguage() {
    MockMultipartFile pdf = new MockMultipartFile("file", "scan.pdf", "application/pdf", "content".getBytes());

    assertThrows(IllegalArgumentException.class, () -> service.submitOcr(pdf, "fr"));
  }

  @Test
  void submitOcrDefaultsToEnglish() {
    MockMultipartFile pdf = new MockMultipartFile("file", "scan.pdf", "application/pdf", "content".getBytes());

    Job job = service.submitOcr(pdf, null);

    assertEquals(JobType.OCR, job.getType());
    assertEquals("{\"language\":\"eng\"}", job.getOptions());
  }

  @Test
  void submitOcrConvertsImageToPdfFirst() throws Exception {
    MockMultipartFile image = new MockMultipartFile("file", "scan.jpg", "image/jpeg", "content".getBytes());
    byte[] convertedPdf = "pdf-bytes".getBytes();
    when(imageToPdfService.convert(any())).thenReturn(convertedPdf);

    Job job = service.submitOcr(image, "hin");

    assertEquals("scan.pdf", job.getOriginalFilename());
    verify(imageToPdfService).convert(any());
    verify(storage).put(anyString(), any(byte[].class), any());
  }

  @Test
  void getStatusThrowsForUnknownJob() {
    java.util.UUID id = java.util.UUID.randomUUID();
    when(jobRepository.findById(id)).thenReturn(java.util.Optional.empty());

    assertThrows(JobNotFoundException.class, () -> service.getStatus(id));
  }

  @Test
  void getDownloadUrlReturnsAPresignedUrlForASucceededJob() {
    Job job = succeededJob();
    when(jobRepository.findById(job.getId())).thenReturn(java.util.Optional.of(job));
    when(storage.presignGet("results/1", "report.pdf", "application/pdf"))
        .thenReturn("https://minio.example/results/1?X-Amz-Signature=abc");

    JobService.DownloadUrl result = service.getDownloadUrl(job.getId());

    assertEquals("https://minio.example/results/1?X-Amz-Signature=abc", result.url());
    assertEquals("report.pdf", result.filename());
  }

  @Test
  void getDownloadUrlThrowsForAFailedJob() {
    Job job = succeededJob();
    job.setStatus(JobStatus.FAILED);
    job.setErrorMessage("The source file was corrupted.");
    when(jobRepository.findById(job.getId())).thenReturn(java.util.Optional.of(job));

    JobNotReadyException thrown =
        assertThrows(JobNotReadyException.class, () -> service.getDownloadUrl(job.getId()));
    assertEquals("The source file was corrupted.", thrown.getMessage());
  }

  @Test
  void getDownloadUrlThrowsWhileStillProcessing() {
    Job job = succeededJob();
    job.setStatus(JobStatus.PROCESSING);
    job.setResultKey(null);
    when(jobRepository.findById(job.getId())).thenReturn(java.util.Optional.of(job));

    assertThrows(JobNotReadyException.class, () -> service.getDownloadUrl(job.getId()));
  }

  private Job succeededJob() {
    Job job = new Job();
    job.setId(java.util.UUID.randomUUID());
    job.setType(JobType.WORD_TO_PDF);
    job.setStatus(JobStatus.SUCCEEDED);
    job.setInputKey("inputs/1");
    job.setResultKey("results/1");
    job.setOriginalFilename("report.docx");
    job.setAttempts((short) 1);
    job.setCreatedAt(java.time.Instant.now());
    job.setUpdatedAt(java.time.Instant.now());
    return job;
  }
}
