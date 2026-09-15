package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.SanitizeScanResult;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentCatalog;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary;
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.COSObjectable;
import org.apache.pdfbox.pdmodel.common.PDNameTreeNode;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationFileAttachment;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationMarkup;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Metadata, attachments, comments/markup annotations, clickable links, and embedded
 * scripts/actions - each independently removable. {@code PDAnnotationFileAttachment} (a
 * page-level "pushpin" attachment) is itself a {@code PDAnnotationMarkup} subclass, so it's
 * explicitly excluded from the "annotations" removal/count and only ever touched by
 * "attachments" - otherwise checking "remove annotations/comments" alone would silently delete
 * embedded files too, which a caller who left "remove attachments" unchecked would not expect.
 * {@code PDAnnotationLink} is not a markup subclass at all (no shared type with either bucket),
 * so it needs its own checkbox rather than folding into "annotations".
 */
@Service
public class PdfSanitizeService {

  public SanitizeScanResult scan(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDDocumentCatalog catalog = document.getDocumentCatalog();
      PDDocumentNameDictionary names = catalog.getNames();

      boolean hasMetadata = hasDocumentInformation(document.getDocumentInformation()) || catalog.getMetadata() != null;

      int attachmentCount = names == null ? 0 : countEmbeddedFiles(names.getEmbeddedFiles());
      int annotationCount = 0;
      int linkCount = 0;
      for (PDPage page : document.getPages()) {
        for (PDAnnotation annotation : page.getAnnotations()) {
          if (annotation instanceof PDAnnotationFileAttachment) {
            attachmentCount++;
          } else if (annotation instanceof PDAnnotationLink) {
            linkCount++;
          } else if (annotation instanceof PDAnnotationMarkup) {
            annotationCount++;
          }
        }
      }

      // catalog.getActions() auto-vivifies a non-null wrapper even when no /AA entry exists in the
      // catalog dictionary - check the COS-level key directly instead of the Java wrapper's null-ness.
      boolean hasScripts = catalog.getOpenAction() != null
          || catalog.getCOSObject().containsKey(COSName.AA)
          || (names != null && names.getJavaScript() != null);

      return new SanitizeScanResult(hasMetadata, attachmentCount, annotationCount, hasScripts, linkCount);
    }
  }

  public byte[] sanitize(
      MultipartFile file,
      boolean clearMetadata,
      boolean removeAttachments,
      boolean removeAnnotations,
      boolean removeScripts,
      boolean removeLinks)
      throws IOException {
    PdfFileValidator.requirePdf(file);
    if (!clearMetadata && !removeAttachments && !removeAnnotations && !removeScripts && !removeLinks) {
      throw new IllegalArgumentException("Select at least one thing to remove.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDDocumentCatalog catalog = document.getDocumentCatalog();

      if (clearMetadata) {
        PDDocumentInformation info = document.getDocumentInformation();
        info.setTitle(null);
        info.setAuthor(null);
        info.setSubject(null);
        info.setKeywords(null);
        info.setCreator(null);
        info.setProducer(null);
        catalog.setMetadata(null);
      }

      if (removeAttachments) {
        PDDocumentNameDictionary names = catalog.getNames();
        if (names != null) {
          names.setEmbeddedFiles(null);
        }
      }

      if (removeAnnotations || removeAttachments || removeLinks) {
        for (PDPage page : document.getPages()) {
          List<PDAnnotation> kept = new ArrayList<>();
          for (PDAnnotation annotation : page.getAnnotations()) {
            boolean isAttachment = annotation instanceof PDAnnotationFileAttachment;
            // PDAnnotationFileAttachment is itself a PDAnnotationMarkup subclass, but the two
            // checkboxes must stay independently controllable - an attachment annotation is only
            // ever dropped by removeAttachments, never by removeAnnotations alone.
            boolean dropAsMarkup = removeAnnotations && !isAttachment && annotation instanceof PDAnnotationMarkup;
            boolean dropAsAttachment = removeAttachments && isAttachment;
            boolean dropAsLink = removeLinks && annotation instanceof PDAnnotationLink;
            if (!dropAsMarkup && !dropAsAttachment && !dropAsLink) {
              kept.add(annotation);
            }
          }
          page.setAnnotations(kept);
        }
      }

      if (removeScripts) {
        catalog.setOpenAction(null);
        catalog.setActions(null);
        PDDocumentNameDictionary names = catalog.getNames();
        if (names != null) {
          names.setJavascript(null);
        }
        for (PDPage page : document.getPages()) {
          page.setActions(null);
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Sanitizing the PDF produced an empty document.");
      }
      return out;
    }
  }

  private boolean hasDocumentInformation(PDDocumentInformation info) {
    return isPresent(info.getTitle())
        || isPresent(info.getAuthor())
        || isPresent(info.getSubject())
        || isPresent(info.getKeywords())
        || isPresent(info.getCreator())
        || isPresent(info.getProducer());
  }

  private boolean isPresent(String value) {
    return value != null && !value.isBlank();
  }

  private int countEmbeddedFiles(PDEmbeddedFilesNameTreeNode tree) throws IOException {
    return tree == null ? 0 : countNames(tree);
  }

  private <T extends COSObjectable> int countNames(PDNameTreeNode<T> node) throws IOException {
    int count = 0;
    Map<String, T> direct = node.getNames();
    if (direct != null) {
      count += direct.size();
    }
    List<PDNameTreeNode<T>> kids = node.getKids();
    if (kids != null) {
      for (PDNameTreeNode<T> kid : kids) {
        count += countNames(kid);
      }
    }
    return count;
  }
}
