package com.utilnexa.pdf.service.support;

import java.io.IOException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.springframework.web.multipart.MultipartFile;

/** Shared single-file validation used by every synchronous PDF tool. */
public final class PdfFileValidator {

  public static final long MAX_FILE_BYTES = 50L * 1024 * 1024;
  private static final String ENCRYPTED_MESSAGE = "Password-protected PDFs are not supported yet.";

  private PdfFileValidator() {}

  public static void requirePdf(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("A PDF file is required.");
    }
    if (!isPdf(file)) {
      throw new IllegalArgumentException("Only PDF files are supported.");
    }
    if (file.getSize() > MAX_FILE_BYTES) {
      throw new IllegalArgumentException("The PDF must be 50 MB or smaller.");
    }
  }

  /**
   * Loads a PDF that must not be password-protected. A PDF encrypted with a real (non-blank)
   * password fails inside {@code Loader.loadPDF} itself with {@link InvalidPasswordException} —
   * before any {@link PDDocument} exists to call {@code isEncrypted()} on — so that case has to be
   * caught here, not left to a separate post-load check.
   */
  public static PDDocument loadDecrypted(byte[] bytes) throws IOException {
    PDDocument document;
    try {
      document = Loader.loadPDF(bytes);
    } catch (InvalidPasswordException e) {
      throw new IllegalArgumentException(ENCRYPTED_MESSAGE);
    } catch (IOException e) {
      // Loader.loadPDF already attempts its own recovery (broken xref/trailer -> full-file object
      // scan, see PdfRepairService) before ever reaching here, so this is a file too damaged for
      // that to salvage - a bad-input case (400), not a server fault (500).
      throw new IllegalArgumentException("This PDF could not be read — it appears to be corrupted or invalid.");
    }
    if (document.isEncrypted()) {
      document.close();
      throw new IllegalArgumentException(ENCRYPTED_MESSAGE);
    }
    return document;
  }

  private static boolean isPdf(MultipartFile file) {
    String type = file.getContentType();
    String name = file.getOriginalFilename();
    return "application/pdf".equalsIgnoreCase(type)
        || (name != null && name.toLowerCase().endsWith(".pdf"));
  }
}
