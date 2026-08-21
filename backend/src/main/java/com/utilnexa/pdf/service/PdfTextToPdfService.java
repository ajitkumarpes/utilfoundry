package com.utilnexa.pdf.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class PdfTextToPdfService {

  private static final int MAX_TEXT_LENGTH = 500_000;
  private static final int MAX_PAGES = 500;
  private static final float FONT_SIZE = 11f;
  private static final float LEADING = FONT_SIZE * 1.4f;
  private static final float MARGIN = 50f;
  private static final int TAB_WIDTH = 4;
  private static final char DEVANAGARI_BLOCK_START = 'ऀ';
  private static final char DEVANAGARI_BLOCK_END = 'ॿ';
  private static final Pattern TOKEN_PATTERN = Pattern.compile("\\s+|\\S+");

  private static final byte[] LATIN_UNICODE_FONT_BYTES = readClasspathFont("fonts/NotoSans-Regular.ttf");
  private static final byte[] DEVANAGARI_FONT_BYTES = readClasspathFont("fonts/NotoSansDevanagari-Regular.ttf");

  public byte[] convert(String text, String pageSizeParam) throws IOException {
    String content = normalize(text);
    PDRectangle pageSize = resolvePageSize(pageSizeParam);
    float maxWidth = pageSize.getWidth() - 2 * MARGIN;

    try (PDDocument document = new PDDocument()) {
      PDFont courier = new PDType1Font(Standard14Fonts.FontName.COURIER);
      PDFont latinUnicode = PDType0Font.load(document, new ByteArrayInputStream(LATIN_UNICODE_FONT_BYTES));
      PDFont devanagari = PDType0Font.load(document, new ByteArrayInputStream(DEVANAGARI_FONT_BYTES));
      Map<Character, Glyph> cache = new HashMap<>();

      int pageCount = 0;
      PDPageContentStream stream = null;
      float y = 0;

      for (String physicalLine : content.split("\n", -1)) {
        for (List<Glyph> outputLine : wrapLine(physicalLine, courier, latinUnicode, devanagari, cache, maxWidth)) {
          if (stream == null || y - LEADING < MARGIN) {
            if (stream != null) {
              stream.endText();
              stream.close();
            }
            pageCount++;
            if (pageCount > MAX_PAGES) {
              throw new IllegalArgumentException(
                  "This text produces more than " + MAX_PAGES + " pages. Please split it into smaller files.");
            }
            PDPage page = new PDPage(pageSize);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            stream.beginText();
            y = pageSize.getHeight() - MARGIN;
            stream.newLineAtOffset(MARGIN, y);
          } else {
            stream.newLineAtOffset(0, -LEADING);
            y -= LEADING;
          }

          for (Run run : mergeRuns(outputLine)) {
            stream.setFont(run.font(), FONT_SIZE);
            stream.showText(run.text());
          }
        }
      }

      stream.endText();
      stream.close();

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("PDF generation produced an empty document.");
      }
      return out;
    }
  }

  /**
   * Wraps one physical (newline-delimited) line into one or more output lines that each fit
   * {@code maxWidth}, breaking on whitespace where possible. A single token wider than
   * {@code maxWidth} on its own (e.g. a long URL) is hard-broken character by character rather
   * than left to overflow the page.
   */
  private List<List<Glyph>> wrapLine(
      String physicalLine, PDFont courier, PDFont latinUnicode, PDFont devanagari,
      Map<Character, Glyph> cache, float maxWidth) {
    String expanded = expandTabs(physicalLine);
    if (expanded.isEmpty()) {
      return List.of(List.of());
    }

    List<Glyph> chars = new ArrayList<>(expanded.length());
    for (int i = 0; i < expanded.length(); i++) {
      chars.add(resolveChar(expanded.charAt(i), courier, latinUnicode, devanagari, cache));
    }

    List<List<Glyph>> outputLines = new ArrayList<>();
    List<Glyph> currentLine = new ArrayList<>();
    float currentWidth = 0f;

    Matcher m = TOKEN_PATTERN.matcher(expanded);
    while (m.find()) {
      int start = m.start();
      int end = m.end();
      float tokenWidth = 0f;
      for (int i = start; i < end; i++) {
        tokenWidth += chars.get(i).width();
      }

      if (tokenWidth > maxWidth) {
        if (!currentLine.isEmpty()) {
          outputLines.add(currentLine);
          currentLine = new ArrayList<>();
          currentWidth = 0f;
        }
        List<Glyph> chunk = new ArrayList<>();
        float chunkWidth = 0f;
        for (int i = start; i < end; i++) {
          Glyph g = chars.get(i);
          if (chunkWidth + g.width() > maxWidth && !chunk.isEmpty()) {
            outputLines.add(chunk);
            chunk = new ArrayList<>();
            chunkWidth = 0f;
          }
          chunk.add(g);
          chunkWidth += g.width();
        }
        currentLine = chunk;
        currentWidth = chunkWidth;
        continue;
      }

      if (currentWidth + tokenWidth > maxWidth) {
        outputLines.add(currentLine);
        currentLine = new ArrayList<>();
        currentWidth = 0f;
      }
      for (int i = start; i < end; i++) {
        currentLine.add(chars.get(i));
      }
      currentWidth += tokenWidth;
    }

    outputLines.add(currentLine);
    return outputLines;
  }

  private List<Run> mergeRuns(List<Glyph> line) {
    List<Run> runs = new ArrayList<>();
    PDFont currentFont = null;
    StringBuilder currentText = new StringBuilder();
    for (Glyph g : line) {
      if (currentFont != null && g.font() != currentFont) {
        runs.add(new Run(currentFont, currentText.toString()));
        currentText.setLength(0);
      }
      currentFont = g.font();
      currentText.append(g.text());
    }
    if (currentFont != null) {
      runs.add(new Run(currentFont, currentText.toString()));
    }
    return runs;
  }

  /**
   * Resolves one character to a font able to draw it, preferring genuinely monospaced Courier
   * (WinAnsiEncoding) so plain-ASCII text and pasted code keep aligned columns; Devanagari uses
   * the bundled Devanagari font; anything else falls back to the broader-coverage NotoSans
   * Unicode font. A character neither font can encode (e.g. CJK or emoji, confirmed by empirical
   * probe to throw IllegalArgumentException rather than silently mis-render) is substituted with
   * "?" instead of failing the whole document.
   */
  private Glyph resolveChar(
      char c, PDFont courier, PDFont latinUnicode, PDFont devanagari, Map<Character, Glyph> cache) {
    Glyph cached = cache.get(c);
    if (cached != null) {
      return cached;
    }
    Glyph resolved;
    if (c >= DEVANAGARI_BLOCK_START && c <= DEVANAGARI_BLOCK_END) {
      resolved = measure(devanagari, String.valueOf(c));
    } else {
      Glyph viaCourier = tryMeasure(courier, String.valueOf(c));
      if (viaCourier != null) {
        resolved = viaCourier;
      } else {
        Glyph viaNoto = tryMeasure(latinUnicode, String.valueOf(c));
        resolved = viaNoto != null ? viaNoto : measure(courier, "?");
      }
    }
    cache.put(c, resolved);
    return resolved;
  }

  private Glyph tryMeasure(PDFont font, String s) {
    try {
      return measure(font, s);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private Glyph measure(PDFont font, String s) {
    try {
      float width = font.getStringWidth(s) / 1000 * FONT_SIZE;
      return new Glyph(font, s, width);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static String expandTabs(String line) {
    if (line.indexOf('\t') < 0) {
      return line;
    }
    StringBuilder sb = new StringBuilder(line.length());
    int col = 0;
    for (int i = 0; i < line.length(); i++) {
      char c = line.charAt(i);
      if (c == '\t') {
        int spaces = TAB_WIDTH - (col % TAB_WIDTH);
        for (int j = 0; j < spaces; j++) {
          sb.append(' ');
          col++;
        }
      } else {
        sb.append(c);
        col++;
      }
    }
    return sb.toString();
  }

  private String normalize(String text) {
    if (text == null || text.isBlank()) {
      throw new IllegalArgumentException("Text is required.");
    }
    String normalized = text;
    if (!normalized.isEmpty() && normalized.charAt(0) == '﻿') {
      normalized = normalized.substring(1);
    }
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n");
    if (normalized.length() > MAX_TEXT_LENGTH) {
      throw new IllegalArgumentException("Text must be " + MAX_TEXT_LENGTH + " characters or fewer.");
    }
    return normalized;
  }

  private PDRectangle resolvePageSize(String pageSize) {
    if (pageSize == null || pageSize.isBlank()) {
      return PDRectangle.A4;
    }
    return switch (pageSize.trim().toUpperCase()) {
      case "A4" -> PDRectangle.A4;
      case "LETTER" -> PDRectangle.LETTER;
      default -> throw new IllegalArgumentException("pageSize must be A4 or LETTER.");
    };
  }

  private static byte[] readClasspathFont(String classpathPath) {
    try (InputStream in = new ClassPathResource(classpathPath).getInputStream()) {
      return in.readAllBytes();
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to load bundled font: " + classpathPath, e);
    }
  }

  private record Glyph(PDFont font, String text, float width) {}

  private record Run(PDFont font, String text) {}
}
