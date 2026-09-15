package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.interactive.action.PDAction;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Only {@code PDAnnotationLink} annotations whose action is a {@code PDActionURI} are reported -
 * a link that navigates to another page/destination inside the same document ({@code
 * PDActionGoTo}) has no URL and isn't what "extract the links" means here.
 */
@Service
public class PdfExtractLinksService {

  public byte[] extractLinks(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<String> rows = new ArrayList<>();
      rows.add("Page,URL");

      int pageNumber = 1;
      for (PDPage page : document.getPages()) {
        for (PDAnnotation annotation : page.getAnnotations()) {
          if (annotation instanceof PDAnnotationLink link) {
            PDAction action = link.getAction();
            if (action instanceof PDActionURI uriAction) {
              String uri = uriAction.getURI();
              if (uri != null && !uri.isBlank()) {
                rows.add(pageNumber + "," + csvField(uri));
              }
            }
          }
        }
        pageNumber++;
      }

      if (rows.size() == 1) {
        throw new IllegalArgumentException("No clickable links were found in this PDF.");
      }

      ByteArrayOutputStream out = new ByteArrayOutputStream();
      for (String row : rows) {
        out.write(row.getBytes(StandardCharsets.UTF_8));
        out.write('\n');
      }
      return out.toByteArray();
    }
  }

  private String csvField(String value) {
    if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
      return "\"" + value.replace("\"", "\"\"") + "\"";
    }
    return value;
  }
}
