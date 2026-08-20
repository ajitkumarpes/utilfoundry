package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfGrayscaleService {

  public byte[] grayscale(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      for (PDPage page : document.getPages()) {
        grayscaleImages(document, page.getResources());
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Converting the PDF to grayscale produced an empty document.");
      }
      return out;
    }
  }

  private void grayscaleImages(PDDocument document, PDResources resources) throws IOException {
    if (resources == null) return;

    for (COSName name : resources.getXObjectNames()) {
      PDXObject xobject = resources.getXObject(name);
      if (xobject instanceof PDImageXObject image) {
        BufferedImage color = image.getImage();
        BufferedImage gray = new BufferedImage(color.getWidth(), color.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        gray.getGraphics().drawImage(color, 0, 0, null);
        resources.put(name, LosslessFactory.createFromImage(document, gray));
      } else if (xobject instanceof PDFormXObject form) {
        grayscaleImages(document, form.getResources());
      }
    }
  }
}
