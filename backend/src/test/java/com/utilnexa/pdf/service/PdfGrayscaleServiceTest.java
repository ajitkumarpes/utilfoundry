package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfGrayscaleServiceTest {

  private final PdfGrayscaleService service = new PdfGrayscaleService();

  @Test
  void embeddedColorImageBecomesGrayscale() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithRedImage());

    byte[] result = service.grayscale(file);

    try (PDDocument doc = Loader.loadPDF(result)) {
      COSName name = doc.getPage(0).getResources().getXObjectNames().iterator().next();
      PDImageXObject image = (PDImageXObject) doc.getPage(0).getResources().getXObject(name);
      BufferedImage buffered = image.getImage();
      int rgb = buffered.getRGB(0, 0);
      int r = (rgb >> 16) & 0xFF;
      int g = (rgb >> 8) & 0xFF;
      int b = rgb & 0xFF;
      assertEquals(r, g);
      assertEquals(g, b);
      assertTrue(r < 255);
    }
  }

  private byte[] pdfWithRedImage() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      BufferedImage red = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
      for (int x = 0; x < 10; x++) {
        for (int y = 0; y < 10; y++) {
          red.setRGB(x, y, 0xFF0000);
        }
      }
      PDImageXObject image = LosslessFactory.createFromImage(document, red);

      try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
        stream.drawImage(image, 50, 50, 100, 100);
      }

      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
