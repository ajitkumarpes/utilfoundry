package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.HeaderFooterRequest;
import com.utilnexa.pdf.api.dto.HeaderFooterZone;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

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

/**
 * Compound header/footer layout: 6 zones (top/bottom x left/center/right), each independently
 * None/Text/Page-number/Date/Bates. Same append-mode content-stream + margin-from-MediaBox
 * technique as {@link PdfPageNumberService} - this is that tool's superset for compound layouts
 * (letterhead footers, Bates-stamped legal documents), not a replacement for it; a single "just
 * number the pages" search intent is still better served by the simpler, dedicated tool.
 */
@Service
public class PdfHeaderFooterService {

  private static final float FONT_SIZE = 10f;
  private static final float MARGIN = 24f;
  private static final int MAX_TEXT_LENGTH = 200;
  private static final int MAX_BATES_PREFIX_LENGTH = 50;
  private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("MMM d, yyyy");

  private enum HPos {
    LEFT,
    CENTER,
    RIGHT
  }

  private enum VPos {
    TOP,
    BOTTOM
  }

  public byte[] apply(MultipartFile file, HeaderFooterRequest request) throws IOException {
    PdfFileValidator.requirePdf(file);

    List<ZonePlacement> allZones = request == null
        ? List.of()
        : List.of(
            new ZonePlacement(request.topLeft(), HPos.LEFT, VPos.TOP),
            new ZonePlacement(request.topCenter(), HPos.CENTER, VPos.TOP),
            new ZonePlacement(request.topRight(), HPos.RIGHT, VPos.TOP),
            new ZonePlacement(request.bottomLeft(), HPos.LEFT, VPos.BOTTOM),
            new ZonePlacement(request.bottomCenter(), HPos.CENTER, VPos.BOTTOM),
            new ZonePlacement(request.bottomRight(), HPos.RIGHT, VPos.BOTTOM));

    List<ZonePlacement> active = allZones.stream().filter(p -> !isNone(p.zone())).toList();
    if (active.isEmpty()) {
      throw new IllegalArgumentException("Configure at least one zone.");
    }
    for (ZonePlacement placement : active) {
      validate(placement.zone());
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDFont font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      String today = LocalDate.now().format(DATE_FORMAT);
      int pageCount = document.getNumberOfPages();

      for (int i = 0; i < pageCount; i++) {
        PDPage page = document.getPage(i);
        PDRectangle box = page.getMediaBox();

        try (PDPageContentStream stream = new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
          for (ZonePlacement placement : active) {
            String label = resolveText(placement.zone(), i, today);
            if (label.isEmpty()) continue;
            drawLabel(stream, font, box, label, placement.hPos(), placement.vPos());
          }
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Adding the header/footer produced an empty document.");
      }
      return out;
    }
  }

  private void drawLabel(PDPageContentStream stream, PDFont font, PDRectangle box, String label, HPos hPos, VPos vPos)
      throws IOException {
    float textWidth = font.getStringWidth(label) / 1000 * FONT_SIZE;
    float x =
        switch (hPos) {
          case LEFT -> box.getLowerLeftX() + MARGIN;
          case RIGHT -> box.getUpperRightX() - MARGIN - textWidth;
          case CENTER -> box.getLowerLeftX() + (box.getWidth() - textWidth) / 2;
        };
    float y =
        switch (vPos) {
          case TOP -> box.getUpperRightY() - MARGIN;
          case BOTTOM -> box.getLowerLeftY() + MARGIN;
        };

    stream.beginText();
    stream.setFont(font, FONT_SIZE);
    stream.setNonStrokingColor(new Color(60, 60, 60));
    stream.newLineAtOffset(x, y);
    stream.showText(label);
    stream.endText();
  }

  private String resolveText(HeaderFooterZone zone, int pageIndex, String today) {
    return switch (zone.type().toUpperCase()) {
      case "TEXT" -> zone.text() == null ? "" : zone.text().trim();
      case "PAGE_NUMBER" -> "Page " + (pageIndex + 1);
      case "DATE" -> today;
      case "BATES" -> {
        String prefix = zone.batesPrefix() == null ? "" : zone.batesPrefix().trim();
        int digits = zone.batesDigits() == null ? 6 : zone.batesDigits();
        int start = zone.batesStart() == null ? 1 : zone.batesStart();
        yield prefix + String.format("%0" + digits + "d", start + pageIndex);
      }
      default -> "";
    };
  }

  private void validate(HeaderFooterZone zone) {
    String type = zone.type() == null ? "" : zone.type().toUpperCase();
    switch (type) {
      case "TEXT" -> {
        if (zone.text() == null || zone.text().isBlank()) {
          throw new IllegalArgumentException("A text zone needs some text.");
        }
        if (zone.text().length() > MAX_TEXT_LENGTH) {
          throw new IllegalArgumentException("Zone text must be " + MAX_TEXT_LENGTH + " characters or fewer.");
        }
      }
      case "PAGE_NUMBER", "DATE" -> {}
      case "BATES" -> {
        if (zone.batesPrefix() != null && zone.batesPrefix().length() > MAX_BATES_PREFIX_LENGTH) {
          throw new IllegalArgumentException(
              "Bates prefix must be " + MAX_BATES_PREFIX_LENGTH + " characters or fewer.");
        }
        int digits = zone.batesDigits() == null ? 6 : zone.batesDigits();
        if (digits < 1 || digits > 10) {
          throw new IllegalArgumentException("Bates digits must be between 1 and 10.");
        }
        int start = zone.batesStart() == null ? 1 : zone.batesStart();
        if (start < 0) {
          throw new IllegalArgumentException("Bates start must be 0 or greater.");
        }
      }
      default -> throw new IllegalArgumentException("Unknown zone type: " + zone.type());
    }
  }

  private boolean isNone(HeaderFooterZone zone) {
    return zone == null || zone.type() == null || zone.type().isBlank() || "NONE".equalsIgnoreCase(zone.type());
  }

  private record ZonePlacement(HeaderFooterZone zone, HPos hPos, VPos vPos) {}
}
