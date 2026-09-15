package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.FlattenScanResult;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationFileAttachment;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationMarkup;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAppearanceStream;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bakes interactive content permanently into the page - filled form field values (via PDFBox's
 * own {@code PDAcroForm.flatten()}) and comment/markup annotations (highlights, stamps, sticky
 * notes) alike, matching {@link PdfSanitizeService}'s exact definition of "annotations"
 * ({@code PDAnnotationMarkup}, explicitly excluding the {@code PDAnnotationFileAttachment}
 * subclass - a pushpin attachment isn't something "flatten" has a meaning for).
 *
 * <p>Annotation flattening is deliberately conservative: it only bakes in an annotation whose
 * appearance stream has an identity {@code Matrix} (no rotation/shear/scale baked into the
 * appearance itself - the common case for annotations from mainstream tools). An annotation with
 * a non-identity appearance matrix, or no appearance stream at all, is left exactly as-is rather
 * than risk drawing it in the wrong place or the wrong size - correctly flattening a
 * rotated/skewed appearance needs composing that matrix into the draw transform, which is real,
 * separate work that hasn't been verified against a rotated fixture.
 */
@Service
public class PdfFlattenService {

  public FlattenScanResult scan(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDAcroForm acroForm = document.getDocumentCatalog().getAcroForm();
      boolean hasFormFields = acroForm != null && !acroForm.getFields().isEmpty();

      int annotationCount = 0;
      for (PDPage page : document.getPages()) {
        for (PDAnnotation annotation : page.getAnnotations()) {
          if (isFlattenableMarkupType(annotation)) {
            annotationCount++;
          }
        }
      }

      return new FlattenScanResult(hasFormFields, annotationCount);
    }
  }

  public byte[] flatten(MultipartFile file, boolean flattenForms, boolean flattenAnnotations) throws IOException {
    PdfFileValidator.requirePdf(file);
    if (!flattenForms && !flattenAnnotations) {
      throw new IllegalArgumentException("Select at least one thing to flatten.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      if (flattenForms) {
        PDAcroForm acroForm = document.getDocumentCatalog().getAcroForm();
        if (acroForm != null && !acroForm.getFields().isEmpty()) {
          acroForm.flatten();
        }
      }

      if (flattenAnnotations) {
        for (PDPage page : document.getPages()) {
          flattenMarkupAnnotationsOnPage(document, page);
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Flattening the PDF produced an empty document.");
      }
      return out;
    }
  }

  private boolean isFlattenableMarkupType(PDAnnotation annotation) {
    return !(annotation instanceof PDAnnotationFileAttachment) && annotation instanceof PDAnnotationMarkup;
  }

  private void flattenMarkupAnnotationsOnPage(PDDocument document, PDPage page) throws IOException {
    List<PDAnnotation> toBake = new ArrayList<>();
    List<PDAnnotation> kept = new ArrayList<>();
    for (PDAnnotation annotation : page.getAnnotations()) {
      if (isFlattenableMarkupType(annotation) && canFlatten(annotation)) {
        toBake.add(annotation);
      } else {
        kept.add(annotation);
      }
    }
    if (toBake.isEmpty()) return;

    try (PDPageContentStream stream = new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
      for (PDAnnotation annotation : toBake) {
        drawAppearanceIntoRect(stream, annotation.getNormalAppearanceStream(), annotation.getRectangle());
      }
    }
    page.setAnnotations(kept);
  }

  private boolean canFlatten(PDAnnotation annotation) {
    PDAppearanceStream appearance = annotation.getNormalAppearanceStream();
    if (appearance == null) return false;
    PDRectangle bbox = appearance.getBBox();
    if (bbox == null || bbox.getWidth() <= 0 || bbox.getHeight() <= 0) return false;
    if (annotation.getRectangle() == null) return false;
    return isIdentity(appearance.getMatrix());
  }

  private boolean isIdentity(Matrix matrix) {
    return matrix.getScaleX() == 1f
        && matrix.getScaleY() == 1f
        && matrix.getShearX() == 0f
        && matrix.getShearY() == 0f
        && matrix.getTranslateX() == 0f
        && matrix.getTranslateY() == 0f;
  }

  private void drawAppearanceIntoRect(PDPageContentStream stream, PDAppearanceStream appearance, PDRectangle rect)
      throws IOException {
    PDRectangle bbox = appearance.getBBox();
    float scaleX = rect.getWidth() / bbox.getWidth();
    float scaleY = rect.getHeight() / bbox.getHeight();

    stream.saveGraphicsState();
    stream.transform(Matrix.getTranslateInstance(rect.getLowerLeftX(), rect.getLowerLeftY()));
    stream.transform(Matrix.getScaleInstance(scaleX, scaleY));
    stream.transform(Matrix.getTranslateInstance(-bbox.getLowerLeftX(), -bbox.getLowerLeftY()));
    stream.drawForm(appearance);
    stream.restoreGraphicsState();
  }
}
