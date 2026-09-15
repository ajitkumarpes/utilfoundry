package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.BookmarkEntry;

import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfBookmarkServiceTest {

  private final PdfBookmarkService service = new PdfBookmarkService();

  @Test
  void freshPdfHasNoBookmarks() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));

    assertEquals(List.of(), service.readBookmarks(file).bookmarks());
  }

  @Test
  void readReportsTheRealPageCount() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(7));

    assertEquals(7, service.readBookmarks(file).pageCount());
  }

  @Test
  void writtenBookmarksRoundTripInOrder() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(5));
    List<BookmarkEntry> written = List.of(
        new BookmarkEntry(0, "Cover"),
        new BookmarkEntry(2, "Chapter 2"),
        new BookmarkEntry(4, "Appendix"));

    byte[] result = service.writeBookmarks(file, written);

    List<BookmarkEntry> readBack = service.readBookmarks(pdfFile(result)).bookmarks();
    assertEquals(written, readBack);
  }

  @Test
  void emptyListClearsAnExistingOutline() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));
    byte[] withBookmarks = service.writeBookmarks(file, List.of(new BookmarkEntry(0, "Cover")));
    assertEquals(1, service.readBookmarks(pdfFile(withBookmarks)).bookmarks().size());

    byte[] cleared = service.writeBookmarks(pdfFile(withBookmarks), List.of());

    assertEquals(List.of(), service.readBookmarks(pdfFile(cleared)).bookmarks());
  }

  @Test
  void outOfRangePageRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));

    assertThrows(
        IllegalArgumentException.class,
        () -> service.writeBookmarks(file, List.of(new BookmarkEntry(5, "Nowhere"))));
  }

  @Test
  void blankTitleRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));

    assertThrows(
        IllegalArgumentException.class,
        () -> service.writeBookmarks(file, List.of(new BookmarkEntry(0, "   "))));
  }

  @Test
  void tooManyEntriesRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    List<BookmarkEntry> tooMany = java.util.stream.IntStream.range(0, 201)
        .mapToObj(i -> new BookmarkEntry(0, "Entry " + i))
        .toList();

    assertThrows(IllegalArgumentException.class, () -> service.writeBookmarks(file, tooMany));
  }

  @Test
  void bookmarkedPdfIsStillAValidReadablePdf() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2));

    byte[] result = service.writeBookmarks(file, List.of(new BookmarkEntry(1, "Second page")));

    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(result)) {
      assertTrue(doc.getDocumentCatalog().getDocumentOutline().hasChildren());
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
