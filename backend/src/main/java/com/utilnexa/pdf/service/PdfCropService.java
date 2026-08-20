package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfCropService {

  private static final int SCAN_DPI = 100;
  private static final int STANDARD_THRESHOLD = 250;
  private static final int AGGRESSIVE_THRESHOLD = 240;

  public byte[] crop(MultipartFile file, String mode) throws IOException {
    PdfFileValidator.requirePdf(file);
    int threshold = normalizeMode(mode);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDFRenderer renderer = new PDFRenderer(document);
      for (int i = 0; i < document.getNumberOfPages(); i++) {
        PDPage page = document.getPage(i);
        BufferedImage rendered = renderer.renderImageWithDPI(i, SCAN_DPI);
        int[] bbox = contentBoundingBox(rendered, threshold);
        if (bbox == null) continue;

        PDRectangle original = page.getMediaBox();
        float scale = 72f / SCAN_DPI;

        float left = bbox[0] * scale;
        float topFromImageTop = bbox[1] * scale;
        float right = bbox[2] * scale;
        float bottomFromImageTop = bbox[3] * scale;

        PDRectangle cropBox = new PDRectangle();
        cropBox.setLowerLeftX(original.getLowerLeftX() + left);
        cropBox.setUpperRightX(original.getLowerLeftX() + right);
        cropBox.setUpperRightY(original.getUpperRightY() - topFromImageTop);
        cropBox.setLowerLeftY(original.getUpperRightY() - bottomFromImageTop);
        page.setCropBox(cropBox);
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Cropping the PDF produced an empty document.");
      }
      return out;
    }
  }

  /** {minX, minY, maxX, maxY} of non-white content in image pixel space (Y grows downward), or null if blank. */
  private int[] contentBoundingBox(BufferedImage image, int threshold) {
    int width = image.getWidth();
    int height = image.getHeight();
    int minX = width, minY = height, maxX = -1, maxY = -1;

    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        int rgb = image.getRGB(x, y);
        int r = (rgb >> 16) & 0xFF;
        int g = (rgb >> 8) & 0xFF;
        int b = rgb & 0xFF;
        if (r < threshold || g < threshold || b < threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) return null;
    return new int[] {minX, minY, maxX + 1, maxY + 1};
  }

  private int normalizeMode(String mode) {
    if (mode == null) return STANDARD_THRESHOLD;
    String normalized = mode.trim().toLowerCase();
    return switch (normalized) {
      case "standard" -> STANDARD_THRESHOLD;
      case "aggressive" -> AGGRESSIVE_THRESHOLD;
      default -> throw new IllegalArgumentException("mode must be standard or aggressive.");
    };
  }
}
