package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PdfMarkdownServiceTest {

  private final PdfMarkdownService service = new PdfMarkdownService();

  @Test
  void rendersHeadingsAndParagraphs() throws Exception {
    byte[] result = service.convert("# Title\n\nSome body text here.\n\n## Subheading\n\nMore body text.", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Title"));
      assertTrue(text.contains("Some body text here."));
      assertTrue(text.contains("Subheading"));
      assertTrue(text.contains("More body text."));
    }
  }

  @Test
  void rendersBoldItalicAndCodeSpans() throws Exception {
    byte[] result = service.convert("Plain **bold** and *italic* and `code span` text.", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Plain"));
      assertTrue(text.contains("bold"));
      assertTrue(text.contains("italic"));
      assertTrue(text.contains("code span"));
      assertTrue(text.contains("text."));
    }
  }

  @Test
  void rendersBulletAndOrderedLists() throws Exception {
    byte[] result = service.convert("- first\n- second\n- third\n\n1. one\n2. two\n3. three", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("first"));
      assertTrue(text.contains("second"));
      assertTrue(text.contains("third"));
      assertTrue(text.contains("one"));
      assertTrue(text.contains("two"));
      assertTrue(text.contains("three"));
    }
  }

  @Test
  void rendersNestedLists() throws Exception {
    byte[] result = service.convert("- top level\n  - nested one\n  - nested two\n- back to top", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("top level"));
      assertTrue(text.contains("nested one"));
      assertTrue(text.contains("nested two"));
      assertTrue(text.contains("back to top"));
    }
  }

  @Test
  void rendersFencedCodeBlockLiterally() throws Exception {
    byte[] result = service.convert("```python\ndef foo():\n    return 42\n```", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("def foo():"));
      assertTrue(text.contains("return 42"));
    }
  }

  @Test
  void rendersIndentedCodeBlockLiterally() throws Exception {
    byte[] result = service.convert("Normal paragraph.\n\n    indented code line\n    second line", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("indented code line"));
      assertTrue(text.contains("second line"));
    }
  }

  @Test
  void rendersBlockquoteText() throws Exception {
    byte[] result = service.convert("> quoted line one\n> quoted line two", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("quoted line one"));
      assertTrue(text.contains("quoted line two"));
    }
  }

  @Test
  void httpLinkBecomesAClickableAnnotation() throws Exception {
    byte[] result = service.convert("Visit [our site](https://example.com/page) today.", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      List<PDAnnotation> annotations = doc.getPage(0).getAnnotations();
      PDAnnotationLink link = annotations.stream()
          .filter(a -> a instanceof PDAnnotationLink)
          .map(a -> (PDAnnotationLink) a)
          .findFirst()
          .orElse(null);
      assertTrue(link != null, "expected a link annotation");
      PDActionURI action = (PDActionURI) link.getAction();
      assertEquals("https://example.com/page", action.getURI());

      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("our site"));
    }
  }

  @Test
  void nonHttpLinkDestinationIsDroppedNotEmbedded() throws Exception {
    byte[] result = service.convert("Click [here](javascript:alert(1)) now.", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      List<PDAnnotation> annotations = doc.getPage(0).getAnnotations();
      boolean anyLink = annotations.stream().anyMatch(a -> a instanceof PDAnnotationLink);
      assertFalse(anyLink, "javascript: URL must not become a clickable action");

      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("here"));
    }
  }

  @Test
  void thematicBreakDoesNotCrash() throws Exception {
    byte[] result = service.convert("Above the rule.\n\n---\n\nBelow the rule.", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Above the rule."));
      assertTrue(text.contains("Below the rule."));
    }
  }

  @Test
  void mixedDevanagariAndLatinRoundTripsWhenNonConjunct() throws Exception {
    byte[] result = service.convert("# कमरा Heading\n\nRoom **101** कमरा और suite.", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("कमरा"));
      assertTrue(text.contains("Room"));
      assertTrue(text.contains("101"));
      assertTrue(text.contains("suite."));
    }
  }

  @Test
  void longDocumentPaginatesAcrossMultiplePages() throws Exception {
    StringBuilder md = new StringBuilder();
    for (int i = 0; i < 80; i++) {
      md.append("## Heading ").append(i).append("\n\n");
      md.append("Paragraph text that repeats several times to fill up vertical space on the page. ".repeat(3));
      md.append("\n\n");
    }
    byte[] result = service.convert(md.toString(), "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertTrue(doc.getNumberOfPages() > 1, "expected more than one page, got " + doc.getNumberOfPages());
    }
  }

  @Test
  void defaultsToA4AndHonoursLetter() throws Exception {
    byte[] a4 = service.convert("hi", null);
    try (PDDocument doc = Loader.loadPDF(a4)) {
      assertEquals(PDRectangle.A4.getWidth(), doc.getPage(0).getMediaBox().getWidth(), 0.01);
    }

    byte[] letter = service.convert("hi", "letter");
    try (PDDocument doc = Loader.loadPDF(letter)) {
      assertEquals(PDRectangle.LETTER.getWidth(), doc.getPage(0).getMediaBox().getWidth(), 0.01);
    }
  }

  @Test
  void rejectsUnknownPageSize() {
    assertThrows(IllegalArgumentException.class, () -> service.convert("hi", "A3"));
  }

  @Test
  void rejectsBlankMarkdown() {
    assertThrows(IllegalArgumentException.class, () -> service.convert("   \n  ", "A4"));
    assertThrows(IllegalArgumentException.class, () -> service.convert(null, "A4"));
  }

  @Test
  void rejectsOverlongMarkdown() {
    String huge = "a ".repeat(300_000);
    assertThrows(IllegalArgumentException.class, () -> service.convert(huge, "A4"));
  }

  @Test
  void rejectsMarkdownThatWouldProduceTooManyPages() {
    StringBuilder md = new StringBuilder();
    for (int i = 0; i < 30_000; i++) {
      md.append("# H\n\n");
    }
    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> service.convert(md.toString(), "A4"));
    assertTrue(ex.getMessage().contains("pages"));
  }

  @Test
  void unsupportedGlyphsAreSubstitutedNotFatal() throws Exception {
    byte[] result = service.convert("Before 中文 emoji 😀 after.", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Before"));
      assertTrue(text.contains("after."));
    }
  }
}
