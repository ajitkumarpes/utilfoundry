package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfProtectServiceTest {

  private final PdfProtectService service = new PdfProtectService();

  @Test
  void openPasswordIsRequiredAfterProtecting() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.protect(file, "secret123", true, false);

    assertThrows(InvalidPasswordException.class, () -> Loader.loadPDF(result));
    try (PDDocument doc = Loader.loadPDF(result, "secret123")) {
      assertTrue(doc.isEncrypted());
    }
  }

  @Test
  void blankUserPasswordStillRestrictsPermissionsWithoutRequiringOneToOpen() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.protect(file, null, false, false);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertTrue(doc.isEncrypted());
      assertFalse(doc.getCurrentAccessPermission().canPrint());
      assertFalse(doc.getCurrentAccessPermission().canExtractContent());
    }
  }

  @Test
  void permissionFlagsAreApplied() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    byte[] result = service.protect(file, "pw", true, true);

    try (PDDocument doc = Loader.loadPDF(result, "pw")) {
      assertTrue(doc.getCurrentAccessPermission().canPrint());
      assertTrue(doc.getCurrentAccessPermission().canExtractContent());
      assertFalse(doc.getCurrentAccessPermission().canModify());
    }
  }

  @Test
  void alreadyEncryptedInputRejected() throws Exception {
    MockMultipartFile file = pdfFile(service.protect(pdfFile(pdfWithPages(1)), "pw", true, false));

    assertThrows(IllegalArgumentException.class, () -> service.protect(file, "other", true, false));
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
