package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfUnlockServiceTest {

  private final PdfUnlockService service = new PdfUnlockService();
  private final PdfProtectService protectService = new PdfProtectService();

  @Test
  void correctPasswordRemovesEncryption() throws Exception {
    byte[] protectedPdf = protectService.protect(pdfFile(pdfWithPages(1)), "secret123", true, false, false, false);

    byte[] result = service.unlock(pdfFile(protectedPdf), "secret123");

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertFalse(doc.isEncrypted());
    }
  }

  @Test
  void wrongPasswordRejectedCleanly() throws Exception {
    byte[] protectedPdf = protectService.protect(pdfFile(pdfWithPages(1)), "secret123", true, false, false, false);

    assertThrows(IllegalArgumentException.class, () -> service.unlock(pdfFile(protectedPdf), "wrong-password"));
  }

  @Test
  void nonEncryptedInputRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.unlock(file, "anything"));
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
  void corruptInputIsABadRequestNotAServerError() {
    MockMultipartFile file = pdfFile("definitely not a pdf".getBytes());

    IllegalArgumentException thrown =
        assertThrows(IllegalArgumentException.class, () -> service.unlock(file, "anything"));

    org.junit.jupiter.api.Assertions.assertEquals(
        "This PDF could not be read — it appears to be corrupted or invalid.", thrown.getMessage());
  }
}
