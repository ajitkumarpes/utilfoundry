package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.utilnexa.pdf.api.dto.OrganizePlan;
import com.utilnexa.pdf.api.dto.PageOp;
import com.utilnexa.pdf.api.dto.PageOp.Kind;

import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfOrganizeServiceTest {

  private final PdfOrganizeService service = new PdfOrganizeService();

  @Test
  void reordersAndRotatesSelectedPages() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3, PDRectangle.LETTER));
    OrganizePlan plan =
        new OrganizePlan(List.of(new PageOp(Kind.SOURCE, 2, 90), new PageOp(Kind.SOURCE, 0, 0)));

    byte[] result = service.organize(file, null, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
      assertEquals(90, doc.getPage(0).getRotation());
      assertEquals(0, doc.getPage(1).getRotation());
    }
  }

  @Test
  void normalizesRotationOver360() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.LETTER));
    OrganizePlan plan = new OrganizePlan(List.of(new PageOp(Kind.SOURCE, 0, 450)));

    byte[] result = service.organize(file, null, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(90, doc.getPage(0).getRotation());
    }
  }

  @Test
  void emptyPlanRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2, PDRectangle.LETTER));
    OrganizePlan plan = new OrganizePlan(List.of());

    assertThrows(IllegalArgumentException.class, () -> service.organize(file, null, plan));
  }

  @Test
  void outOfRangeIndexRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2, PDRectangle.LETTER));
    OrganizePlan plan = new OrganizePlan(List.of(new PageOp(Kind.SOURCE, 5, 0)));

    assertThrows(IllegalArgumentException.class, () -> service.organize(file, null, plan));
  }

  @Test
  void blankPageInheritsSizeFromPrecedingSourcePage() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.LETTER));
    OrganizePlan plan =
        new OrganizePlan(List.of(new PageOp(Kind.SOURCE, 0, 0), new PageOp(Kind.BLANK, null, 0)));

    byte[] result = service.organize(file, null, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
      assertEquals(PDRectangle.LETTER.getWidth(), doc.getPage(1).getMediaBox().getWidth(), 0.01);
      assertEquals(PDRectangle.LETTER.getHeight(), doc.getPage(1).getMediaBox().getHeight(), 0.01);
    }
  }

  @Test
  void blankPageInheritsSizeFromFollowingSourcePageWhenNoPrecedingOneExists() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.A4));
    OrganizePlan plan =
        new OrganizePlan(List.of(new PageOp(Kind.BLANK, null, 0), new PageOp(Kind.SOURCE, 0, 0)));

    byte[] result = service.organize(file, null, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(PDRectangle.A4.getWidth(), doc.getPage(0).getMediaBox().getWidth(), 0.01);
    }
  }

  @Test
  void allBlankPlanFallsBackToA4() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.LETTER));
    OrganizePlan plan = new OrganizePlan(List.of(new PageOp(Kind.BLANK, null, 0)));

    byte[] result = service.organize(file, null, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(PDRectangle.A4.getWidth(), doc.getPage(0).getMediaBox().getWidth(), 0.01);
      assertEquals(PDRectangle.A4.getHeight(), doc.getPage(0).getMediaBox().getHeight(), 0.01);
    }
  }

  @Test
  void pagesCanBeImportedFromASecondFile() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2, PDRectangle.LETTER));
    MockMultipartFile file2 = new MockMultipartFile(
        "file2", "second.pdf", "application/pdf", pdfWithPages(2, PDRectangle.LETTER));
    OrganizePlan plan = new OrganizePlan(List.of(
        new PageOp(Kind.SOURCE, 0, 0), new PageOp(Kind.SOURCE2, 1, 0), new PageOp(Kind.SOURCE, 1, 0)));

    byte[] result = service.organize(file, file2, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(3, doc.getNumberOfPages());
    }
  }

  @Test
  void source2WithoutASecondFileIsRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.LETTER));
    OrganizePlan plan = new OrganizePlan(List.of(new PageOp(Kind.SOURCE2, 0, 0)));

    assertThrows(IllegalArgumentException.class, () -> service.organize(file, null, plan));
  }

  @Test
  void missingKindRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1, PDRectangle.LETTER));
    OrganizePlan plan = new OrganizePlan(List.of(new PageOp(null, 0, 0)));

    assertThrows(IllegalArgumentException.class, () -> service.organize(file, null, plan));
  }

  private byte[] pdfWithPages(int count, PDRectangle size) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      for (int i = 0; i < count; i++) {
        document.addPage(new PDPage(size));
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private MockMultipartFile pdfFile(byte[] bytes) {
    return new MockMultipartFile("file", "source.pdf", "application/pdf", bytes);
  }

  @Test
  void reorderingKeepsAPageThatWasAlreadySideways() throws Exception {
    byte[] source;
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage sideways = new PDPage(PDRectangle.A4);
      sideways.setRotation(90);
      document.addPage(sideways);
      document.addPage(new PDPage(PDRectangle.A4));
      document.save(output);
      source = output.toByteArray();
    }
    OrganizePlan plan = new OrganizePlan(List.of(
        new PageOp(PageOp.Kind.SOURCE, 1, 0),
        new PageOp(PageOp.Kind.SOURCE, 0, 0),
        new PageOp(PageOp.Kind.SOURCE, 0, 90)));

    byte[] result = service.organize(pdfFile(source), null, plan);

    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(result)) {
      org.junit.jupiter.api.Assertions.assertEquals(0, doc.getPage(0).getRotation());
      org.junit.jupiter.api.Assertions.assertEquals(90, doc.getPage(1).getRotation(), "untouched sideways page stays sideways");
      org.junit.jupiter.api.Assertions.assertEquals(180, doc.getPage(2).getRotation(), "a user turn adds to the page's own rotation");
    }
  }
}
