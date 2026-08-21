package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.service.support.FilenameDeduplicator;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
 * places. Covers files the document's own author chose to attach (invoices, source spreadsheets,
 * supporting docs) - see {@link PdfExtractFontsService} for the separate, licensing-sensitive
 * case of extracting embedded font programs.
 */
@Service
public class PdfExtractAttachmentsService {

  public List<NamedFile> extract(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<NamedFile> results = new ArrayList<>();
      FilenameDeduplicator names = new FilenameDeduplicator();

      PDDocumentCatalog catalog = document.getDocumentCatalog();
      PDDocumentNameDictionary nameDictionary = catalog.getNames();
      if (nameDictionary != null && nameDictionary.getEmbeddedFiles() != null) {
        collectFromNameTree(nameDictionary.getEmbeddedFiles(), results, names);
      }

      for (PDPage page : document.getPages()) {
        for (PDAnnotation annotation : page.getAnnotations()) {
          if (annotation instanceof PDAnnotationFileAttachment attachmentAnnotation) {
            PDFileSpecification spec = attachmentAnnotation.getFile();
            if (spec instanceof PDComplexFileSpecification complexSpec) {
              addFile(complexSpec, results, names);
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
      PDNameTreeNode<PDComplexFileSpecification> node, List<NamedFile> results, FilenameDeduplicator names)
      throws IOException {
    Map<String, PDComplexFileSpecification> direct = node.getNames();
    if (direct != null) {
      for (PDComplexFileSpecification spec : direct.values()) {
        addFile(spec, results, names);
      }
    }
    List<PDNameTreeNode<PDComplexFileSpecification>> kids = node.getKids();
    if (kids != null) {
      for (PDNameTreeNode<PDComplexFileSpecification> kid : kids) {
        collectFromNameTree(kid, results, names);
      }
    }
  }

  private void addFile(PDComplexFileSpecification spec, List<NamedFile> results, FilenameDeduplicator names)
      throws IOException {
    PDEmbeddedFile embedded = spec.getEmbeddedFile();
    if (embedded == null) return;

    String filename = spec.getFilename();
    if (filename == null || filename.isBlank()) {
      filename = "attachment-" + (results.size() + 1);
    }
    filename = names.uniqueName(filename);

    String contentType = embedded.getSubtype();
    if (contentType == null || contentType.isBlank()) {
      contentType = "application/octet-stream";
    }

    results.add(new NamedFile(filename, embedded.toByteArray(), contentType));
  }
}
