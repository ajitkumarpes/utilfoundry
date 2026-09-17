package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.OrganizePlan;
import com.utilnexa.pdf.api.dto.PageOp;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfOrganizeService {

  public byte[] organize(MultipartFile file, MultipartFile file2, OrganizePlan plan) throws IOException {
    PdfFileValidator.requirePdf(file);

    if (plan == null || plan.pages() == null || plan.pages().isEmpty()) {
      throw new IllegalArgumentException("The organized PDF must contain at least one page.");
    }
    List<PageOp> ops = plan.pages();
    for (PageOp op : ops) {
      if (op.kind() == null) {
        throw new IllegalArgumentException("Every page entry needs a kind.");
      }
    }

    boolean needsSecondFile = ops.stream().anyMatch(op -> op.kind() == PageOp.Kind.SOURCE2);
    if (needsSecondFile) {
      PdfFileValidator.requirePdf(file2);
    }

    byte[] bytes = file.getBytes();
    byte[] bytes2 = needsSecondFile ? file2.getBytes() : null;

    try (PDDocument source = PdfFileValidator.loadDecrypted(bytes);
        PDDocument source2 = needsSecondFile ? PdfFileValidator.loadDecrypted(bytes2) : null) {
      int pageCount = source.getNumberOfPages();
      int pageCount2 = source2 == null ? 0 : source2.getNumberOfPages();

      try (PDDocument result = new PDDocument()) {
        for (int i = 0; i < ops.size(); i++) {
          PageOp op = ops.get(i);
          switch (op.kind()) {
            case SOURCE -> {
              requireIndex(op.sourceIndex(), pageCount, "Page");
              PDPage page = source.getPage(op.sourceIndex());
              int ownRotation = page.getRotation();
              result.importPage(page);
              applyRotation(result, ownRotation, op.rotation());
            }
            case SOURCE2 -> {
              requireIndex(op.sourceIndex(), pageCount2, "Second file page");
              PDPage page = source2.getPage(op.sourceIndex());
              int ownRotation = page.getRotation();
              result.importPage(page);
              applyRotation(result, ownRotation, op.rotation());
            }
            case BLANK -> {
              PDRectangle size = nearestPageSize(ops, i, source, source2);
              result.addPage(new PDPage(size));
              applyRotation(result, 0, op.rotation());
            }
          }
        }

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        result.save(output);

        byte[] out = output.toByteArray();
        if (out.length == 0) {
          throw new IOException("Organizing the PDF produced an empty document.");
        }
        return out;
      }
    }
  }

  private void requireIndex(Integer index, int pageCount, String label) {
    if (index == null || index < 0 || index >= pageCount) {
      throw new IllegalArgumentException(label + " index " + index + " is out of range.");
    }
  }

  /**
   * The plan's rotation is what the user turned the page by in the organizer, which starts every
   * page at 0 and shows it the way it already displays. It is added to the page's own /Rotate
   * rather than replacing it: replacing it silently straightened every sideways scan the moment
   * someone reordered pages without touching rotation.
   */
  private void applyRotation(PDDocument result, int ownRotation, Integer rotation) {
    PDPage imported = result.getPage(result.getNumberOfPages() - 1);
    int turnedBy = normalizeRotation(rotation == null ? 0 : rotation);
    // Read from the source before import: a /Rotate inherited from the source's page tree
    // is not carried over when the page is re-parented into the new document.
    imported.setRotation(normalizeRotation(ownRotation + turnedBy));
  }

  private int normalizeRotation(int rotation) {
    int normalized = rotation % 360;
    if (normalized < 0) normalized += 360;
    if (normalized % 90 != 0) {
      throw new IllegalArgumentException("Rotation must be a multiple of 90 degrees.");
    }
    return normalized;
  }

  /**
   * A BLANK entry has no page of its own to inherit a size from - PDFBox's no-arg {@code new
   * PDPage()} defaults to US Letter, which would silently mismatch a plan built from A4 source
   * pages. Search outward from the blank entry (previous first, then next) for the nearest entry
   * that resolves to a real page size; fall back to A4 (matching Pages-per-Sheet's existing
   * default) only if the whole plan is blank pages.
   */
  private PDRectangle nearestPageSize(List<PageOp> ops, int blankIndex, PDDocument source, PDDocument source2) {
    for (int i = blankIndex - 1; i >= 0; i--) {
      PDRectangle size = resolveSize(ops.get(i), source, source2);
      if (size != null) return size;
    }
    for (int i = blankIndex + 1; i < ops.size(); i++) {
      PDRectangle size = resolveSize(ops.get(i), source, source2);
      if (size != null) return size;
    }
    return PDRectangle.A4;
  }

  private PDRectangle resolveSize(PageOp op, PDDocument source, PDDocument source2) {
    Integer index = op.sourceIndex();
    if (op.kind() == PageOp.Kind.SOURCE && index != null && index >= 0 && index < source.getNumberOfPages()) {
      return source.getPage(index).getMediaBox();
    }
    if (op.kind() == PageOp.Kind.SOURCE2
        && source2 != null
        && index != null
        && index >= 0
        && index < source2.getNumberOfPages()) {
      return source2.getPage(index).getMediaBox();
    }
    return null;
  }
}
