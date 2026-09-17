package com.utilnexa.pdf.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.utilnexa.pdf.service.support.PdfFileValidator;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfMergeService {

  private static final int MAX_FILES = 20;
  private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;
  private static final long MAX_TOTAL_BYTES = 100L * 1024 * 1024;

  public byte[] merge(List<MultipartFile> files) throws IOException {
    validate(files);

    PDFMergerUtility merger = new PDFMergerUtility();
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    List<Path> temporaryFiles = new ArrayList<>();

    try {
      for (MultipartFile file : files) {
        Path temp = Files.createTempFile("pdf-merge-", ".pdf");
        temporaryFiles.add(temp);
        file.transferTo(temp.toFile());
        merger.addSource(temp.toFile());
      }

      merger.setDestinationStream(output);
      merger.mergeDocuments(IOUtils.createMemoryOnlyStreamCache());

      byte[] result = output.toByteArray();
      if (result.length == 0) {
        throw new IOException("PDF merge produced an empty document.");
      }
      return result;
    } finally {
      for (Path temp : temporaryFiles) {
        try {
          Files.deleteIfExists(temp);
        } catch (IOException ignored) {
          // Best-effort cleanup. The OS/container can reclaim the temporary file later.
        }
      }
    }
  }

  private void validate(List<MultipartFile> files) {
    if (files == null || files.size() < 2) {
      throw new IllegalArgumentException("At least two PDF files are required.");
    }
    if (files.size() > MAX_FILES) {
      throw new IllegalArgumentException(
          "A maximum of " + MAX_FILES + " PDF files can be merged at once.");
    }

    long totalBytes = 0;
    for (MultipartFile file : files) {
      if (file == null || file.isEmpty()) {
        throw new IllegalArgumentException("Empty PDF files are not allowed.");
      }
      if (!isPdf(file)) {
        throw new IllegalArgumentException("Only PDF files are supported.");
      }
      if (file.getSize() > MAX_FILE_BYTES) {
        throw new IllegalArgumentException("Each PDF must be 50 MB or smaller.");
      }
      requireReadable(file);
      totalBytes += file.getSize();
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new IllegalArgumentException("The combined PDF size must be 100 MB or smaller.");
      }
    }
  }

  /**
   * The same check every other tool runs. Without it an encrypted or damaged member escaped
   * PDFMergerUtility as an unhandled exception: HTTP 500 "Internal Server Error", with no hint
   * which file was the problem.
   */
  private void requireReadable(MultipartFile file) {
    String name = file.getOriginalFilename() == null ? "One of the files" : "“" + file.getOriginalFilename() + "”";
    try (PDDocument ignored = PdfFileValidator.loadDecrypted(file.getBytes())) {
      // Readable and not encrypted.
    } catch (IllegalArgumentException | java.io.IOException e) {
      String reason = e instanceof IllegalArgumentException ? e.getMessage() : "It could not be read.";
      throw new IllegalArgumentException(name + ": " + reason);
    }
  }

  private boolean isPdf(MultipartFile file) {
    String type = file.getContentType();
    String name = file.getOriginalFilename();
    return "application/pdf".equalsIgnoreCase(type)
        || (name != null && name.toLowerCase().endsWith(".pdf"));
  }
}
