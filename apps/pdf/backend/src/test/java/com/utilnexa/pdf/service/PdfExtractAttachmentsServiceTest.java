package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.utilnexa.pdf.api.dto.NamedFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentCatalog;
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary;
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification;
import org.apache.pdfbox.pdmodel.common.filespecification.PDEmbeddedFile;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationFileAttachment;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfExtractAttachmentsServiceTest {

  private final PdfExtractAttachmentsService service = new PdfExtractAttachmentsService();

  @Test
  void extractsFromBothTheNameTreeAndThePageAnnotation() throws Exception {
    byte[] pdf = buildDocumentWithBothAttachmentLocations();

    List<NamedFile> results = service.extract(pdfFile(pdf));

    assertEquals(2, results.size());
    NamedFile docLevel = findByFilename(results, "report.txt");
    assertEquals("hello from the name tree", new String(docLevel.content(), StandardCharsets.UTF_8));

    NamedFile pageLevel = findByFilename(results, "invoice.txt");
    assertEquals("hello from the page annotation", new String(pageLevel.content(), StandardCharsets.UTF_8));
  }

  @Test
  void duplicateFilenamesAreDisambiguated() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      PDComplexFileSpecification docLevelSpec = embeddedFileSpec(document, "data.txt", "first copy");
      PDDocumentCatalog catalog = document.getDocumentCatalog();
      PDDocumentNameDictionary names = new PDDocumentNameDictionary(catalog);
      PDEmbeddedFilesNameTreeNode tree = new PDEmbeddedFilesNameTreeNode();
      tree.setNames(Map.of("data.txt", docLevelSpec));
      names.setEmbeddedFiles(tree);
      catalog.setNames(names);

      PDComplexFileSpecification pageLevelSpec = embeddedFileSpec(document, "data.txt", "second copy");
      PDAnnotationFileAttachment attachment = new PDAnnotationFileAttachment();
      attachment.setRectangle(new PDRectangle(10, 10, 20, 20));
      attachment.setFile(pageLevelSpec);
      page.setAnnotations(List.of(attachment));

      document.save(output);
      List<NamedFile> results = service.extract(pdfFile(output.toByteArray()));

      assertEquals(2, results.size());
      assertTrue(results.stream().anyMatch(f -> f.filename().equals("data.txt")));
      assertTrue(results.stream().anyMatch(f -> f.filename().equals("data (2).txt")));
    }
  }

  @Test
  void pdfWithNoAttachmentsIsRejected() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      document.addPage(new PDPage());
      document.save(output);
      MockMultipartFile file = pdfFile(output.toByteArray());

      assertThrows(IllegalArgumentException.class, () -> service.extract(file));
    }
  }

  private byte[] buildDocumentWithBothAttachmentLocations() throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);

      PDComplexFileSpecification docLevelSpec = embeddedFileSpec(document, "report.txt", "hello from the name tree");
      PDDocumentCatalog catalog = document.getDocumentCatalog();
      PDDocumentNameDictionary names = new PDDocumentNameDictionary(catalog);
      PDEmbeddedFilesNameTreeNode tree = new PDEmbeddedFilesNameTreeNode();
      tree.setNames(Map.of("report.txt", docLevelSpec));
      names.setEmbeddedFiles(tree);
      catalog.setNames(names);

      PDComplexFileSpecification pageLevelSpec =
          embeddedFileSpec(document, "invoice.txt", "hello from the page annotation");
      PDAnnotationFileAttachment attachment = new PDAnnotationFileAttachment();
      attachment.setRectangle(new PDRectangle(10, 10, 20, 20));
      attachment.setFile(pageLevelSpec);
      page.setAnnotations(List.of(attachment));

      document.save(output);
      return output.toByteArray();
    }
  }

  private PDComplexFileSpecification embeddedFileSpec(PDDocument document, String filename, String content)
      throws Exception {
    PDComplexFileSpecification spec = new PDComplexFileSpecification();
    spec.setFile(filename);
    PDEmbeddedFile embeddedFile =
        new PDEmbeddedFile(document, new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)));
    embeddedFile.setSubtype("text/plain");
    spec.setEmbeddedFile(embeddedFile);
    return spec;
  }

  private NamedFile findByFilename(List<NamedFile> results, String filename) {
    return results.stream()
        .filter(f -> f.filename().equals(filename))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No result named " + filename));
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }
}
