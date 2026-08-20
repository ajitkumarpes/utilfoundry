package com.utilnexa.pdf.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import javax.imageio.ImageIO;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageToPdfService {

  private static final int MAX_FILES = 20;
  private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;
  private static final long MAX_TOTAL_BYTES = 100L * 1024 * 1024;
  private static final float MARGIN = 24f;

  public byte[] convert(List<MultipartFile> files) throws IOException {
    validate(files);

    try (PDDocument document = new PDDocument()) {
      for (MultipartFile file : files) {
        BufferedImage image = ImageIO.read(file.getInputStream());
        if (image == null) {
          throw new IllegalArgumentException(file.getOriginalFilename() + " is not a readable image.");
        }

        boolean landscape = image.getWidth() > image.getHeight();
        PDRectangle pageSize =
            landscape
                ? new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth())
                : PDRectangle.A4;

        PDPage page = new PDPage(pageSize);
        document.addPage(page);

        PDImageXObject pdImage =
            isJpeg(file)
                ? JPEGFactory.createFromImage(document, image)
                : LosslessFactory.createFromImage(document, image);

        float maxWidth = pageSize.getWidth() - 2 * MARGIN;
        float maxHeight = pageSize.getHeight() - 2 * MARGIN;
        float scale = Math.min(maxWidth / pdImage.getWidth(), maxHeight / pdImage.getHeight());
        scale = Math.min(scale, 1f);

        float drawWidth = pdImage.getWidth() * scale;
        float drawHeight = pdImage.getHeight() * scale;
        float x = (pageSize.getWidth() - drawWidth) / 2;
        float y = (pageSize.getHeight() - drawHeight) / 2;

        try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
          stream.drawImage(pdImage, x, y, drawWidth, drawHeight);
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);

      byte[] result = output.toByteArray();
      if (result.length == 0) {
        throw new IOException("PDF generation produced an empty document.");
      }
      return result;
    }
  }

  private boolean isJpeg(MultipartFile file) {
    String type = file.getContentType();
    String name = file.getOriginalFilename();
    return "image/jpeg".equalsIgnoreCase(type)
        || (name != null && name.toLowerCase().matches(".*\\.(jpe?g)$"));
  }

  private void validate(List<MultipartFile> files) {
    if (files == null || files.isEmpty()) {
      throw new IllegalArgumentException("At least one image is required.");
    }
    if (files.size() > MAX_FILES) {
      throw new IllegalArgumentException(
          "A maximum of " + MAX_FILES + " images can be converted at once.");
    }

    long totalBytes = 0;
    for (MultipartFile file : files) {
      if (file == null || file.isEmpty()) {
        throw new IllegalArgumentException("Empty image files are not allowed.");
      }
      if (!isImage(file)) {
        throw new IllegalArgumentException("Only JPG and PNG images are supported.");
      }
      if (file.getSize() > MAX_FILE_BYTES) {
        throw new IllegalArgumentException("Each image must be 50 MB or smaller.");
      }
      totalBytes += file.getSize();
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new IllegalArgumentException("The combined image size must be 100 MB or smaller.");
      }
    }
  }

  private boolean isImage(MultipartFile file) {
    String type = file.getContentType();
    String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
    return (type != null && type.startsWith("image/")) || name.matches(".*\\.(jpe?g|png)$");
  }
}
