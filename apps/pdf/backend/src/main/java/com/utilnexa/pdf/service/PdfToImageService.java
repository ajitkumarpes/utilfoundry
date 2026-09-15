package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javax.imageio.ImageIO;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfToImageService {

  private static final int MIN_DPI = 72;
  private static final int MAX_DPI = 300;
  private static final int DEFAULT_DPI = 150;

  public List<NamedFile> convert(MultipartFile file, String format, Integer dpi) throws IOException {
    PdfFileValidator.requirePdf(file);

    String fmt = normalizeFormat(format);
    int resolvedDpi = dpi == null ? DEFAULT_DPI : dpi;
    if (resolvedDpi < MIN_DPI || resolvedDpi > MAX_DPI) {
      throw new IllegalArgumentException("dpi must be between " + MIN_DPI + " and " + MAX_DPI + ".");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {

      PDFRenderer renderer = new PDFRenderer(document);
      List<NamedFile> results = new ArrayList<>();
      String contentType = "png".equals(fmt) ? "image/png" : "image/jpeg";

      for (int i = 0; i < document.getNumberOfPages(); i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, resolvedDpi, ImageType.RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, fmt, out);
        results.add(new NamedFile("page-" + (i + 1) + "." + fmt, out.toByteArray(), contentType));
      }

      return results;
    }
  }

  private String normalizeFormat(String format) {
    if (format == null) return "jpg";
    String normalized = format.trim().toLowerCase();
    return switch (normalized) {
      case "jpg", "jpeg" -> "jpg";
      case "png" -> "png";
      default -> throw new IllegalArgumentException("format must be jpg or png.");
    };
  }

}
