package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfRotateServiceTest {

  private final PdfRotateService service = new PdfRotateService();

  @Test
  void rotatesEveryPageByTheGivenAngle() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));

    byte[] result = service.rotate(file, 90);

    try (PDDocument doc = Loader.loadPDF(result)) {
      for (PDPage page : doc.getPages()) {
        assertEquals(90, page.getRotation());
      }
    }
  }

  @Test
  void rotationAccumulatesOnExistingRotation() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithRotatedPage(180));

    byte[] result = service.rotate(file, 270);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(90, doc.getPage(0).getRotation());
    }
  }

  @Test
  void invalidAngleRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.rotate(file, 45));
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

  private byte[] pdfWithRotatedPage(int rotation) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      page.setRotation(rotation);
      document.addPage(page);
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
