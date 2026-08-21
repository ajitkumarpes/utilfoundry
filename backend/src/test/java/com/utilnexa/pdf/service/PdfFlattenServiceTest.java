package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.FlattenScanResult;

import java.awt.geom.AffineTransform;
import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationText;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAppearanceDictionary;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAppearanceStream;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDTextField;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfFlattenServiceTest {

  private final PdfFlattenService service = new PdfFlattenService();

  @Test
  void cleanPdfScansAsNothingToFlatten() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    FlattenScanResult scan = service.scan(file);

    assertFalse(scan.hasFormFields());
    assertEquals(0, scan.annotationCount());
  }

  @Test
  void scanFindsFormFieldsAndAnnotations() throws Exception {
    byte[] loaded = buildDocumentWithFormAndAnnotation();

    FlattenScanResult scan = service.scan(pdfFile(loaded));

    assertTrue(scan.hasFormFields());
    assertEquals(1, scan.annotationCount());
  }

  @Test
  void flattenFormsRemovesAllAcroFormFields() throws Exception {
    byte[] loaded = buildDocumentWithFormAndAnnotation();

    byte[] result = service.flatten(pdfFile(loaded), true, false);

    try (PDDocument doc = Loader.loadPDF(result)) {
      PDAcroForm acroForm = doc.getDocumentCatalog().getAcroForm();
      assertTrue(acroForm == null || acroForm.getFields().isEmpty());
    }
    // the annotation must survive - only forms were asked for
    FlattenScanResult after = service.scan(pdfFile(result));
    assertEquals(1, after.annotationCount());
  }

  @Test
  void flattenAnnotationsWithIdentityMatrixBakesInAndRemovesTheAnnotation() throws Exception {
    byte[] loaded = buildDocumentWithFormAndAnnotation();

    byte[] result = service.flatten(pdfFile(loaded), false, true);

    FlattenScanResult after = service.scan(pdfFile(result));
    assertEquals(0, after.annotationCount());
    // forms untouched - only annotations were asked for
    assertTrue(after.hasFormFields());

    try (PDDocument doc = Loader.loadPDF(result)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Baked"), "the appearance stream's content should now be real page content");
    }
  }

  @Test
  void annotationWithNonIdentityAppearanceMatrixIsLeftAsIs() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);
      PDAnnotation rotatedMarkup = markupAnnotationWithAppearance(
          document, new PDRectangle(100, 600, 40, 20), AffineTransform.getRotateInstance(Math.PI / 4));
      page.setAnnotations(List.of(rotatedMarkup));
      document.save(output);

      byte[] result = service.flatten(pdfFile(output.toByteArray()), false, true);

      // left exactly as-is: still a real, present annotation, not baked into content
      FlattenScanResult after = service.scan(pdfFile(result));
      assertEquals(1, after.annotationCount());
    }
  }

  @Test
  void nothingSelectedIsRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.flatten(file, false, false));
  }

  private byte[] buildDocumentWithFormAndAnnotation() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      PDAcroForm acroForm = new PDAcroForm(document);
      PDResources acroFormResources = new PDResources();
      acroFormResources.put(COSName.getPDFName("Helv"), new PDType1Font(Standard14Fonts.FontName.HELVETICA));
      acroForm.setDefaultResources(acroFormResources);
      acroForm.setDefaultAppearance("/Helv 10 Tf 0 g");
      document.getDocumentCatalog().setAcroForm(acroForm);

      PDTextField field = new PDTextField(acroForm);
      field.setPartialName("guestName");
      acroForm.getFields().add(field);
      var widget = field.getWidgets().get(0);
      widget.setRectangle(new PDRectangle(50, 700, 150, 20));
      widget.setPage(page);
      field.setValue("Test Guest");

      PDAnnotation markup =
          markupAnnotationWithAppearance(document, new PDRectangle(100, 600, 40, 20), null);

      page.setAnnotations(List.of(widget, markup));

      document.save(output);
      return output.toByteArray();
    }
  }

  private PDAnnotation markupAnnotationWithAppearance(
      PDDocument document, PDRectangle rect, AffineTransform matrix) throws Exception {
    PDRectangle bbox = new PDRectangle(0, 0, rect.getWidth(), rect.getHeight());
    PDAppearanceStream appearanceStream = new PDAppearanceStream(document);
    appearanceStream.setBBox(bbox);
    appearanceStream.setResources(new PDResources());
    if (matrix != null) {
      appearanceStream.setMatrix(matrix);
    }
    try (PDPageContentStream cs = new PDPageContentStream(document, appearanceStream)) {
      cs.beginText();
      cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
      cs.newLineAtOffset(1, 5);
      cs.showText("Baked");
      cs.endText();
    }

    PDAppearanceDictionary appearanceDict = new PDAppearanceDictionary();
    appearanceDict.setNormalAppearance(appearanceStream);

    PDAnnotationText markup = new PDAnnotationText();
    markup.setRectangle(rect);
    markup.setAppearance(appearanceDict);
    markup.setContents("A note");
    return markup;
  }

  private byte[] pdfWithPages(int count) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      for (int i = 0; i < count; i++) {
        document.addPage(new PDPage());
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
