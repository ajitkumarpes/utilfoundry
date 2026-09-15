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

class PdfPageNumberServiceTest {

  private final PdfPageNumberService service = new PdfPageNumberService();

  @Test
  void numbersStartAtOneByDefault() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));

    byte[] result = service.addPageNumbers(file, "bottom-center", null);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertTrue(textOfPage(doc, 0).contains("1"));
      assertTrue(textOfPage(doc, 1).contains("2"));
      assertTrue(textOfPage(doc, 2).contains("3"));
    }
  }

  @Test
  void startAtOffsetsEveryPage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2));

    byte[] result = service.addPageNumbers(file, "bottom-right", 5);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertTrue(textOfPage(doc, 0).contains("5"));
      assertTrue(textOfPage(doc, 1).contains("6"));
    }
  }

  @Test
  void invalidPositionRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.addPageNumbers(file, "middle", null));
  }

  @Test
  void negativeStartAtRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.addPageNumbers(file, null, -1));
  }

  private String textOfPage(PDDocument doc, int index) throws Exception {
    PDFTextStripper stripper = new PDFTextStripper();
    stripper.setStartPage(index + 1);
    stripper.setEndPage(index + 1);
    return stripper.getText(doc);
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
