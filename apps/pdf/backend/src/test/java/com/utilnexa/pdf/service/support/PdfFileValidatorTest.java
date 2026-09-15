package com.utilnexa.pdf.service.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;

class PdfFileValidatorTest {

  @Test
  void healthyPdfLoadsFine() throws Exception {
    try (PDDocument doc = PdfFileValidator.loadDecrypted(pdfWithPages(2))) {
      assertEquals(2, doc.getNumberOfPages());
    }
  }

  @Test
  void garbageInputTooDamagedToRecoverIsACleanBadRequestNotAServerError() {
    byte[] notAPdfAtAll = "this is plain text, not a PDF, and PDFBox's own recovery scan can't salvage it"
        .getBytes(StandardCharsets.UTF_8);

    IllegalArgumentException thrown =
        assertThrows(IllegalArgumentException.class, () -> PdfFileValidator.loadDecrypted(notAPdfAtAll));
    assertEquals("This PDF could not be read — it appears to be corrupted or invalid.", thrown.getMessage());
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
}
