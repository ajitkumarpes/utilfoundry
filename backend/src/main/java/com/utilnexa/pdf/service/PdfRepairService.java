package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * PDFBox's parser already recovers from a damaged xref table or trailer by falling back to a
 * full-file object scan when it loads a document — this tool's whole job is to load whatever
 * PDFBox was able to recover and re-save it as a clean, well-formed file. If the input is too
 * damaged even for that recovery scan, loading throws the same IOException every other tool in
 * this codebase already surfaces as a clean 400.
 */
@Service
public class PdfRepairService {

  public byte[] repair(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Repairing the PDF produced an empty document.");
      }
      return out;
    }
  }
}
