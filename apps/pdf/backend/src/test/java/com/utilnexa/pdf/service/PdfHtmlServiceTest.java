package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PdfHtmlServiceTest {

  private final PdfHtmlService service = new PdfHtmlService();

  @Test
  void rendersBasicHtml() throws Exception {
    byte[] result = service.convert("<h1>Title</h1><p>Body paragraph text.</p>", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Title"));
      assertTrue(text.contains("Body paragraph text."));
    }
  }

  @Test
  void appliesInlineCssStyling() throws Exception {
    byte[] result = service.convert(
        "<html><head><style>p { font-weight: bold; }</style></head>"
            + "<body><p>Styled paragraph.</p></body></html>",
        "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Styled paragraph."));
    }
  }

  @Test
  void rendersDataUriImageWithoutError() throws Exception {
    String pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    byte[] result = service.convert("<p>Before</p><img src=\"" + pixel + "\"><p>After</p>", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Before"));
      assertTrue(text.contains("After"));
    }
  }

  @Test
  void defaultsToA4AndHonoursLetter() throws Exception {
    byte[] a4 = service.convert("<p>hi</p>", null);
    try (PDDocument doc = Loader.loadPDF(a4)) {
      float widthPt = doc.getPage(0).getMediaBox().getWidth();
      assertEquals(595, Math.round(widthPt), 2);
    }

    byte[] letter = service.convert("<p>hi</p>", "letter");
    try (PDDocument doc = Loader.loadPDF(letter)) {
      float widthPt = doc.getPage(0).getMediaBox().getWidth();
      assertEquals(612, Math.round(widthPt), 2);
    }
  }

  @Test
  void rejectsUnknownPageSize() {
    assertThrows(IllegalArgumentException.class, () -> service.convert("<p>hi</p>", "A3"));
  }

  @Test
  void rejectsBlankHtml() {
    assertThrows(IllegalArgumentException.class, () -> service.convert("   \n  ", "A4"));
    assertThrows(IllegalArgumentException.class, () -> service.convert(null, "A4"));
  }

  @Test
  void rejectsOverlongHtml() {
    String huge = "<p>a</p>".repeat(70_000);
    assertThrows(IllegalArgumentException.class, () -> service.convert(huge, "A4"));
  }
}
