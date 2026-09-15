package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;

import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class ImageToPdfServiceTest {

  private final ImageToPdfService service = new ImageToPdfService();

  @Test
  void convertsEachImageToItsOwnPage() throws Exception {
    MockMultipartFile jpg = imageFile("a.jpg", "image/jpeg", 400, 300);
    MockMultipartFile png = imageFile("b.png", "image/png", 300, 500);

    byte[] result = service.convert(List.of(jpg, png));

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
    }
  }

  @Test
  void rejectsNonImageFile() {
    MockMultipartFile notAnImage =
        new MockMultipartFile("files", "doc.pdf", "application/pdf", new byte[] {1, 2, 3});

    assertThrows(IllegalArgumentException.class, () -> service.convert(List.of(notAnImage)));
  }

  @Test
  void rejectsEmptyFileList() {
    assertThrows(IllegalArgumentException.class, () -> service.convert(List.of()));
  }

  private MockMultipartFile imageFile(String name, String contentType, int w, int h) throws Exception {
    BufferedImage image = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    String formatName = contentType.equals("image/png") ? "png" : "jpg";
    ImageIO.write(image, formatName, out);
    return new MockMultipartFile("files", name, contentType, out.toByteArray());
  }
}
