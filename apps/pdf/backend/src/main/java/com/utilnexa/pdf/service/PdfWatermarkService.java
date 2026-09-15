package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;

import java.awt.Color;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfWatermarkService {

  private static final float OPACITY = 0.3f;
  private static final float FONT_SIZE = 48f;
  private static final int MAX_TEXT_LENGTH = 80;
  private static final char DEVANAGARI_BLOCK_START = 'ऀ';
  private static final char DEVANAGARI_BLOCK_END = 'ॿ';

  private static final byte[] LATIN_UNICODE_FONT_BYTES = readClasspathFont("fonts/NotoSans-Regular.ttf");
  private static final byte[] DEVANAGARI_FONT_BYTES = readClasspathFont("fonts/NotoSansDevanagari-Regular.ttf");

  public byte[] watermark(MultipartFile file, String text, String position) throws IOException {
    PdfFileValidator.requirePdf(file);
    if (text == null || text.isBlank()) {
      throw new IllegalArgumentException("Watermark text is required.");
    }
    if (text.length() > MAX_TEXT_LENGTH) {
      throw new IllegalArgumentException("Watermark text must be " + MAX_TEXT_LENGTH + " characters or fewer.");
    }
    String pos = normalizePosition(position);
    boolean unicodeMode = containsDevanagari(text);
    List<TextRun> runs = unicodeMode ? splitRuns(text) : List.of(new TextRun(text, false));

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<RenderRun> renderRuns = new ArrayList<>();
      float totalWidth = 0f;
      for (TextRun run : runs) {
        PDFont font = unicodeMode
            ? loadUnicodeFont(document, run.devanagari())
            : new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
        float width = font.getStringWidth(run.text()) / 1000 * FONT_SIZE;
        renderRuns.add(new RenderRun(font, run.text(), width));
        totalWidth += width;
      }

      PDExtendedGraphicsState transparency = new PDExtendedGraphicsState();
      transparency.setNonStrokingAlphaConstant(OPACITY);

      for (PDPage page : document.getPages()) {
        PDRectangle box = page.getMediaBox();
        try (PDPageContentStream stream =
            new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
          stream.setNonStrokingColor(new Color(128, 128, 128));
          stream.setGraphicsStateParameters(transparency);
          stream.beginText();

          if ("diagonal".equals(pos)) {
            float centerX = box.getLowerLeftX() + box.getWidth() / 2 - totalWidth / 2;
            float centerY = box.getLowerLeftY() + box.getHeight() / 2;
            stream.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(45), centerX, centerY));
          } else {
            float x = box.getLowerLeftX() + (box.getWidth() - totalWidth) / 2;
            float y = box.getLowerLeftY() + box.getHeight() / 2;
            stream.newLineAtOffset(x, y);
          }

          for (RenderRun run : renderRuns) {
            stream.setFont(run.font(), FONT_SIZE);
            stream.showText(run.text());
          }

          stream.endText();
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Watermarking the PDF produced an empty document.");
      }
      return out;
    }
  }

  private PDFont loadUnicodeFont(PDDocument document, boolean devanagari) throws IOException {
    byte[] source = devanagari ? DEVANAGARI_FONT_BYTES : LATIN_UNICODE_FONT_BYTES;
    return PDType0Font.load(document, new ByteArrayInputStream(source));
  }

  private static boolean containsDevanagari(String text) {
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      if (c >= DEVANAGARI_BLOCK_START && c <= DEVANAGARI_BLOCK_END) {
        return true;
      }
    }
    return false;
  }

  /**
   * Splits text into consecutive runs of Devanagari vs. non-Devanagari characters. Needed
   * because NotoSansDevanagari-Regular.ttf covers only Devanagari + shared punctuation/digits —
   * it has no Latin letter glyphs (confirmed via hb-shape, not assumed) — so a mixed string like
   * "Room 101 कमरा" must be drawn as separate runs on the two different embedded fonts.
   */
  private static List<TextRun> splitRuns(String text) {
    List<TextRun> runs = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    Boolean currentIsDevanagari = null;
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      boolean isDevanagari = c >= DEVANAGARI_BLOCK_START && c <= DEVANAGARI_BLOCK_END;
      if (currentIsDevanagari != null && isDevanagari != currentIsDevanagari) {
        runs.add(new TextRun(current.toString(), currentIsDevanagari));
        current.setLength(0);
      }
      currentIsDevanagari = isDevanagari;
      current.append(c);
    }
    if (current.length() > 0) {
      runs.add(new TextRun(current.toString(), Boolean.TRUE.equals(currentIsDevanagari)));
    }
    return runs;
  }

  private static byte[] readClasspathFont(String classpathPath) {
    try (InputStream in = new ClassPathResource(classpathPath).getInputStream()) {
      return in.readAllBytes();
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to load bundled font: " + classpathPath, e);
    }
  }

  private String normalizePosition(String position) {
    if (position == null) return "center";
    String normalized = position.trim().toLowerCase();
    if (!normalized.equals("center") && !normalized.equals("diagonal")) {
      throw new IllegalArgumentException("position must be center or diagonal.");
    }
    return normalized;
  }

  private record TextRun(String text, boolean devanagari) {}

  private record RenderRun(PDFont font, String text, float width) {}
}
