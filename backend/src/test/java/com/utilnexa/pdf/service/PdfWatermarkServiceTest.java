package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;

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
}
