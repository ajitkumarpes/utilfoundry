package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.utilnexa.pdf.api.dto.OrganizePlan;
import com.utilnexa.pdf.api.dto.PageOp;

import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfOrganizeServiceTest {

  private final PdfOrganizeService service = new PdfOrganizeService();

  @Test
  void reordersAndRotatesSelectedPages() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(3));
    OrganizePlan plan =
        new OrganizePlan(List.of(new PageOp(2, 90), new PageOp(0, 0)));

    byte[] result = service.organize(file, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(2, doc.getNumberOfPages());
      assertEquals(90, doc.getPage(0).getRotation());
      assertEquals(0, doc.getPage(1).getRotation());
    }
  }

  @Test
  void normalizesRotationOver360() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(1));
    OrganizePlan plan = new OrganizePlan(List.of(new PageOp(0, 450)));

    byte[] result = service.organize(file, plan);

    try (PDDocument doc = Loader.loadPDF(result)) {
      assertEquals(90, doc.getPage(0).getRotation());
    }
  }

  @Test
  void emptyPlanRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2));
    OrganizePlan plan = new OrganizePlan(List.of());

    assertThrows(IllegalArgumentException.class, () -> service.organize(file, plan));
  }

  @Test
  void outOfRangeIndexRejected() throws Exception {
    MockMultipartFile file = pdfFile(pdfWithPages(2));
    OrganizePlan plan = new OrganizePlan(List.of(new PageOp(5, 0)));

    assertThrows(IllegalArgumentException.class, () -> service.organize(file, plan));
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
