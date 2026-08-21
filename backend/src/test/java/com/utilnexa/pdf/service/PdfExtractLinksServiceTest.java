package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitWidthDestination;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfExtractLinksServiceTest {

  private final PdfExtractLinksService service = new PdfExtractLinksService();

  @Test
  void extractsUriLinksWithPageNumbersAsCsv() throws Exception {
    byte[] pdf = buildTwoPageDocumentWithUriLinksOnEachPage();

    byte[] result = service.extractLinks(pdfFile(pdf));
    String csv = new String(result, StandardCharsets.UTF_8);
    List<String> lines = csv.lines().toList();

    assertEquals("Page,URL", lines.get(0));
    assertEquals(3, lines.size());
    assertTrue(lines.contains("1,https://example.com/page-one"));
    assertTrue(lines.contains("2,https://example.com/page-two"));
  }

  @Test
  void linksWithoutAUriActionAreNotExtracted() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      PDAnnotationLink internalLink = new PDAnnotationLink();
      internalLink.setRectangle(new PDRectangle(10, 10, 30, 10));
      PDPageFitWidthDestination destination = new PDPageFitWidthDestination();
      destination.setPage(page);
      internalLink.setDestination(destination);
      page.setAnnotations(List.of(internalLink));

      document.save(output);
      MockMultipartFile file = pdfFile(output.toByteArray());

      assertThrows(IllegalArgumentException.class, () -> service.extractLinks(file));
    }
  }

  @Test
  void pdfWithNoLinksIsRejected() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      document.addPage(new PDPage());
      document.save(output);
      MockMultipartFile file = pdfFile(output.toByteArray());

      assertThrows(IllegalArgumentException.class, () -> service.extractLinks(file));
    }
  }

  @Test
  void urlsContainingCommasAreCsvQuoted() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      PDAnnotationLink link = new PDAnnotationLink();
      link.setRectangle(new PDRectangle(10, 10, 30, 10));
      PDActionURI action = new PDActionURI();
      action.setURI("https://example.com/search?q=a,b");
      link.setAction(action);
      page.setAnnotations(List.of(link));

      document.save(output);
      byte[] result = service.extractLinks(pdfFile(output.toByteArray()));
      String csv = new String(result, StandardCharsets.UTF_8);

      assertTrue(csv.contains("1,\"https://example.com/search?q=a,b\""));
    }
  }

  private byte[] buildTwoPageDocumentWithUriLinksOnEachPage() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      addLinkedPage(document, "https://example.com/page-one");
      addLinkedPage(document, "https://example.com/page-two");
      document.save(output);
      return output.toByteArray();
    }
  }

  private void addLinkedPage(PDDocument document, String uri) {
    PDPage page = new PDPage();
    document.addPage(page);

    PDAnnotationLink link = new PDAnnotationLink();
    link.setRectangle(new PDRectangle(10, 10, 30, 10));
    PDActionURI action = new PDActionURI();
    action.setURI(uri);
    link.setAction(action);
    page.setAnnotations(List.of(link));
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
