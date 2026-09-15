package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.NamedFile;

import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfToImageServiceTest {

  private final PdfToImageService service = new PdfToImageService();

  @Test
  void rendersOneImagePerPage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));

    List<NamedFile> results = service.convert(file, "png", 96);

    assertEquals(3, results.size());
    for (NamedFile named : results) {
      assertEquals("image/png", named.contentType());
      assertTrue(named.content().length > 0);
    }
  }

  @Test
  void defaultsToJpgWhenFormatOmitted() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    List<NamedFile> results = service.convert(file, null, null);

    assertEquals("image/jpeg", results.get(0).contentType());
    assertTrue(results.get(0).filename().endsWith(".jpg"));
  }

  @Test
  void rejectsDpiOutOfRange() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.convert(file, "png", 1000));
  }

  @Test
  void rejectsUnknownFormat() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.convert(file, "bmp", null));
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
