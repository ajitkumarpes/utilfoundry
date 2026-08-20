package com.utilnexa.pdf.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.api.dto.OrganizePlan;
import com.utilnexa.pdf.service.ImageToPdfService;
import com.utilnexa.pdf.service.PdfCompressService;
import com.utilnexa.pdf.service.PdfMergeService;
import com.utilnexa.pdf.service.PdfOrganizeService;
import com.utilnexa.pdf.service.PdfSplitService;
import com.utilnexa.pdf.service.PdfToImageService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/pdf")
@RequiredArgsConstructor
public class PdfController {

  private final PdfMergeService mergeService;
  private final ImageToPdfService imageToPdfService;
  private final PdfSplitService splitService;
  private final PdfOrganizeService organizeService;
  private final PdfToImageService pdfToImageService;
  private final PdfCompressService compressService;
  private final ObjectMapper objectMapper;

  @PostMapping(
      value = "/merge",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> merge(@RequestPart("files") List<MultipartFile> files)
      throws IOException {
    return pdfResponse(mergeService.merge(files), "merged.pdf");
  }

  @PostMapping(
      value = "/images-to-pdf",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> imagesToPdf(@RequestPart("files") List<MultipartFile> files)
      throws IOException {
    return pdfResponse(imageToPdfService.convert(files), "converted.pdf");
  }

  @PostMapping(value = "/split", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<byte[]> split(
      @RequestPart("file") MultipartFile file,
      @RequestParam("mode") String mode,
      @RequestParam(value = "ranges", required = false) String ranges)
      throws IOException {
    List<NamedFile> results = splitService.split(file, mode, ranges);
    return respondWithFiles(results, "split-pages.zip");
  }

  @PostMapping(
      value = "/organize",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> organize(
      @RequestPart("file") MultipartFile file, @RequestPart("plan") String planJson)
      throws IOException {
    OrganizePlan plan;
    try {
      plan = objectMapper.readValue(planJson, OrganizePlan.class);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("The page plan could not be read.");
    }
    return pdfResponse(organizeService.organize(file, plan), "organized.pdf");
  }

  @PostMapping(value = "/pdf-to-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<byte[]> pdfToImages(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "format", required = false) String format,
      @RequestParam(value = "dpi", required = false) Integer dpi)
      throws IOException {
    List<NamedFile> results = pdfToImageService.convert(file, format, dpi);
    return respondWithFiles(results, "pdf-images.zip");
  }

  @PostMapping(
      value = "/compress",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> compress(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "level", required = false) String level)
      throws IOException {
    PdfCompressService.Result result = compressService.compress(file, level);

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_PDF);
    headers.setContentLength(result.content().length);
    headers.setContentDisposition(ContentDisposition.attachment().filename("compressed.pdf").build());
    headers.setCacheControl("no-store, max-age=0");
    headers.set("X-Original-Size", String.valueOf(result.originalSize()));
    headers.set("X-Compressed-Size", String.valueOf(result.compressedSize()));

    return ResponseEntity.ok().headers(headers).body(result.content());
  }

  private ResponseEntity<byte[]> pdfResponse(byte[] content, String filename) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_PDF);
    headers.setContentLength(content.length);
    headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
    headers.setCacheControl("no-store, max-age=0");
    return ResponseEntity.ok().headers(headers).body(content);
  }

  private ResponseEntity<byte[]> respondWithFiles(List<NamedFile> outputs, String zipFilename)
      throws IOException {
    if (outputs.isEmpty()) {
      throw new IllegalArgumentException("The operation produced no files.");
    }

    if (outputs.size() == 1) {
      NamedFile only = outputs.get(0);
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.parseMediaType(only.contentType()));
      headers.setContentLength(only.content().length);
      headers.setContentDisposition(ContentDisposition.attachment().filename(only.filename()).build());
      headers.setCacheControl("no-store, max-age=0");
      return ResponseEntity.ok().headers(headers).body(only.content());
    }

    byte[] zip = zipFiles(outputs);
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.parseMediaType("application/zip"));
    headers.setContentLength(zip.length);
    headers.setContentDisposition(ContentDisposition.attachment().filename(zipFilename).build());
    headers.setCacheControl("no-store, max-age=0");
    return ResponseEntity.ok().headers(headers).body(zip);
  }

  private byte[] zipFiles(List<NamedFile> files) throws IOException {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    try (ZipOutputStream zos = new ZipOutputStream(buffer)) {
      for (NamedFile f : files) {
        zos.putNextEntry(new ZipEntry(f.filename()));
        zos.write(f.content());
        zos.closeEntry();
      }
    }
    return buffer.toByteArray();
  }
}
