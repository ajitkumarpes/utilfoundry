package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfCompressServiceTest {

  private final PdfCompressService service = new PdfCompressService();

  @Test
  void compressesImageHeavyPdf() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithSolidImage());

    PdfCompressService.Result result = service.compress(file, "HIGH");

    assertTrue(result.compressedSize() <= result.originalSize());
    try (PDDocument doc = Loader.loadPDF(result.content())) {
      assertEquals(1, doc.getNumberOfPages());
    }
  }

  @Test
  void neverReturnsALargerFileThanTheOriginal() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2));

    PdfCompressService.Result result = service.compress(file, "LOW");

    assertTrue(result.compressedSize() <= result.originalSize());
  }

  @Test
  void rejectsUnknownLevel() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.compress(file, "EXTREME"));
  }

  @Test
  void rejectsNonPdfFile() {
    MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[] {1, 2, 3});

    assertThrows(IllegalArgumentException.class, () -> service.compress(file, "MEDIUM"));
  }

  private byte[] pdfWithSolidImage() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      BufferedImage image = new BufferedImage(400, 400, BufferedImage.TYPE_INT_RGB);
      for (int x = 0; x < image.getWidth(); x++) {
        for (int y = 0; y < image.getHeight(); y++) {
          image.setRGB(x, y, ((x * 37) ^ (y * 91)) & 0xFFFFFF);
        }
      }
      PDImageXObject pdImage = LosslessFactory.createFromImage(document, image);

      try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
        stream.drawImage(pdImage, 50, 50, 400, 400);
      }

      document.save(output);
      return output.toByteArray();
    }
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
