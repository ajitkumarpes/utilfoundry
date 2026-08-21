package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentCatalog;
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary;
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDNameTreeNode;
import org.apache.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification;
import org.apache.pdfbox.pdmodel.common.filespecification.PDEmbeddedFile;
import org.apache.pdfbox.pdmodel.common.filespecification.PDFileSpecification;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationFileAttachment;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Reads embedded files back out, from both storage locations a PDF can use - the document-level
 * {@code /EmbeddedFiles} name tree and per-page {@code PDAnnotationFileAttachment} ("pushpin")
 * annotations - mirroring {@link PdfSanitizeService}'s dual-location coverage of the same two
 * places. Only reads the document's own embedded files, not third-party assets like fonts (which
 * carry their own licensing and aren't this document's content to hand back out).
 */
@Service
public class PdfExtractAttachmentsService {

  public List<NamedFile> extract(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<NamedFile> results = new ArrayList<>();
      Set<String> usedNames = new HashSet<>();

      PDDocumentCatalog catalog = document.getDocumentCatalog();
      PDDocumentNameDictionary names = catalog.getNames();
      if (names != null && names.getEmbeddedFiles() != null) {
        collectFromNameTree(names.getEmbeddedFiles(), results, usedNames);
      }

      for (PDPage page : document.getPages()) {
        for (PDAnnotation annotation : page.getAnnotations()) {
          if (annotation instanceof PDAnnotationFileAttachment attachmentAnnotation) {
            PDFileSpecification spec = attachmentAnnotation.getFile();
            if (spec instanceof PDComplexFileSpecification complexSpec) {
              addFile(complexSpec, results, usedNames);
            }
          }
        }
      }

      if (results.isEmpty()) {
        throw new IllegalArgumentException("No embedded attachments were found in this PDF.");
      }
      return results;
    }
  }

  private void collectFromNameTree(
      PDNameTreeNode<PDComplexFileSpecification> node, List<NamedFile> results, Set<String> usedNames)
      throws IOException {
    Map<String, PDComplexFileSpecification> direct = node.getNames();
    if (direct != null) {
      for (PDComplexFileSpecification spec : direct.values()) {
        addFile(spec, results, usedNames);
      }
    }
    List<PDNameTreeNode<PDComplexFileSpecification>> kids = node.getKids();
    if (kids != null) {
      for (PDNameTreeNode<PDComplexFileSpecification> kid : kids) {
        collectFromNameTree(kid, results, usedNames);
      }
    }
  }

  private void addFile(PDComplexFileSpecification spec, List<NamedFile> results, Set<String> usedNames)
      throws IOException {
    PDEmbeddedFile embedded = spec.getEmbeddedFile();
    if (embedded == null) return;

    String filename = spec.getFilename();
    if (filename == null || filename.isBlank()) {
      filename = "attachment-" + (results.size() + 1);
    }
    filename = uniqueName(filename, usedNames);

    String contentType = embedded.getSubtype();
    if (contentType == null || contentType.isBlank()) {
      contentType = "application/octet-stream";
    }

    results.add(new NamedFile(filename, embedded.toByteArray(), contentType));
  }

  private String uniqueName(String filename, Set<String> usedNames) {
    if (usedNames.add(filename)) {
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
    } while (!usedNames.add(candidate));
    return candidate;
  }
}
