package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfProtectService {

  public byte[] protect(
      MultipartFile file,
      String userPassword,
      boolean allowPrinting,
      boolean allowCopying,
      boolean allowEditing,
      boolean allowFillingForms)
      throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      AccessPermission permission = new AccessPermission();
      permission.setCanPrint(allowPrinting);
      permission.setCanExtractContent(allowCopying);
      permission.setCanModify(allowEditing);
      permission.setCanModifyAnnotations(false);
      permission.setCanFillInForm(allowFillingForms);
      permission.setCanAssembleDocument(false);

      // Random, never returned to the caller. If this equalled the user's own open
      // password, the permission restrictions above would be bypassable with the
      // same password that opens the file.
      String ownerPassword = UUID.randomUUID().toString();
      String openPassword = userPassword == null ? "" : userPassword;

      StandardProtectionPolicy policy = new StandardProtectionPolicy(ownerPassword, openPassword, permission);
      policy.setEncryptionKeyLength(256);
      policy.setPreferAES(true);
      document.protect(policy);

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Protecting the PDF produced an empty document.");
      }
      return out;
    }
  }
}
