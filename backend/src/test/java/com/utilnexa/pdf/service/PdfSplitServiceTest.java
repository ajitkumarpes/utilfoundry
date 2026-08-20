package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.NamedFile;

import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfSplitServiceTest {

  private final PdfSplitService service = new PdfSplitService();

  @Test
  void allModeSplitsEveryPageIntoItsOwnFile() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(4));

    List<NamedFile> results = service.split(file, "ALL", null);

    assertEquals(4, results.size());
    for (NamedFile named : results) {
      assertEquals("application/pdf", named.contentType());
      assertTrue(named.content().length > 0);
    }
  }

  @Test
  void singleRangeReturnsOneFile() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(10));

    List<NamedFile> results = service.split(file, "RANGES", "3-5");

    assertEquals(1, results.size());
    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(results.get(0).content())) {
      assertEquals(3, doc.getNumberOfPages());
    }
  }

  @Test
  void multipleRangesReturnOneFileEach() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(10));

    List<NamedFile> results = service.split(file, "RANGES", "1-2,4,6-8");

    assertEquals(3, results.size());
  }

  @Test
  void outOfRangePageRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(5));

    assertThrows(IllegalArgumentException.class, () -> service.split(file, "RANGES", "1-10"));
  }

  @Test
  void unknownModeRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2));

    assertThrows(IllegalArgumentException.class, () -> service.split(file, "BOGUS", null));
  }

  @Test
  void evenModeReturnsOnlyEvenPagesInOrder() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(5));

    List<NamedFile> results = service.split(file, "EVEN", null);

    assertEquals(1, results.size());
    assertEquals("even-pages.pdf", results.get(0).filename());
    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(results.get(0).content())) {
      assertEquals(2, doc.getNumberOfPages());
    }
  }

  @Test
  void oddModeReturnsOnlyOddPagesInOrder() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(5));

    List<NamedFile> results = service.split(file, "ODD", null);

    assertEquals(1, results.size());
    assertEquals("odd-pages.pdf", results.get(0).filename());
    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(results.get(0).content())) {
      assertEquals(3, doc.getNumberOfPages());
    }
  }

  @Test
  void evenModeRejectedForSinglePageDocument() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.split(file, "EVEN", null));
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
