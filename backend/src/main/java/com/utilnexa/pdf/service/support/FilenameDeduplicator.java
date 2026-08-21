package com.utilnexa.pdf.service.support;

import java.util.HashSet;
import java.util.Set;

/** Makes a stream of proposed filenames collision-free by suffixing {@code " (2)"}, {@code " (3)"}, etc. */
public final class FilenameDeduplicator {

  private final Set<String> used = new HashSet<>();

  public String uniqueName(String filename) {
    if (used.add(filename)) {
      return filename;
    }
    String base = filename;
    String extension = "";
    int dot = filename.lastIndexOf('.');
    if (dot > 0) {
      base = filename.substring(0, dot);
      extension = filename.substring(dot);
    }
    int suffix = 2;
    String candidate;
    do {
      candidate = base + " (" + suffix + ")" + extension;
      suffix++;
    } while (!used.add(candidate));
    return candidate;
  }
}
