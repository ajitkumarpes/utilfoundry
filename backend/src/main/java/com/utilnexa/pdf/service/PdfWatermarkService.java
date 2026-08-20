package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import java.awt.Color;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfWatermarkService {

  private static final float OPACITY = 0.3f;
  private static final float FONT_SIZE = 48f;
  private static final int MAX_TEXT_LENGTH = 80;

  public byte[] watermark(MultipartFile file, String text, String position) throws IOException {
    PdfFileValidator.requirePdf(file);
    if (text == null || text.isBlank()) {
      throw new IllegalArgumentException("Watermark text is required.");
    }
    if (text.length() > MAX_TEXT_LENGTH) {
      throw new IllegalArgumentException("Watermark text must be " + MAX_TEXT_LENGTH + " characters or fewer.");
    }
    String pos = normalizePosition(position);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDFont font = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
      float textWidth = font.getStringWidth(text) / 1000 * FONT_SIZE;

      PDExtendedGraphicsState transparency = new PDExtendedGraphicsState();
      transparency.setNonStrokingAlphaConstant(OPACITY);

      for (PDPage page : document.getPages()) {
        PDRectangle box = page.getMediaBox();
        try (PDPageContentStream stream =
            new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
          stream.setNonStrokingColor(new Color(128, 128, 128));
          stream.setGraphicsStateParameters(transparency);
          stream.beginText();
          stream.setFont(font, FONT_SIZE);

          if ("diagonal".equals(pos)) {
            float centerX = box.getLowerLeftX() + box.getWidth() / 2 - textWidth / 2;
            float centerY = box.getLowerLeftY() + box.getHeight() / 2;
            stream.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(45), centerX, centerY));
          } else {
            float x = box.getLowerLeftX() + (box.getWidth() - textWidth) / 2;
            float y = box.getLowerLeftY() + box.getHeight() / 2;
            stream.newLineAtOffset(x, y);
          }

          stream.showText(text);
          stream.endText();
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Watermarking the PDF produced an empty document.");
      }
      return out;
    }
  }

  private String normalizePosition(String position) {
    if (position == null) return "center";
    String normalized = position.trim().toLowerCase();
    if (!normalized.equals("center") && !normalized.equals("diagonal")) {
      throw new IllegalArgumentException("position must be center or diagonal.");
    }
    return normalized;
  }
}
