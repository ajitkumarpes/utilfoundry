package com.utilnexa.pdf.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfMergeServiceTest {

  @Test
  void mergesTwoPdfsAndProducesValidPdf() throws Exception {
    byte[] first = pdfWithPages(1);
    byte[] second = pdfWithPages(2);

    MockMultipartFile f1 = new MockMultipartFile("files", "first.pdf", "application/pdf", first);
    MockMultipartFile f2 = new MockMultipartFile("files", "second.pdf", "application/pdf", second);

    byte[] result = new PdfMergeService().merge(List.of(f1, f2));

    assertTrue(result.length > 0);
    assertEquals('%', result[0]);
    assertEquals('P', result[1]);
    assertEquals('D', result[2]);
    assertEquals('F', result[3]);

    try (PDDocument merged = Loader.loadPDF(result)) {
      assertEquals(3, merged.getNumberOfPages());
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

  @org.junit.jupiter.api.Test
  void anEncryptedMemberIsABadRequestThatNamesTheFile() throws Exception {
    byte[] locked = new PdfProtectService().protect(
        new org.springframework.mock.web.MockMultipartFile("file", "a.pdf", "application/pdf", pdfWithPages(1)),
        "secret123", true, false, false, false);
    var files = java.util.List.<org.springframework.web.multipart.MultipartFile>of(
        new org.springframework.mock.web.MockMultipartFile("files", "open.pdf", "application/pdf", pdfWithPages(1)),
        new org.springframework.mock.web.MockMultipartFile("files", "locked.pdf", "application/pdf", locked));

    IllegalArgumentException thrown = org.junit.jupiter.api.Assertions.assertThrows(
        IllegalArgumentException.class, () -> new PdfMergeService().merge(files));

    org.junit.jupiter.api.Assertions.assertTrue(thrown.getMessage().startsWith("“locked.pdf”: Password-protected"));
  }

  @org.junit.jupiter.api.Test
  void aCorruptMemberIsABadRequestNotAServerError() throws Exception {
    var files = java.util.List.<org.springframework.web.multipart.MultipartFile>of(
        new org.springframework.mock.web.MockMultipartFile("files", "open.pdf", "application/pdf", pdfWithPages(1)),
        new org.springframework.mock.web.MockMultipartFile("files", "broken.pdf", "application/pdf", "garbage".getBytes()));

    IllegalArgumentException thrown = org.junit.jupiter.api.Assertions.assertThrows(
        IllegalArgumentException.class, () -> new PdfMergeService().merge(files));

    org.junit.jupiter.api.Assertions.assertTrue(thrown.getMessage().contains("broken.pdf"));
  }
}
