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

  @Test
  void nestedBookmarksSurviveAnUnchangedReadAndSave() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(6));
    byte[] nested = service.writeBookmarks(file, List.of(
        new BookmarkEntry(0, "Chapter 1", 0),
        new BookmarkEntry(1, "Section 1.1", 1),
        new BookmarkEntry(2, "Section 1.2", 1),
        new BookmarkEntry(3, "Chapter 2", 0),
        new BookmarkEntry(4, "Section 2.1", 1),
        new BookmarkEntry(5, "Detail 2.1.1", 2)));

    List<BookmarkEntry> read = service.readBookmarks(pdfFile(nested)).bookmarks();
    byte[] resaved = service.writeBookmarks(pdfFile(nested), read);
    List<BookmarkEntry> reread = service.readBookmarks(pdfFile(resaved)).bookmarks();

    assertEquals(6, reread.size());
    assertEquals(List.of(0, 1, 1, 0, 1, 2), reread.stream().map(BookmarkEntry::depth).toList());
    assertEquals("Detail 2.1.1", reread.get(5).title());
    assertEquals(5, reread.get(5).pageIndex());
  }

  @Test
  void aLevelThatSkipsDepthsIsClampedIntoAValidTree() throws Exception {
    byte[] result = service.writeBookmarks(pdfFile(pdfWithPages(2)), List.of(
        new BookmarkEntry(0, "Top", 0),
        new BookmarkEntry(1, "Too deep", 4)));

    List<BookmarkEntry> read = service.readBookmarks(pdfFile(result)).bookmarks();

    assertEquals(List.of(0, 1), read.stream().map(BookmarkEntry::depth).toList());
  }
}
