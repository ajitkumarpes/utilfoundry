package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.HeaderFooterRequest;
import com.utilnexa.pdf.api.dto.HeaderFooterZone;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfHeaderFooterServiceTest {

  private final PdfHeaderFooterService service = new PdfHeaderFooterService();

  @Test
  void textZoneAppearsOnEveryPage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));
    HeaderFooterRequest request = requestWith("bottomCenter", new HeaderFooterZone("TEXT", "CONFIDENTIAL", null, null, null));

    byte[] result = service.apply(file, request);

    String text = extractText(result);
    assertTrue(text.contains("CONFIDENTIAL"));
    assertTrue(countOccurrences(text, "CONFIDENTIAL") >= 3);
  }

  @Test
  void pageNumberZoneIncrementsPerPage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));
    HeaderFooterRequest request = requestWith("bottomRight", new HeaderFooterZone("PAGE_NUMBER", null, null, null, null));

    byte[] result = service.apply(file, request);

    String text = extractText(result);
    assertTrue(text.contains("Page 1"));
    assertTrue(text.contains("Page 2"));
    assertTrue(text.contains("Page 3"));
  }

  @Test
  void dateZoneShowsTodaysDate() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    HeaderFooterRequest request = requestWith("topLeft", new HeaderFooterZone("DATE", null, null, null, null));

    byte[] result = service.apply(file, request);

    String expected = LocalDate.now().format(DateTimeFormatter.ofPattern("MMM d, yyyy"));
    assertTrue(extractText(result).contains(expected));
  }

  @Test
  void batesZoneIncrementsWithPrefixAndPadding() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));
    HeaderFooterRequest request =
        requestWith("bottomLeft", new HeaderFooterZone("BATES", null, "DOC-", 4, 100));

    byte[] result = service.apply(file, request);

    String text = extractText(result);
    assertTrue(text.contains("DOC-0100"));
    assertTrue(text.contains("DOC-0101"));
    assertTrue(text.contains("DOC-0102"));
  }

  @Test
  void multipleZonesOnSamePageAllRender() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    HeaderFooterRequest request = new HeaderFooterRequest(
        new HeaderFooterZone("TEXT", "Top Left", null, null, null),
        new HeaderFooterZone("TEXT", "Top Center", null, null, null),
        new HeaderFooterZone("TEXT", "Top Right", null, null, null),
        new HeaderFooterZone("TEXT", "Bottom Left", null, null, null),
        new HeaderFooterZone("PAGE_NUMBER", null, null, null, null),
        new HeaderFooterZone("TEXT", "Bottom Right", null, null, null));

    byte[] result = service.apply(file, request);

    String text = extractText(result);
    assertTrue(text.contains("Top Left"));
    assertTrue(text.contains("Top Center"));
    assertTrue(text.contains("Top Right"));
    assertTrue(text.contains("Bottom Left"));
    assertTrue(text.contains("Page 1"));
    assertTrue(text.contains("Bottom Right"));
  }

  @Test
  void nothingConfiguredIsRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    HeaderFooterRequest empty = new HeaderFooterRequest(null, null, null, null, null, null);

    assertThrows(IllegalArgumentException.class, () -> service.apply(file, empty));
  }

  @Test
  void blankTextZoneRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    HeaderFooterRequest request = requestWith("topLeft", new HeaderFooterZone("TEXT", "   ", null, null, null));

    assertThrows(IllegalArgumentException.class, () -> service.apply(file, request));
  }

  @Test
  void invalidBatesDigitsRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    HeaderFooterRequest request = requestWith("topLeft", new HeaderFooterZone("BATES", null, "X-", 0, 1));

    assertThrows(IllegalArgumentException.class, () -> service.apply(file, request));
  }

  private HeaderFooterRequest requestWith(String slot, HeaderFooterZone zone) {
    HeaderFooterZone none = null;
    return switch (slot) {
      case "topLeft" -> new HeaderFooterRequest(zone, none, none, none, none, none);
      case "topCenter" -> new HeaderFooterRequest(none, zone, none, none, none, none);
      case "topRight" -> new HeaderFooterRequest(none, none, zone, none, none, none);
      case "bottomLeft" -> new HeaderFooterRequest(none, none, none, zone, none, none);
      case "bottomCenter" -> new HeaderFooterRequest(none, none, none, none, zone, none);
      case "bottomRight" -> new HeaderFooterRequest(none, none, none, none, none, zone);
      default -> throw new IllegalArgumentException(slot);
    };
  }

  private int countOccurrences(String haystack, String needle) {
    int count = 0;
    int index = 0;
    while ((index = haystack.indexOf(needle, index)) != -1) {
      count++;
      index += needle.length();
    }
    return count;
  }

  private String extractText(byte[] pdf) throws Exception {
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      return new PDFTextStripper().getText(doc);
    }
  }

  private byte[] pdfWithPages(int count) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      for (int i = 0; i < count; i++) {
        document.addPage(new PDPage());
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
