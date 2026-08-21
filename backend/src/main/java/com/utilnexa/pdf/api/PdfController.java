package com.utilnexa.pdf.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utilnexa.pdf.api.dto.BookmarkEntry;
import com.utilnexa.pdf.api.dto.BookmarksReadResult;
import com.utilnexa.pdf.api.dto.HeaderFooterRequest;
import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.api.dto.OrganizePlan;
import com.utilnexa.pdf.api.dto.RedactionArea;
import com.utilnexa.pdf.api.dto.SanitizeScanResult;
import com.utilnexa.pdf.api.dto.SignPlacement;
import com.utilnexa.pdf.service.ImageToPdfService;
import com.utilnexa.pdf.service.PdfBookmarkService;
import com.utilnexa.pdf.service.PdfCompressService;
import com.utilnexa.pdf.service.PdfCropService;
import com.utilnexa.pdf.service.PdfExtractImagesService;
import com.utilnexa.pdf.service.PdfGrayscaleService;
import com.utilnexa.pdf.service.PdfHeaderFooterService;
import com.utilnexa.pdf.service.PdfMergeService;
import com.utilnexa.pdf.service.PdfMetadataService;
import com.utilnexa.pdf.service.PdfNUpService;
import com.utilnexa.pdf.service.PdfOrganizeService;
import com.utilnexa.pdf.service.PdfPageNumberService;
import com.utilnexa.pdf.service.PdfProtectService;
import com.utilnexa.pdf.service.PdfRedactService;
import com.utilnexa.pdf.service.PdfRepairService;
import com.utilnexa.pdf.service.PdfRotateService;
import com.utilnexa.pdf.service.PdfSanitizeService;
import com.utilnexa.pdf.service.PdfSignService;
import com.utilnexa.pdf.service.PdfSplitService;
import com.utilnexa.pdf.service.PdfTextToPdfService;
import com.utilnexa.pdf.service.PdfToImageService;
import com.utilnexa.pdf.service.PdfToTextService;
import com.utilnexa.pdf.service.PdfUnlockService;
import com.utilnexa.pdf.service.PdfWatermarkService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
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
  private final PdfRotateService rotateService;
  private final PdfWatermarkService watermarkService;
  private final PdfPageNumberService pageNumberService;
  private final PdfProtectService protectService;
  private final PdfUnlockService unlockService;
  private final PdfGrayscaleService grayscaleService;
  private final PdfExtractImagesService extractImagesService;
  private final PdfCropService cropService;
  private final PdfSignService signService;
  private final PdfRedactService redactService;
  private final PdfRepairService repairService;
  private final PdfToTextService toTextService;
  private final PdfMetadataService metadataService;
  private final PdfNUpService nUpService;
  private final PdfBookmarkService bookmarkService;
  private final PdfSanitizeService sanitizeService;
  private final PdfHeaderFooterService headerFooterService;
  private final PdfTextToPdfService textToPdfService;
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
      @RequestPart("file") MultipartFile file,
      @RequestPart(value = "file2", required = false) MultipartFile file2,
      @RequestPart("plan") String planJson)
      throws IOException {
    OrganizePlan plan;
    try {
      plan = objectMapper.readValue(planJson, OrganizePlan.class);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("The page plan could not be read.");
    }
    return pdfResponse(organizeService.organize(file, file2, plan), "organized.pdf");
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

  @PostMapping(
      value = "/rotate",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> rotate(
      @RequestPart("file") MultipartFile file, @RequestParam("angle") int angle) throws IOException {
    return pdfResponse(rotateService.rotate(file, angle), "rotated.pdf");
  }

  @PostMapping(
      value = "/watermark",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> watermark(
      @RequestPart("file") MultipartFile file,
      @RequestParam("text") String text,
      @RequestParam(value = "position", required = false) String position)
      throws IOException {
    return pdfResponse(watermarkService.watermark(file, text, position), "watermarked.pdf");
  }

  @PostMapping(
      value = "/page-numbers",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> pageNumbers(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "position", required = false) String position,
      @RequestParam(value = "startAt", required = false) Integer startAt)
      throws IOException {
    return pdfResponse(pageNumberService.addPageNumbers(file, position, startAt), "numbered.pdf");
  }

  @PostMapping(
      value = "/protect",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> protect(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "userPassword", required = false) String userPassword,
      @RequestParam(value = "allowPrinting", defaultValue = "true") boolean allowPrinting,
      @RequestParam(value = "allowCopying", defaultValue = "false") boolean allowCopying,
      @RequestParam(value = "allowEditing", defaultValue = "false") boolean allowEditing,
      @RequestParam(value = "allowFillingForms", defaultValue = "false") boolean allowFillingForms)
      throws IOException {
    return pdfResponse(
        protectService.protect(file, userPassword, allowPrinting, allowCopying, allowEditing, allowFillingForms),
        "protected.pdf");
  }

  @PostMapping(
      value = "/unlock",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> unlock(
      @RequestPart("file") MultipartFile file, @RequestParam("currentPassword") String currentPassword)
      throws IOException {
    return pdfResponse(unlockService.unlock(file, currentPassword), "unlocked.pdf");
  }

  @PostMapping(
      value = "/grayscale",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> grayscale(@RequestPart("file") MultipartFile file) throws IOException {
    return pdfResponse(grayscaleService.grayscale(file), "grayscale.pdf");
  }

  @PostMapping(value = "/extract-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<byte[]> extractImages(@RequestPart("file") MultipartFile file) throws IOException {
    return respondWithFiles(extractImagesService.extract(file), "extracted-images.zip");
  }

  @PostMapping(
      value = "/crop",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> crop(
      @RequestPart("file") MultipartFile file, @RequestParam(value = "mode", required = false) String mode)
      throws IOException {
    return pdfResponse(cropService.crop(file, mode), "cropped.pdf");
  }

  @PostMapping(
      value = "/sign",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> sign(
      @RequestPart("file") MultipartFile file,
      @RequestPart("signatureImage") MultipartFile signatureImage,
      @RequestPart("placement") String placementJson)
      throws IOException {
    SignPlacement placement;
    try {
      placement = objectMapper.readValue(placementJson, SignPlacement.class);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("The signature placement could not be read.");
    }
    return pdfResponse(signService.sign(file, signatureImage, placement), "signed.pdf");
  }

  @PostMapping(
      value = "/redact",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> redact(
      @RequestPart("file") MultipartFile file, @RequestPart("redactions") String redactionsJson)
      throws IOException {
    List<RedactionArea> redactions;
    try {
      redactions = objectMapper.readValue(redactionsJson, new TypeReference<List<RedactionArea>>() {});
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("The redaction areas could not be read.");
    }
    return pdfResponse(redactService.redact(file, redactions), "redacted.pdf");
  }

  @PostMapping(
      value = "/repair",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> repair(@RequestPart("file") MultipartFile file) throws IOException {
    return pdfResponse(repairService.repair(file), "repaired.pdf");
  }

  @PostMapping(value = "/to-text", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<byte[]> toText(@RequestPart("file") MultipartFile file) throws IOException {
    byte[] text = toTextService.extractText(file);
    return respondWithFiles(List.of(new NamedFile("extracted.txt", text, "text/plain")), "extracted.txt");
  }

  @PostMapping(
      value = "/metadata",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> metadata(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "title", required = false) String title,
      @RequestParam(value = "author", required = false) String author,
      @RequestParam(value = "subject", required = false) String subject,
      @RequestParam(value = "keywords", required = false) String keywords)
      throws IOException {
    return pdfResponse(metadataService.updateMetadata(file, title, author, subject, keywords), "updated-metadata.pdf");
  }

  @PostMapping(
      value = "/n-up",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> nUp(
      @RequestPart("file") MultipartFile file, @RequestParam("pagesPerSheet") int pagesPerSheet)
      throws IOException {
    return pdfResponse(nUpService.nUp(file, pagesPerSheet), "pages-per-sheet.pdf");
  }

  @PostMapping(value = "/bookmarks/read", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public BookmarksReadResult readBookmarks(@RequestPart("file") MultipartFile file) throws IOException {
    return bookmarkService.readBookmarks(file);
  }

  @PostMapping(
      value = "/bookmarks",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> writeBookmarks(
      @RequestPart("file") MultipartFile file, @RequestPart("bookmarks") String bookmarksJson)
      throws IOException {
    List<BookmarkEntry> entries;
    try {
      entries = objectMapper.readValue(bookmarksJson, new TypeReference<List<BookmarkEntry>>() {});
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("The bookmark list could not be read.");
    }
    return pdfResponse(bookmarkService.writeBookmarks(file, entries), "bookmarked.pdf");
  }

  @PostMapping(value = "/sanitize/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public SanitizeScanResult scanForSanitize(@RequestPart("file") MultipartFile file) throws IOException {
    return sanitizeService.scan(file);
  }

  @PostMapping(
      value = "/sanitize",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> sanitize(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "clearMetadata", defaultValue = "false") boolean clearMetadata,
      @RequestParam(value = "removeAttachments", defaultValue = "false") boolean removeAttachments,
      @RequestParam(value = "removeAnnotations", defaultValue = "false") boolean removeAnnotations,
      @RequestParam(value = "removeScripts", defaultValue = "false") boolean removeScripts)
      throws IOException {
    return pdfResponse(
        sanitizeService.sanitize(file, clearMetadata, removeAttachments, removeAnnotations, removeScripts),
        "sanitized.pdf");
  }

  @PostMapping(
      value = "/header-footer",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> headerFooter(
      @RequestPart("file") MultipartFile file, @RequestPart("config") String configJson)
      throws IOException {
    HeaderFooterRequest request;
    try {
      request = objectMapper.readValue(configJson, HeaderFooterRequest.class);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("The header/footer configuration could not be read.");
    }
    return pdfResponse(headerFooterService.apply(file, request), "header-footer.pdf");
  }

  @PostMapping(
      value = "/text-to-pdf",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> textToPdf(
      @RequestParam("text") String text,
      @RequestParam(value = "pageSize", required = false) String pageSize)
      throws IOException {
    return pdfResponse(textToPdfService.convert(text, pageSize), "text.pdf");
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
