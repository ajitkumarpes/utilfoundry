package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfUnlockService {

  public byte[] unlock(MultipartFile file, String currentPassword) throws IOException {
    PdfFileValidator.requirePdf(file);
    String password = currentPassword == null ? "" : currentPassword;

    byte[] bytes = file.getBytes();
    PDDocument document = loadWithPassword(bytes, password);

    try (document) {
      if (!document.isEncrypted()) {
        throw new IllegalArgumentException("This PDF is not password-protected.");
      }
      document.setAllSecurityToBeRemoved(true);

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Unlocking the PDF produced an empty document.");
      }
      return out;
    }
  }

  private PDDocument loadWithPassword(byte[] bytes, String password) throws IOException {
    try {
      return Loader.loadPDF(bytes, password);
    } catch (InvalidPasswordException e) {
      throw new IllegalArgumentException("Incorrect password.");
    } catch (IOException e) {
      // Same wording as every other tool; a damaged upload is bad input, not a server fault.
      throw new IllegalArgumentException("This PDF could not be read — it appears to be corrupted or invalid.");
    }
  }
}
