package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.NamedFile;
import com.utilnexa.pdf.service.support.FilenameDeduplicator;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDFontDescriptor;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Extracts embedded font PROGRAMS - the actual font files a PDF carries, not this document's own
 * text/image content, unlike {@link PdfExtractImagesService} / {@link PdfExtractAttachmentsService}.
 * Disclosed directly in the tool's UI as licensing-sensitive: most commercial font EULAs permit
 * embedding a font for display but forbid extracting the file for reuse elsewhere. Most
 * PDF-embedded fonts are also subsetted - the BaseFont name carries a 6-uppercase-letter "ABCDEF+"
 * prefix per PDF spec convention when a font contains only the glyphs the document actually uses,
 * not a complete character set - and that prefix is left in the extracted filename rather than
 * stripped, so the subset-ness is visible, not hidden.
 *
 * <p>The same embedded font object is very often referenced by every page of a document; extracted
 * once per distinct font program (by COS object identity), not once per page reference, or a
 * 200-page document using one font throughout would produce 200 duplicate files.
 */
@Service
public class PdfExtractFontsService {

  public List<NamedFile> extract(MultipartFile file) throws IOException {
    PdfFileValidator.requirePdf(file);

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      List<NamedFile> results = new ArrayList<>();
      Set<COSBase> seen = new HashSet<>();
      FilenameDeduplicator names = new FilenameDeduplicator();

      for (PDPage page : document.getPages()) {
        collectFonts(page.getResources(), seen, names, results);
      }

      if (results.isEmpty()) {
        throw new IllegalArgumentException("No embedded font files were found in this PDF.");
      }
      return results;
    }
  }

  private void collectFonts(
      PDResources resources, Set<COSBase> seen, FilenameDeduplicator names, List<NamedFile> results)
      throws IOException {
    if (resources == null) return;

    for (COSName name : resources.getFontNames()) {
      PDFont font = resources.getFont(name);
      if (font != null) {
        addFontIfEmbedded(font, seen, names, results);
      }
    }
    for (COSName name : resources.getXObjectNames()) {
      PDXObject xobject = resources.getXObject(name);
      if (xobject instanceof PDFormXObject form) {
        collectFonts(form.getResources(), seen, names, results);
      }
    }
  }

  private void addFontIfEmbedded(PDFont font, Set<COSBase> seen, FilenameDeduplicator names, List<NamedFile> results)
      throws IOException {
    PDFontDescriptor descriptor = font.getFontDescriptor();
    if (descriptor == null) return;

    FontProgram program = resolveFontProgram(descriptor);
    if (program == null) return;
    if (!seen.add(program.stream().getCOSObject())) return;

    byte[] fontBytes = program.stream().toByteArray();
    if (fontBytes.length == 0) return;

    String baseName = font.getName();
    if (baseName == null || baseName.isBlank()) {
      baseName = "font-" + (results.size() + 1);
    }
    String filename = names.uniqueName(baseName + program.extension());
    results.add(new NamedFile(filename, fontBytes, program.contentType()));
  }

  private FontProgram resolveFontProgram(PDFontDescriptor descriptor) {
    if (descriptor.getFontFile2() != null) {
      return new FontProgram(descriptor.getFontFile2(), ".ttf", "font/ttf");
    }
    if (descriptor.getFontFile3() != null) {
      PDStream fontFile3 = descriptor.getFontFile3();
      String subtype = fontFile3.getCOSObject().getNameAsString(COSName.SUBTYPE);
      boolean isOpenType = "OpenType".equals(subtype);
      return new FontProgram(fontFile3, isOpenType ? ".otf" : ".cff", isOpenType ? "font/otf" : "font/x-cff");
    }
    if (descriptor.getFontFile() != null) {
      return new FontProgram(descriptor.getFontFile(), ".pfb", "application/octet-stream");
    }
    return null;
  }

  private record FontProgram(PDStream stream, String extension, String contentType) {}
}
