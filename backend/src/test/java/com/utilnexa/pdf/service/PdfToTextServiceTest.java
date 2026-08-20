package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfToTextServiceTest {

  private final PdfToTextService service = new PdfToTextService();

  @Test
  void extractsTextFromEveryPage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithTextOnTwoPages());

    byte[] result = service.extractText(file);
    String text = new String(result, StandardCharsets.UTF_8);

    assertTrue(text.contains("Page one content"));
    assertTrue(text.contains("Page two content"));
  }

  private byte[] pdfWithTextOnTwoPages() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      for (String pageText : new String[] {"Page one content", "Page two content"}) {
        PDPage page = new PDPage(PDRectangle.A4);
        document.addPage(page);
        try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
          stream.beginText();
          stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
          stream.newLineAtOffset(40, 700);
          stream.showText(pageText);
          stream.endText();
        }
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
