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
 * Reads/writes the PDF outline as a depth-first list, each entry carrying its nesting level, so
 * chapters keep their sub-sections through a read-edit-save round trip. (Reading only the top
 * level and rewriting the outline used to delete every sub-section on save.) Entries that point
 * at a URL or named destination rather than a page resolve to no page and are reported at page 0.
 */
@Service
public class PdfBookmarkService {

  private static final int MAX_ENTRIES = 200;
  private static final int MAX_TITLE_LENGTH = 300;
  private static final int MAX_DEPTH = 8;

  public BookmarksReadResult readBookmarks(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<BookmarkEntry> entries = new ArrayList<>();
      PDDocumentOutline outline = document.getDocumentCatalog().getDocumentOutline();
      if (outline != null) {
        collect(document, outline.children(), 0, entries);
      }
      return new BookmarksReadResult(document.getNumberOfPages(), entries);
    }
  }

  private void collect(PDDocument document, Iterable<PDOutlineItem> items, int level, List<BookmarkEntry> entries)
      throws IOException {
    for (PDOutlineItem item : items) {
      if (entries.size() >= MAX_ENTRIES) return;
      PDPage page = item.findDestinationPage(document);
      int pageIndex = page == null ? 0 : Math.max(0, document.getPages().indexOf(page));
      String title = item.getTitle();
      entries.add(new BookmarkEntry(pageIndex, title == null ? "" : title, Math.min(level, MAX_DEPTH)));
      if (level < MAX_DEPTH) {
        collect(document, item.children(), level + 1, entries);
      }
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
        // parents[d] is the most recent item at depth d; an entry at depth d attaches under
        // parents[d - 1]. A depth that jumps more than one level deeper is clamped, so a list
        // edited into an odd shape still saves as a valid tree.
        List<PDOutlineItem> parents = new ArrayList<>();
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

          int depth = Math.min(Math.min(entry.depth(), MAX_DEPTH), parents.size());
          if (depth == 0) {
            outline.addLast(item);
          } else {
            parents.get(depth - 1).addLast(item);
          }
          while (parents.size() > depth) parents.remove(parents.size() - 1);
          parents.add(item);
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
