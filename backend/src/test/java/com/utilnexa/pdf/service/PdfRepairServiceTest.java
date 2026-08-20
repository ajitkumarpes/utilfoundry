package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfRepairServiceTest {

  private final PdfRepairService service = new PdfRepairService();

  @Test
  void healthyPdfIsReturnedIntact() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));

    byte[] result = service.repair(file);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(3, doc.getNumberOfPages());
    }
  }

  @Test
  void pdfWithACorruptedStartxrefOffsetIsRecovered() throws Exception {
    byte[] corrupted = corruptStartxrefOffset(pdfWithPages(2));

    MockMultipartFile file = pdfFile(corrupted);
    byte[] result = service.repair(file);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
    }
  }

  private byte[] corruptStartxrefOffset(byte[] pdfBytes) {
    String content = new String(pdfBytes, StandardCharsets.ISO_8859_1);
    int marker = content.lastIndexOf("startxref");
    int lineStart = marker + "startxref".length();
    int lineEnd = content.indexOf('\n', lineStart);
    StringBuilder corrupted = new StringBuilder(content);
    corrupted.replace(lineStart, lineEnd, "\n999999999");
    return corrupted.toString().getBytes(StandardCharsets.ISO_8859_1);
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
