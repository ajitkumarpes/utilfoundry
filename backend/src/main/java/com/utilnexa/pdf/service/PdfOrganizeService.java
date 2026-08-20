package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.OrganizePlan;
import com.utilnexa.pdf.api.dto.PageOp;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfOrganizeService {

  private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;

  public byte[] organize(MultipartFile file, OrganizePlan plan) throws IOException {
    validateFile(file);

    if (plan == null || plan.pages() == null || plan.pages().isEmpty()) {
      throw new IllegalArgumentException("The organized PDF must contain at least one page.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument source = Loader.loadPDF(bytes)) {
      if (source.isEncrypted()) {
        throw new IllegalArgumentException("Password-protected PDFs are not supported yet.");
      }

      int pageCount = source.getNumberOfPages();

      try (PDDocument result = new PDDocument()) {
        for (PageOp op : plan.pages()) {
          if (op.sourceIndex() < 0 || op.sourceIndex() >= pageCount) {
            throw new IllegalArgumentException("Page index " + op.sourceIndex() + " is out of range.");
          }
          result.importPage(source.getPage(op.sourceIndex()));
          PDPage importedPage = result.getPage(result.getNumberOfPages() - 1);
          importedPage.setRotation(normalizeRotation(op.rotation()));
        }

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        result.save(output);

        byte[] out = output.toByteArray();
        if (out.length == 0) {
          throw new IOException("Organizing the PDF produced an empty document.");
        }
        return out;
      }
    }
  }

  private int normalizeRotation(int rotation) {
    int normalized = rotation % 360;
    if (normalized < 0) normalized += 360;
    if (normalized % 90 != 0) {
      throw new IllegalArgumentException("Rotation must be a multiple of 90 degrees.");
    }
    return normalized;
  }

  private void validateFile(MultipartFile file) {
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

  private boolean isPdf(MultipartFile file) {
    String type = file.getContentType();
    String name = file.getOriginalFilename();
    return "application/pdf".equalsIgnoreCase(type) || (name != null && name.toLowerCase().endsWith(".pdf"));
  }
}
