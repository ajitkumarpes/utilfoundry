package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfMetadataServiceTest {

  private final PdfMetadataService service = new PdfMetadataService();

  @Test
  void setsProvidedFieldsAndLeavesOthersUntouched() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.updateMetadata(file, "New Title", "New Author", null, null);

    try (PDDocument doc = Loader.loadPDF(result)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      assertEquals("New Title", info.getTitle());
      assertEquals("New Author", info.getAuthor());
      assertNull(info.getSubject());
    }
  }

  @Test
  void emptyStringClearsAField() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithTitle("Original Title"));

    byte[] result = service.updateMetadata(file, "", null, null, "invoices, 2026");

    try (PDDocument doc = Loader.loadPDF(result)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      assertEquals("", info.getTitle());
      assertEquals("invoices, 2026", info.getKeywords());
    }
  }

  @Test
  void allFieldsBlankRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.updateMetadata(file, null, "  ", null, ""));
  }

  @Test
  void oversizedFieldRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    String tooLong = "x".repeat(301);

    assertThrows(IllegalArgumentException.class, () -> service.updateMetadata(file, tooLong, null, null, null));
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

  private byte[] pdfWithTitle(String title) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      document.addPage(new PDPage());
      document.getDocumentInformation().setTitle(title);
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
