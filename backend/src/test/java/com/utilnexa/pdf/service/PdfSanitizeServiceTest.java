package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.SanitizeScanResult;

import java.io.ByteArrayOutputStream;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentCatalog;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary;
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification;
import org.apache.pdfbox.pdmodel.common.filespecification.PDEmbeddedFile;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionJavaScript;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationFileAttachment;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationText;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfSanitizeServiceTest {

  private final PdfSanitizeService service = new PdfSanitizeService();

  @Test
  void cleanPdfScansAsEmpty() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    SanitizeScanResult scan = service.scan(file);

    assertFalse(scan.hasMetadata());
    assertEquals(0, scan.attachmentCount());
    assertEquals(0, scan.annotationCount());
    assertFalse(scan.hasScripts());
    assertEquals(0, scan.linkCount());
  }

  @Test
  void scanFindsMetadataAttachmentsAnnotationsScriptsAndLinks() throws Exception {
    byte[] loaded = buildDocumentWithEverything();

    SanitizeScanResult scan = service.scan(pdfFile(loaded));

    assertTrue(scan.hasMetadata());
    // one page-level file-attachment annotation + one document-level embedded file
    assertEquals(2, scan.attachmentCount());
    assertEquals(1, scan.annotationCount());
    assertTrue(scan.hasScripts());
    assertEquals(1, scan.linkCount());
  }

  @Test
  void clearMetadataRemovesAllInformationFields() throws Exception {
    byte[] loaded = buildDocumentWithEverything();

    byte[] result = service.sanitize(pdfFile(loaded), true, false, false, false, false);

    try (PDDocument doc = Loader.loadPDF(result)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      assertNull(info.getTitle());
      assertNull(info.getAuthor());
      assertNull(info.getCreator());
      assertNull(info.getProducer());
      assertNull(doc.getDocumentCatalog().getMetadata());
    }
  }

  @Test
  void removeAttachmentsClearsBothTheNameTreeAndThePageAnnotation() throws Exception {
    byte[] loaded = buildDocumentWithEverything();

    byte[] result = service.sanitize(pdfFile(loaded), false, true, false, false, false);

    SanitizeScanResult after = service.scan(pdfFile(result));
    assertEquals(0, after.attachmentCount());
    // the markup annotation (not a file attachment) must survive - only attachments were asked for
    assertEquals(1, after.annotationCount());
    assertEquals(1, after.linkCount());
  }

  @Test
  void removeAnnotationsLeavesAttachmentsAndLinksAlone() throws Exception {
    byte[] loaded = buildDocumentWithEverything();

    byte[] result = service.sanitize(pdfFile(loaded), false, false, true, false, false);

    SanitizeScanResult after = service.scan(pdfFile(result));
    assertEquals(0, after.annotationCount());
    assertEquals(2, after.attachmentCount());
    assertEquals(1, after.linkCount());
  }

  @Test
  void removeScriptsClearsOpenAction() throws Exception {
    byte[] loaded = buildDocumentWithEverything();

    byte[] result = service.sanitize(pdfFile(loaded), false, false, false, true, false);

    assertFalse(service.scan(pdfFile(result)).hasScripts());
  }

  @Test
  void removeLinksClearsOnlyLinksNotOtherAnnotationsOrAttachments() throws Exception {
    byte[] loaded = buildDocumentWithEverything();

    byte[] result = service.sanitize(pdfFile(loaded), false, false, false, false, true);

    SanitizeScanResult after = service.scan(pdfFile(result));
    assertEquals(0, after.linkCount());
    assertEquals(1, after.annotationCount());
    assertEquals(2, after.attachmentCount());
  }

  @Test
  void nothingSelectedIsRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));

    assertThrows(IllegalArgumentException.class, () -> service.sanitize(file, false, false, false, false, false));
  }

  private byte[] buildDocumentWithEverything() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      PDDocumentInformation info = document.getDocumentInformation();
      info.setTitle("Secret Report");
      info.setAuthor("QA Bot");

      PDDocumentCatalog catalog = document.getDocumentCatalog();
      PDDocumentNameDictionary names = new PDDocumentNameDictionary(catalog);
      PDEmbeddedFilesNameTreeNode embeddedFiles = new PDEmbeddedFilesNameTreeNode();
      PDComplexFileSpecification fileSpec = new PDComplexFileSpecification();
      fileSpec.setFile("data.txt");
      PDEmbeddedFile embeddedFile = new PDEmbeddedFile(document, new java.io.ByteArrayInputStream("hello".getBytes()));
      fileSpec.setEmbeddedFile(embeddedFile);
      embeddedFiles.setNames(Map.of("data.txt", fileSpec));
      names.setEmbeddedFiles(embeddedFiles);
      catalog.setNames(names);

      catalog.setOpenAction(new PDActionJavaScript("app.alert('hi');"));

      PDAnnotationFileAttachment attachmentAnnotation = new PDAnnotationFileAttachment();
      attachmentAnnotation.setRectangle(new PDRectangle(10, 10, 20, 20));
      attachmentAnnotation.setFile(fileSpec);

      PDAnnotationText comment = new PDAnnotationText();
      comment.setRectangle(new PDRectangle(50, 50, 20, 20));
      comment.setContents("A comment");

      PDAnnotationLink link = new PDAnnotationLink();
      link.setRectangle(new PDRectangle(80, 80, 30, 10));
      PDActionURI uriAction = new PDActionURI();
      uriAction.setURI("https://example.com");
      link.setAction(uriAction);

      page.setAnnotations(java.util.List.of(attachmentAnnotation, comment, link));

      document.save(output);
      return output.toByteArray();
    }
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
