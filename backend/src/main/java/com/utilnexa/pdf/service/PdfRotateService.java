package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfRotateService {

  public byte[] rotate(MultipartFile file, int angle) throws IOException {
    PdfFileValidator.requirePdf(file);
    if (angle != 90 && angle != 180 && angle != 270) {
      throw new IllegalArgumentException("angle must be 90, 180, or 270.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      for (PDPage page : document.getPages()) {
        page.setRotation((page.getRotation() + angle) % 360);
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Rotating the PDF produced an empty document.");
      }
      return out;
    }
  }
}
