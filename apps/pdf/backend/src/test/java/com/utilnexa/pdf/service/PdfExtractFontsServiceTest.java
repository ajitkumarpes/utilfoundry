package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.NamedFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAppearanceStream;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;

class PdfExtractFontsServiceTest {

  private final PdfExtractFontsService service = new PdfExtractFontsService();

  @Test
  void extractsOneEmbeddedFontEvenWhenUsedAcrossMultiplePages() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDFont font = PDType0Font.load(document, new ByteArrayInputStream(readBundledFont()));

      for (int i = 0; i < 2; i++) {
        PDPage page = new PDPage();
        document.addPage(page);
        try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
          cs.beginText();
          cs.setFont(font, 12);
          cs.newLineAtOffset(50, 700);
          cs.showText("Hello");
          cs.endText();
        }
      }

      document.save(output);
      List<NamedFile> results = service.extract(pdfFile(output.toByteArray()));

      assertEquals(1, results.size(), "the same embedded font referenced from two pages must be extracted once");
      NamedFile named = results.get(0);
      assertTrue(named.filename().endsWith(".ttf"));
      assertTrue(named.filename().contains("NotoSans"));
      assertEquals("font/ttf", named.contentType());
      assertTrue(named.content().length > 100);
    }
  }

  @Test
  void findsAFontNestedInsideAFormXObject() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      page.setResources(new PDResources());
      document.addPage(page);

      // PDPageContentStream has no constructor for a bare PDFormXObject - PDAppearanceStream
      // (which the service's recursion also matches, since it extends PDFormXObject) is the
      // form-like type PDFBox actually lets a caller open a content stream on directly.
      PDAppearanceStream form = new PDAppearanceStream(document);
      form.setBBox(new PDRectangle(0, 0, 100, 50));
      form.setResources(new PDResources());
      PDFont font = PDType0Font.load(document, new ByteArrayInputStream(readBundledFont()));
      try (PDPageContentStream formStream = new PDPageContentStream(document, form)) {
        formStream.beginText();
        formStream.setFont(font, 10);
        formStream.newLineAtOffset(2, 2);
        formStream.showText("Nested");
        formStream.endText();
      }

      page.getResources().put(COSName.getPDFName("Fm1"), form);
      try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
        cs.drawForm(form);
      }

      document.save(output);
      List<NamedFile> results = service.extract(pdfFile(output.toByteArray()));

      assertEquals(1, results.size());
      assertTrue(results.get(0).filename().endsWith(".ttf"));
    }
  }

  @Test
  void pdfWithOnlyNonEmbeddedStandardFontsIsRejected() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);
      try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        cs.newLineAtOffset(50, 700);
        cs.showText("No embedded font here");
        cs.endText();
      }
      document.save(output);
      MockMultipartFile file = pdfFile(output.toByteArray());

      assertThrows(IllegalArgumentException.class, () -> service.extract(file));
    }
  }

  private byte[] readBundledFont() {
    try (InputStream in = new ClassPathResource("fonts/NotoSans-Regular.ttf").getInputStream()) {
      return in.readAllBytes();
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
