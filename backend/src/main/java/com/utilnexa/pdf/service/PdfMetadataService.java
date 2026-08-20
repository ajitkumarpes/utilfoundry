package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfMetadataService {

  private static final int MAX_FIELD_LENGTH = 300;

  public byte[] updateMetadata(MultipartFile file, String title, String author, String subject, String keywords)
      throws IOException {
    PdfFileValidator.requirePdf(file);
    if (isBlank(title) && isBlank(author) && isBlank(subject) && isBlank(keywords)) {
      throw new IllegalArgumentException("Provide at least one field to update.");
    }
    requireWithinLimit("Title", title);
    requireWithinLimit("Author", author);
    requireWithinLimit("Subject", subject);
    requireWithinLimit("Keywords", keywords);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      PDDocumentInformation info = document.getDocumentInformation();
      if (title != null) info.setTitle(title);
      if (author != null) info.setAuthor(author);
      if (subject != null) info.setSubject(subject);
      if (keywords != null) info.setKeywords(keywords);

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Updating the PDF's metadata produced an empty document.");
      }
      return out;
    }
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private static void requireWithinLimit(String fieldName, String value) {
    if (value != null && value.length() > MAX_FIELD_LENGTH) {
      throw new IllegalArgumentException(fieldName + " must be " + MAX_FIELD_LENGTH + " characters or fewer.");
    }
  }
}
