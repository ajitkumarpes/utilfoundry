package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfCropServiceTest {

  private final PdfCropService service = new PdfCropService();

  @Test
  void cropBoxShrinksToTheDrawnContent() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithSmallCenteredImage());

    byte[] result = service.crop(file, "standard");

    try (PDDocument doc = Loader.loadPDF(result)) {
      PDRectangle cropBox = doc.getPage(0).getCropBox();
      PDRectangle mediaBox = doc.getPage(0).getMediaBox();
      assertTrue(cropBox.getWidth() < mediaBox.getWidth());
      assertTrue(cropBox.getHeight() < mediaBox.getHeight());
    }
  }

  @Test
  void invalidModeRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithSmallCenteredImage());

    assertThrows(IllegalArgumentException.class, () -> service.crop(file, "extreme"));
  }

  private byte[] pdfWithSmallCenteredImage() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.A4);
      document.addPage(page);

      BufferedImage black = new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB);
      PDImageXObject image = LosslessFactory.createFromImage(document, black);

      try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
        stream.drawImage(image, 200, 300, 100, 100);
      }

      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
