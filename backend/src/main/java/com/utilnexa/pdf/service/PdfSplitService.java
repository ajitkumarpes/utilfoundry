package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.multipdf.Splitter;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfSplitService {

  public List<NamedFile> split(MultipartFile file, String mode, String ranges) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {

      int pageCount = document.getNumberOfPages();
      List<NamedFile> results = new ArrayList<>();

      if ("ALL".equalsIgnoreCase(mode)) {
        Splitter splitter = new Splitter();
        splitter.setSplitAtPage(1);
        List<PDDocument> split = splitter.split(document);
        for (int i = 0; i < split.size(); i++) {
          try (PDDocument page = split.get(i)) {
            results.add(new NamedFile("page-" + (i + 1) + ".pdf", toBytes(page), "application/pdf"));
          }
        }
      } else if ("RANGES".equalsIgnoreCase(mode)) {
        List<int[]> parsedRanges = parseRanges(ranges, pageCount);
        int index = 1;
        for (int[] range : parsedRanges) {
          try (PDDocument extracted = new PDDocument()) {
            for (int p = range[0]; p <= range[1]; p++) {
              extracted.importPage(document.getPage(p - 1));
            }
            results.add(
                new NamedFile(
                    "range-" + index + "-p" + range[0] + "-" + range[1] + ".pdf",
                    toBytes(extracted),
                    "application/pdf"));
            index++;
          }
        }
      } else if ("EVEN".equalsIgnoreCase(mode) || "ODD".equalsIgnoreCase(mode)) {
        boolean even = "EVEN".equalsIgnoreCase(mode);
        try (PDDocument extracted = new PDDocument()) {
          for (int p = 1; p <= pageCount; p++) {
            if ((p % 2 == 0) == even) {
              extracted.importPage(document.getPage(p - 1));
            }
          }
          if (extracted.getNumberOfPages() == 0) {
            throw new IllegalArgumentException(
                "This PDF has no " + (even ? "even" : "odd") + "-numbered pages.");
          }
          results.add(
              new NamedFile((even ? "even" : "odd") + "-pages.pdf", toBytes(extracted), "application/pdf"));
        }
      } else {
        throw new IllegalArgumentException("mode must be ALL, RANGES, EVEN, or ODD.");
      }

      return results;
    }
  }

  private List<int[]> parseRanges(String ranges, int pageCount) {
    if (ranges == null || ranges.isBlank()) {
      throw new IllegalArgumentException("Provide at least one page range, e.g. 1-3,5,8-10.");
    }

    List<int[]> parsed = new ArrayList<>();
    for (String part : ranges.split(",")) {
      String token = part.trim();
      if (token.isEmpty()) continue;

      int start;
      int end;
      if (token.contains("-")) {
        String[] bounds = token.split("-", 2);
        start = parsePage(bounds[0], pageCount);
        end = parsePage(bounds[1], pageCount);
      } else {
        start = parsePage(token, pageCount);
        end = start;
      }

      if (start > end) {
        throw new IllegalArgumentException(
            "Invalid range \"" + token + "\": start page must not be after end page.");
      }
      parsed.add(new int[] {start, end});
    }

    if (parsed.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one page range, e.g. 1-3,5,8-10.");
    }
    return parsed;
  }

  private int parsePage(String raw, int pageCount) {
    int page;
    try {
      page = Integer.parseInt(raw.trim());
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException("\"" + raw.trim() + "\" is not a valid page number.");
    }
    if (page < 1 || page > pageCount) {
      throw new IllegalArgumentException(
          "Page " + page + " is out of range (this PDF has " + pageCount + " pages).");
    }
    return page;
  }

  private byte[] toBytes(PDDocument document) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    document.save(output);
    return output.toByteArray();
  }

}
