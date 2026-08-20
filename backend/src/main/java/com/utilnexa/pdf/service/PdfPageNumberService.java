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
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfPageNumberService {

  private static final float FONT_SIZE = 11f;
  private static final float MARGIN = 24f;

  public byte[] addPageNumbers(MultipartFile file, String position, Integer startAt) throws IOException {
    PdfFileValidator.requirePdf(file);
    String pos = normalizePosition(position);
    int start = startAt == null ? 1 : startAt;
    if (start < 0) {
      throw new IllegalArgumentException("startAt must be 0 or greater.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDFont font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

      for (int i = 0; i < document.getNumberOfPages(); i++) {
        PDPage page = document.getPage(i);
        PDRectangle box = page.getMediaBox();
        String label = String.valueOf(start + i);
        float textWidth = font.getStringWidth(label) / 1000 * FONT_SIZE;

        float x;
        float y;
        switch (pos) {
          case "bottom-right" -> {
            x = box.getUpperRightX() - MARGIN - textWidth;
            y = box.getLowerLeftY() + MARGIN;
          }
          case "top-right" -> {
            x = box.getUpperRightX() - MARGIN - textWidth;
            y = box.getUpperRightY() - MARGIN;
          }
          default -> {
            x = box.getLowerLeftX() + (box.getWidth() - textWidth) / 2;
            y = box.getLowerLeftY() + MARGIN;
          }
        }

        try (PDPageContentStream stream =
            new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
          stream.beginText();
          stream.setFont(font, FONT_SIZE);
          stream.setNonStrokingColor(new Color(60, 60, 60));
          stream.newLineAtOffset(x, y);
          stream.showText(label);
          stream.endText();
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Adding page numbers produced an empty document.");
      }
      return out;
    }
  }

  private String normalizePosition(String position) {
    if (position == null) return "bottom-center";
    String normalized = position.trim().toLowerCase();
    return switch (normalized) {
      case "bottom-center", "bottom-right", "top-right" -> normalized;
      default -> throw new IllegalArgumentException("position must be bottom-center, bottom-right, or top-right.");
    };
  }
}
