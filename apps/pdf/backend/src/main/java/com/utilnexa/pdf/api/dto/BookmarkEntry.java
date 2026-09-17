package com.utilnexa.pdf.api.dto;

/**
 * One outline entry. {@code level} is its nesting depth: 0 for a top-level bookmark, 1 for a
 * sub-section under the nearest preceding level-0 entry, and so on. Boxed so a client that sends
 * only a page and a title still gets a flat, top-level list.
 */
public record BookmarkEntry(int pageIndex, String title, Integer level) {

  public BookmarkEntry(int pageIndex, String title) {
    this(pageIndex, title, 0);
  }

  public int depth() {
    return level == null ? 0 : Math.max(0, level);
  }
}
