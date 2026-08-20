package com.utilnexa.pdf.api.dto;

import java.util.List;

public record BookmarksReadResult(int pageCount, List<BookmarkEntry> bookmarks) {}
