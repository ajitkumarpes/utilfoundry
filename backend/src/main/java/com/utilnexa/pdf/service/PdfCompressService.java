package com.utilnexa.pdf.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfCompressService {

  private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;

  public record Result(byte[] content, long originalSize, long compressedSize) {}

  public Result compress(MultipartFile file, String level) throws IOException {
    validateFile(file);
    float quality = qualityFor(level);

    byte[] originalBytes = file.getBytes();
    try (PDDocument document = Loader.loadPDF(originalBytes)) {
      if (document.isEncrypted()) {
        throw new IllegalArgumentException("Password-protected PDFs are not supported yet.");
      }

      for (PDPage page : document.getPages()) {
        recompressImages(document, page.getResources(), quality);
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] compressed = output.toByteArray();

      // Recompression can occasionally grow already-optimized PDFs; never ship a larger file.
      byte[] winner = compressed.length > 0 && compressed.length < originalBytes.length
          ? compressed
          : originalBytes;
      return new Result(winner, originalBytes.length, winner.length);
    }
  }

  private void recompressImages(PDDocument document, PDResources resources, float quality) throws IOException {
    if (resources == null) return;

    for (COSName name : resources.getXObjectNames()) {
      PDXObject xobject = resources.getXObject(name);
      if (xobject instanceof PDImageXObject image) {
        BufferedImage buffered = image.getImage();
        PDImageXObject recompressed = JPEGFactory.createFromImage(document, buffered, quality);
        resources.put(name, recompressed);
      } else if (xobject instanceof PDFormXObject form) {
        recompressImages(document, form.getResources(), quality);
      }
    }
  }

  private float qualityFor(String level) {
    if (level == null) return 0.5f;
    return switch (level.trim().toUpperCase()) {
      case "LOW" -> 0.75f;
      case "MEDIUM" -> 0.5f;
      case "HIGH" -> 0.3f;
      default -> throw new IllegalArgumentException("level must be LOW, MEDIUM, or HIGH.");
    };
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
