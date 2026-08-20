package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfToTextService {

  public byte[] extractText(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      String text = new PDFTextStripper().getText(document);
      return text.getBytes(StandardCharsets.UTF_8);
    }
  }
}
