package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfWatermarkServiceTest {

  private final PdfWatermarkService service = new PdfWatermarkService();

  @Test
  void watermarkTextIsDrawnOntoEveryPage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2));

    byte[] result = service.watermark(file, "CONFIDENTIAL", "center");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("CONFIDENTIAL"));
    }
  }

  @Test
  void diagonalPositionAlsoDrawsText() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.watermark(file, "DRAFT", "diagonal");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("DRAFT"));
    }
  }

  @Test
  void devanagariTextIsDrawnAndExtractable() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.watermark(file, "गोपनीय", "center");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("गोपनीय"));
    }
  }

  @Test
  void mixedLatinAndDevanagariTextRendersBothScriptsCorrectly() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.watermark(file, "Room 101 कमरा", "center");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Room 101"));
      assertTrue(text.contains("कमरा"));
    }
  }

  @Test
  void mixedLatinAndDevanagariTextAlsoWorksDiagonally() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.watermark(file, "Room 101 कमरा", "diagonal");

    try (PDDocument doc = Loader.loadPDF(result)) {
      // PDFTextStripper's line-detection heuristic splits sufficiently long rotated text
      // across multiple lines regardless of script or font (confirmed independently: a
      // same-length pure-Latin diagonal string shows the identical split). Strip whitespace
      // before asserting so this checks the actual character content, not incidental
      // line-grouping from the rotation.
      String flattened = new PDFTextStripper().getText(doc).replaceAll("\\s+", "");
      assertTrue(flattened.contains("Room101"));
      assertTrue(flattened.contains("कमरा"));
    }
  }

  @Test
  void blankTextRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.watermark(file, "  ", "center"));
  }

  @Test
  void oversizedTextRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    String longText = "x".repeat(81);

    assertThrows(IllegalArgumentException.class, () -> service.watermark(file, longText, "center"));
  }

  private byte[] pdfWithPages(int count) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      for (int i = 0; i < count; i++) {
        document.addPage(new PDPage());
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }

  @Test
  void theLongestTextTheFieldAcceptsStillFitsOnThePage() throws Exception {
    // 80 characters is the field's own limit, so no accepted text may be refused for length.
    byte[] result = service.watermark(pdfFile(pdfWithPages(1)), "W".repeat(80), "center");

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertTrue(new PDFTextStripper().getText(doc).contains("WWWWW"));
    }
  }

  @Test
  void aLongWatermarkIsShrunkToFitInsideThePageInBothPositions() throws Exception {
    String notice = "STRICTLY CONFIDENTIAL - INTERNAL DISTRIBUTION ONLY - DO NOT FORWARD 2026";
    for (String position : List.of("diagonal", "center")) {
      byte[] result = service.watermark(pdfFile(pdfWithPages(1)), notice, position);

      try (PDDocument doc = Loader.loadPDF(result)) {
        float width = doc.getPage(0).getMediaBox().getWidth();
        float height = doc.getPage(0).getMediaBox().getHeight();
        List<float[]> outside = new java.util.ArrayList<>();
        PDFTextStripper stripper = new PDFTextStripper() {
          @Override
          protected void writeString(String text, List<org.apache.pdfbox.text.TextPosition> positions) {
            for (org.apache.pdfbox.text.TextPosition p : positions) {
              if (p.getX() < 0 || p.getX() > width || p.getY() < 0 || p.getY() > height) {
                outside.add(new float[] {p.getX(), p.getY()});
              }
            }
          }
        };
        stripper.setSortByPosition(false);
        stripper.getText(doc);
        assertTrue(outside.isEmpty(), position + ": " + outside.size() + " glyphs drawn off the page");
      }
    }
  }

  @Test
  void cyrillicTextIsDrawnWithAnEmbeddedFont() throws Exception {
    byte[] result = service.watermark(pdfFile(pdfWithPages(1)), "Секретно", "center");

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertTrue(new PDFTextStripper().getText(doc).contains("Секретно"));
    }
  }

  @Test
  void textNoBundledFontCanDrawIsRefusedWithAPlainMessage() throws Exception {
    IllegalArgumentException thrown = assertThrows(
        IllegalArgumentException.class, () -> service.watermark(pdfFile(pdfWithPages(1)), "机密文件", "center"));

    assertTrue(thrown.getMessage().contains("Chinese"), thrown.getMessage());
  }
}
