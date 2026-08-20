package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfNUpServiceTest {

  private final PdfNUpService service = new PdfNUpService();

  @Test
  void twoUpHalvesTheOutputPageCount() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithLabeledPages(4));

    byte[] result = service.nUp(file, 2);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
    }
  }

  @Test
  void fourUpRoundsUpForARemainder() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithLabeledPages(5));

    byte[] result = service.nUp(file, 4);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
    }
  }

  @Test
  void everySourcePagesContentSurvivesIntoTheOutput() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithLabeledPages(4));

    byte[] result = service.nUp(file, 4);

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      for (int i = 1; i <= 4; i++) {
        assertTrue(text.contains("PAGE-" + i), "Expected PAGE-" + i + " in extracted text, got: " + text);
      }
    }
  }

  @Test
  void invalidPagesPerSheetRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithLabeledPages(2));

    assertThrows(IllegalArgumentException.class, () -> service.nUp(file, 3));
  }

  @Test
  void emptyPdfRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithLabeledPages(0));

    assertThrows(IllegalArgumentException.class, () -> service.nUp(file, 2));
  }

  private byte[] pdfWithLabeledPages(int count) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      for (int i = 1; i <= count; i++) {
        PDPage page = new PDPage(PDRectangle.A4);
        document.addPage(page);
        try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
          stream.beginText();
          stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 20);
          stream.newLineAtOffset(40, 700);
          stream.showText("PAGE-" + i);
          stream.endText();
        }
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
