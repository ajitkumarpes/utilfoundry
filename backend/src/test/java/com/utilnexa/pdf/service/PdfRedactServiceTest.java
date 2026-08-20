package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.RedactionArea;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfRedactServiceTest {

  private final PdfRedactService service = new PdfRedactService();

  @Test
  void textInsideRedactionAreaIsGenuinelyRemovedFromExtraction() throws Exception {
    float pageW = PDRectangle.A4.getWidth();
    float pageH = PDRectangle.A4.getHeight();

    // "SECRET123" baseline at (40, 700); "KEEP-ME" baseline far below at (40, 50).
    MockMultipartFile file = pdfFile(pdfWithTwoStrings());

    // Generous box around the secret string only.
    float rectX = 30, rectTop = 730, rectBottom = 680, rectRight = 260;
    RedactionArea area =
        new RedactionArea(
            0,
            rectX / pageW,
            (pageH - rectTop) / pageH,
            (rectRight - rectX) / pageW,
            (rectTop - rectBottom) / pageH);

    byte[] result = service.redact(file, List.of(area));

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertFalse(text.contains("SECRET123"), "redacted text must not survive extraction: " + text);
      assertTrue(text.contains("KEEP-ME"), "text outside the redaction area must be preserved");
    }
  }

  @Test
  void redactedRegionIsCoveredWithAnOpaqueBox() throws Exception {
    float pageW = PDRectangle.A4.getWidth();
    float pageH = PDRectangle.A4.getHeight();
    MockMultipartFile file = pdfFile(pdfWithTwoStrings());

    RedactionArea area = new RedactionArea(0, 30 / pageW, (pageH - 730) / pageH, 230 / pageW, 50 / pageH);
    byte[] result = service.redact(file, List.of(area));

    try (PDDocument doc = Loader.loadPDF(result)) {
      var renderer = new org.apache.pdfbox.rendering.PDFRenderer(doc);
      BufferedImage rendered = renderer.renderImageWithDPI(0, 72);
      int x = (int) (35 * (rendered.getWidth() / pageW));
      int y = (int) ((pageH - 710) * (rendered.getHeight() / pageH));
      int rgb = rendered.getRGB(Math.min(x, rendered.getWidth() - 1), Math.min(y, rendered.getHeight() - 1));
      int r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
      assertTrue(r < 40 && g < 40 && b < 40, "redacted region should render as solid black, was rgb(" + r + "," + g + "," + b + ")");
    }
  }

  @Test
  void embeddedImageInRedactionAreaIsDropped() throws Exception {
    float pageW = PDRectangle.A4.getWidth();
    float pageH = PDRectangle.A4.getHeight();
    MockMultipartFile file = pdfFile(pdfWithImage());

    RedactionArea area = new RedactionArea(0, 40 / pageW, (pageH - 250) / pageH, 120 / pageW, 120 / pageH);
    byte[] result = service.redact(file, List.of(area));

    try (PDDocument doc = Loader.loadPDF(result)) {
      var renderer = new org.apache.pdfbox.rendering.PDFRenderer(doc);
      BufferedImage rendered = renderer.renderImageWithDPI(0, 72);
      int cx = (int) (100 * (rendered.getWidth() / pageW));
      int cy = (int) ((pageH - 180) * (rendered.getHeight() / pageH));
      int rgb = rendered.getRGB(Math.min(cx, rendered.getWidth() - 1), Math.min(cy, rendered.getHeight() - 1));
      int r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
      assertTrue(r < 40 && g < 40 && b < 40, "the red image must not still be visible under the redaction box");

      // The black cover alone would also satisfy the pixel check above even if the
      // underlying Do operator were never actually dropped, so confirm directly on the
      // rewritten content stream that no Do operator survived — proving real removal,
      // not just a visual overlay.
      var parser = new org.apache.pdfbox.pdfparser.PDFStreamParser(doc.getPage(0));
      long doOps =
          parser.parse().stream()
              .filter(t -> t instanceof org.apache.pdfbox.contentstream.operator.Operator)
              .filter(t -> "Do".equals(((org.apache.pdfbox.contentstream.operator.Operator) t).getName()))
              .count();
      assertEquals(0, doOps, "the Do operator drawing the redacted image must be removed from the content stream");
    }
  }

  @Test
  void noRedactionAreasRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithTwoStrings());
    assertThrows(IllegalArgumentException.class, () -> service.redact(file, List.of()));
  }

  private byte[] pdfWithTwoStrings() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.A4);
      document.addPage(page);
      try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
        stream.beginText();
        stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
        stream.newLineAtOffset(40, 700);
        stream.showText("SECRET123");
        stream.endText();

        stream.beginText();
        stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
        stream.newLineAtOffset(40, 50);
        stream.showText("KEEP-ME");
        stream.endText();
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private byte[] pdfWithImage() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.A4);
      document.addPage(page);

      BufferedImage red = new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB);
      for (int x = 0; x < 50; x++) {
        for (int y = 0; y < 50; y++) {
          red.setRGB(x, y, 0xFF0000);
        }
      }
      PDImageXObject image = LosslessFactory.createFromImage(document, red);

      try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
        stream.drawImage(image, 50, 150, 100, 100);
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
