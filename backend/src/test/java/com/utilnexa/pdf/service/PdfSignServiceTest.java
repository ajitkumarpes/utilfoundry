package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.SignPlacement;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfSignServiceTest {

  private final PdfSignService service = new PdfSignService();

  @Test
  void placesSignatureImageOnTheGivenPage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2, PDRectangle.A4));
    MockMultipartFile signature = signatureImage();
    SignPlacement placement = new SignPlacement(1, 0.5f, 0.8f, 0.2f);

    byte[] result = service.sign(file, signature, placement);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
      assertTrue(doc.getPage(1).getResources().getXObjectNames().iterator().hasNext());
    }
  }

  @Test
  void outOfRangePageRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.A4));
    MockMultipartFile signature = signatureImage();
    SignPlacement placement = new SignPlacement(5, 0.1f, 0.1f, 0.2f);

    assertThrows(IllegalArgumentException.class, () -> service.sign(file, signature, placement));
  }

  @Test
  void missingSignatureImageRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.A4));
    SignPlacement placement = new SignPlacement(0, 0.1f, 0.1f, 0.2f);

    assertThrows(
        IllegalArgumentException.class,
        () -> service.sign(file, new MockMultipartFile("signatureImage", new byte[0]), placement));
  }

  private byte[] pdfWithPages(int count, PDRectangle size) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      for (int i = 0; i < count; i++) {
        document.addPage(new PDPage(size));
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile signatureImage() throws Exception {
    BufferedImage img = new BufferedImage(40, 20, BufferedImage.TYPE_INT_ARGB);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    ImageIO.write(img, "png", out);
    return new MockMultipartFile("signatureImage", "sig.png", "image/png", out.toByteArray());
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
