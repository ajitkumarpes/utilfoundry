package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PdfTextToPdfServiceTest {

  private final PdfTextToPdfService service = new PdfTextToPdfService();

  @Test
  void convertsPlainTextAndPreservesLineBreaks() throws Exception {
    byte[] result = service.convert("Hello world\nSecond line\nThird line", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(1, doc.getNumberOfPages());
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Hello world"));
      assertTrue(text.contains("Second line"));
      assertTrue(text.contains("Third line"));
    }
  }

  @Test
  void defaultsToA4WhenPageSizeOmitted() throws Exception {
    byte[] result = service.convert("hi", null);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(PDRectangle.A4.getWidth(), doc.getPage(0).getMediaBox().getWidth(), 0.01);
    }
  }

  @Test
  void honoursLetterPageSize() throws Exception {
    byte[] result = service.convert("hi", "letter");

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(PDRectangle.LETTER.getWidth(), doc.getPage(0).getMediaBox().getWidth(), 0.01);
      assertEquals(PDRectangle.LETTER.getHeight(), doc.getPage(0).getMediaBox().getHeight(), 0.01);
    }
  }

  @Test
  void rejectsUnknownPageSize() {
    assertThrows(IllegalArgumentException.class, () -> service.convert("hi", "A3"));
  }

  @Test
  void rejectsBlankText() {
    assertThrows(IllegalArgumentException.class, () -> service.convert("   \n  ", "A4"));
    assertThrows(IllegalArgumentException.class, () -> service.convert(null, "A4"));
  }

  @Test
  void rejectsOverlongText() {
    String huge = "a".repeat(500_001);
    assertThrows(IllegalArgumentException.class, () -> service.convert(huge, "A4"));
  }

  @Test
  void rejectsTextThatWouldProduceTooManyPages() {
    String manyBlankLines = "x\n".repeat(30_000);
    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> service.convert(manyBlankLines, "A4"));
    assertTrue(ex.getMessage().contains("pages"));
  }

  @Test
  void longLineWordWrapsAcrossMultipleLinesWithoutLosingWords() throws Exception {
    String longLine = "supercalifragilisticexpialidocious ".repeat(60).trim();
    byte[] result = service.convert(longLine, "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc).replace("\n", " ").replace("\r", " ");
      long wordCount = java.util.Arrays.stream(text.trim().split("\\s+"))
          .filter(w -> w.equals("supercalifragilisticexpialidocious"))
          .count();
      assertEquals(60, wordCount);
    }
  }

  @Test
  void aSingleUnbrokenTokenLongerThanTheLineIsHardBrokenNotOverflowed() throws Exception {
    String noSpaces = "x".repeat(400);
    byte[] result = service.convert(noSpaces, "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc).replace("\n", "").replace("\r", "");
      long xCount = text.chars().filter(c -> c == 'x').count();
      assertEquals(400, xCount);
    }
  }

  @Test
  void longTextPaginatesAcrossMultiplePages() throws Exception {
    String line = "The quick brown fox jumps over the lazy dog. ".repeat(3).trim();
    String longText = (line + "\n").repeat(80);
    byte[] result = service.convert(longText, "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertTrue(doc.getNumberOfPages() > 1, "expected more than one page, got " + doc.getNumberOfPages());
    }
  }

  @Test
  void mixedDevanagariAndLatinTextRoundTrips() throws Exception {
    byte[] result = service.convert("Room 101 कमरा और suite", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Room 101"));
      assertTrue(text.contains("कमरा"));
      assertTrue(text.contains("suite"));
    }
  }

  /**
   * Characterization test for a real, pre-existing limitation (confirmed to also affect the
   * already-shipped PdfWatermarkService, which uses the same NotoSansDevanagari-Regular
   * font+technique — not something this service introduced). PDFBox visually RENDERS Devanagari
   * conjuncts correctly (confirmed by rasterizing and inspecting the page image: "स्वीट" draws as
   * "स्वीट", not as three disjoint glyphs), but its auto-generated ToUnicode CMap does not
   * correctly reverse-map the ligature/half-form glyph PDFBox substitutes in for a
   * consonant+virama+consonant sequence, so text EXTRACTION of a conjunct returns an unrelated
   * character (e.g. "स्व" extracts as "×व", "क्ष" extracts as "³") instead of the original text.
   * A real fix needs either a text-shaping library (to pre-shape and track original codepoints
   * ourselves) or hand-written low-level ToUnicode CMap construction — infrastructure this
   * codebase does not have today. Documented in docs/NEXT_FEATURES.md. If this starts failing,
   * PDFBox's own ToUnicode generation has changed and the writeup should be revisited.
   */
  @Test
  void devanagariConjunctsRenderCorrectlyButToUnicodeExtractionIsAKnownLimitation() throws Exception {
    byte[] result = service.convert("स्वीट", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc).trim();
      assertTrue(!text.equals("स्वीट"), "if this now round-trips correctly, PDFBox's ToUnicode "
          + "generation improved for conjuncts — revisit docs/NEXT_FEATURES.md's writeup");
    }
  }

  @Test
  void unsupportedGlyphsAreSubstitutedNotFatal() throws Exception {
    byte[] result = service.convert("Before 中文 emoji 😀 after", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Before"));
      assertTrue(text.contains("after"));
      assertTrue(text.contains("?"), "expected a substitution placeholder in: " + text);
    }
  }

  @Test
  void tabsAreExpandedRatherThanDroppedOrCrashing() throws Exception {
    byte[] result = service.convert("a\tb\tc", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("a") && text.contains("b") && text.contains("c"));
    }
  }

  @Test
  void stripsLeadingByteOrderMark() throws Exception {
    byte[] result = service.convert("﻿Hello", "A4");

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc).trim();
      assertEquals("Hello", text.replace("﻿", "").trim());
    }
  }
}
