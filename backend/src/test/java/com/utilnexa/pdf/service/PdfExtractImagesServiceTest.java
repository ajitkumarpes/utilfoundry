package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.NamedFile;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfExtractImagesServiceTest {

  private final PdfExtractImagesService service = new PdfExtractImagesService();

  @Test
  void extractsOneImagePerEmbeddedImage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithImages(2, 1));

    List<NamedFile> results = service.extract(file);

    assertEquals(3, results.size());
    for (NamedFile named : results) {
      assertEquals("image/png", named.contentType());
      assertTrue(named.content().length > 0);
    }
  }

  @Test
  void pdfWithNoImagesRejected() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      document.addPage(new PDPage());
      document.save(output);
      MockMultipartFile file = pdfFile(output.toByteArray());

      assertThrows(IllegalArgumentException.class, () -> service.extract(file));
    }
  }

  private byte[] pdfWithImages(int pageOneImages, int pageTwoImages) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      addPageWithImages(document, pageOneImages);
      addPageWithImages(document, pageTwoImages);
      document.save(output);
      return output.toByteArray();
    }
  }

  private void addPageWithImages(PDDocument document, int count) throws Exception {
    PDPage page = new PDPage();
    document.addPage(page);
    try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
      for (int i = 0; i < count; i++) {
        BufferedImage img = new BufferedImage(5, 5, BufferedImage.TYPE_INT_RGB);
        PDImageXObject image = LosslessFactory.createFromImage(document, img);
        stream.drawImage(image, 10 + i * 20, 10, 15, 15);
      }
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
