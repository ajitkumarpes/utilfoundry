package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.BookmarkEntry;
import com.utilnexa.pdf.api.dto.BookmarksReadResult;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Reads/writes a flat list of page bookmarks (the PDF outline). Existing entries that point at a
 * URL or named destination rather than a page (rare, but real - e.g. a PDF built with a "visit
 * our website" bookmark) resolve to no destination page here and are reported at page 0; nested
 * sub-bookmarks aren't walked at all - this tool works on one flat list, and rewrites the whole
 * outline on save, same disclosed boundary as the frontend copy.
 */
@Service
public class PdfBookmarkService {

  private static final int MAX_ENTRIES = 200;
  private static final int MAX_TITLE_LENGTH = 300;

  public BookmarksReadResult readBookmarks(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<BookmarkEntry> entries = new ArrayList<>();
      PDDocumentOutline outline = document.getDocumentCatalog().getDocumentOutline();
      if (outline != null) {
        for (PDOutlineItem item : outline.children()) {
          PDPage page = item.findDestinationPage(document);
          int pageIndex = page == null ? 0 : Math.max(0, document.getPages().indexOf(page));
          String title = item.getTitle();
          entries.add(new BookmarkEntry(pageIndex, title == null ? "" : title));
        }
      }
      return new BookmarksReadResult(document.getNumberOfPages(), entries);
    }
  }

  public byte[] writeBookmarks(MultipartFile file, List<BookmarkEntry> entries) throws IOException {
    PdfFileValidator.requirePdf(file);
    List<BookmarkEntry> safeEntries = entries == null ? List.of() : entries;
    if (safeEntries.size() > MAX_ENTRIES) {
      throw new IllegalArgumentException("A PDF can have at most " + MAX_ENTRIES + " bookmarks.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      int pageCount = document.getNumberOfPages();

      if (safeEntries.isEmpty()) {
        document.getDocumentCatalog().setDocumentOutline(null);
      } else {
        PDDocumentOutline outline = new PDDocumentOutline();
        for (BookmarkEntry entry : safeEntries) {
          if (entry.pageIndex() < 0 || entry.pageIndex() >= pageCount) {
            throw new IllegalArgumentException("Page " + (entry.pageIndex() + 1) + " is out of range.");
          }
          String title = entry.title() == null ? "" : entry.title().trim();
          if (title.isEmpty()) {
            throw new IllegalArgumentException("Every bookmark needs a title.");
          }
          if (title.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("Bookmark titles must be " + MAX_TITLE_LENGTH + " characters or fewer.");
          }

          PDOutlineItem item = new PDOutlineItem();
          item.setTitle(title);
          item.setDestination(document.getPage(entry.pageIndex()));
          outline.addLast(item);
        }
        outline.openNode();
        document.getDocumentCatalog().setDocumentOutline(outline);
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Updating bookmarks produced an empty document.");
      }
      return out;
    }
  }
}
