package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.SignPlacement;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfSignService {

  private static final long MAX_SIGNATURE_BYTES = 5L * 1024 * 1024;
  private static final float MIN_WIDTH_PCT = 0.02f;

  public byte[] sign(MultipartFile file, MultipartFile signatureImage, SignPlacement placement) throws IOException {
    PdfFileValidator.requirePdf(file);
    validateSignatureImage(signatureImage);
    if (placement == null) {
      throw new IllegalArgumentException("Placement is required.");
    }

    BufferedImage signatureBuffered = ImageIO.read(signatureImage.getInputStream());
    if (signatureBuffered == null) {
      throw new IllegalArgumentException("The signature file is not a readable image.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      if (placement.pageIndex() < 0 || placement.pageIndex() >= document.getNumberOfPages()) {
        throw new IllegalArgumentException("pageIndex is out of range.");
      }

      float xPct = clamp01(placement.xPct());
      float yPct = clamp01(placement.yPct());
      float widthPct = Math.max(MIN_WIDTH_PCT, Math.min(1f, placement.widthPct()));

      PDPage page = document.getPage(placement.pageIndex());
      PDRectangle box = page.getMediaBox();

      PDImageXObject signatureImageObject = LosslessFactory.createFromImage(document, signatureBuffered);

      float widthPts = widthPct * box.getWidth();
      float aspect = (float) signatureBuffered.getHeight() / (float) signatureBuffered.getWidth();
      float heightPts = widthPts * aspect;

      float x = box.getLowerLeftX() + xPct * box.getWidth();
      float yFromTop = box.getUpperRightY() - yPct * box.getHeight();
      float y = yFromTop - heightPts;

      try (PDPageContentStream stream =
          new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
        stream.drawImage(signatureImageObject, x, y, widthPts, heightPts);
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Signing the PDF produced an empty document.");
      }
      return out;
    }
  }

  private float clamp01(float v) {
    return Math.max(0f, Math.min(1f, v));
  }

  private void validateSignatureImage(MultipartFile signatureImage) {
    if (signatureImage == null || signatureImage.isEmpty()) {
      throw new IllegalArgumentException("A signature image is required.");
    }
    String type = signatureImage.getContentType();
    String name =
        signatureImage.getOriginalFilename() == null ? "" : signatureImage.getOriginalFilename().toLowerCase();
    boolean looksLikeImage = (type != null && type.startsWith("image/")) || name.matches(".*\\.(png|jpe?g)$");
    if (!looksLikeImage) {
      throw new IllegalArgumentException("The signature must be a PNG or JPEG image.");
    }
    if (signatureImage.getSize() > MAX_SIGNATURE_BYTES) {
      throw new IllegalArgumentException("The signature image must be 5 MB or smaller.");
    }
  }
}
