package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javax.imageio.ImageIO;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfExtractImagesService {

  public List<NamedFile> extract(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<NamedFile> results = new ArrayList<>();
      int pageNumber = 1;
      for (PDPage page : document.getPages()) {
        int[] counter = {1};
        collectImages(page.getResources(), pageNumber, counter, results);
        pageNumber++;
      }

      if (results.isEmpty()) {
        throw new IllegalArgumentException("No embedded images were found in this PDF.");
      }
      return results;
    }
  }

  private void collectImages(PDResources resources, int pageNumber, int[] counter, List<NamedFile> results)
      throws IOException {
    if (resources == null) return;

    for (COSName name : resources.getXObjectNames()) {
      PDXObject xobject = resources.getXObject(name);
      if (xobject instanceof PDImageXObject image) {
        BufferedImage buffered = image.getImage();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(buffered, "png", out);
        results.add(
            new NamedFile("page-" + pageNumber + "-image-" + counter[0] + ".png", out.toByteArray(), "image/png"));
        counter[0]++;
      } else if (xobject instanceof PDFormXObject form) {
        collectImages(form.getResources(), pageNumber, counter, results);
      }
    }
  }
}
