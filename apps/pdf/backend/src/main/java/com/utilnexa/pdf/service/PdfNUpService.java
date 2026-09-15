package com.utilnexa.pdf.service;

import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.pdfbox.multipdf.LayerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Combines multiple source pages onto fewer output sheets for printing (2-up: 1x2 landscape,
 * 4-up: 2x2 landscape). Each source page is imported as a reusable Form XObject via
 * LayerUtility (preserves real vector/text content — never rasterizes to an image) and drawn
 * scaled-to-fit, centered, inside its grid cell, preserving aspect ratio rather than stretching.
 */
@Service
public class PdfNUpService {

  private static final float MARGIN = 18f;
  private static final float GUTTER = 10f;

  public byte[] nUp(MultipartFile file, int pagesPerSheet) throws IOException {
    PdfFileValidator.requirePdf(file);
    if (pagesPerSheet != 2 && pagesPerSheet != 4) {
      throw new IllegalArgumentException("pagesPerSheet must be 2 or 4.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument source = PdfFileValidator.loadDecrypted(bytes);
        PDDocument output = new PDDocument()) {
      int sourcePageCount = source.getNumberOfPages();
      if (sourcePageCount == 0) {
        throw new IllegalArgumentException("The PDF has no pages.");
      }

      int cols = 2;
      int rows = pagesPerSheet == 2 ? 1 : 2;
      int cellsPerSheet = rows * cols;
      PDRectangle sheet = new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
      float cellWidth = (sheet.getWidth() - MARGIN * 2 - GUTTER * (cols - 1)) / cols;
      float cellHeight = (sheet.getHeight() - MARGIN * 2 - GUTTER * (rows - 1)) / rows;

      LayerUtility layerUtility = new LayerUtility(output);
      int outputPageCount = (int) Math.ceil((double) sourcePageCount / cellsPerSheet);

      for (int sheetIndex = 0; sheetIndex < outputPageCount; sheetIndex++) {
        PDPage outputPage = new PDPage(sheet);
        output.addPage(outputPage);

        try (PDPageContentStream stream = new PDPageContentStream(output, outputPage)) {
          for (int cell = 0; cell < cellsPerSheet; cell++) {
            int sourceIndex = sheetIndex * cellsPerSheet + cell;
            if (sourceIndex >= sourcePageCount) {
              break;
            }
            int row = cell / cols;
            int col = cell % cols;
            float cellX = MARGIN + col * (cellWidth + GUTTER);
            float cellY = sheet.getHeight() - MARGIN - (row + 1) * cellHeight - row * GUTTER;

            drawPageInCell(layerUtility, source, sourceIndex, stream, cellX, cellY, cellWidth, cellHeight);
          }
        }
      }

      ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
      output.save(outputStream);
      byte[] out = outputStream.toByteArray();
      if (out.length == 0) {
        throw new IOException("Combining the PDF's pages produced an empty document.");
      }
      return out;
    }
  }

  private void drawPageInCell(
      LayerUtility layerUtility,
      PDDocument source,
      int sourceIndex,
      PDPageContentStream stream,
      float cellX,
      float cellY,
      float cellWidth,
      float cellHeight)
      throws IOException {
    PDFormXObject form = layerUtility.importPageAsForm(source, sourceIndex);
    PDRectangle bbox = form.getBBox();
    float scale = Math.min(cellWidth / bbox.getWidth(), cellHeight / bbox.getHeight());
    float scaledWidth = bbox.getWidth() * scale;
    float scaledHeight = bbox.getHeight() * scale;
    float offsetX = cellX + (cellWidth - scaledWidth) / 2f;
    float offsetY = cellY + (cellHeight - scaledHeight) / 2f;

    stream.saveGraphicsState();
    stream.transform(Matrix.getTranslateInstance(offsetX, offsetY));
    stream.transform(Matrix.getScaleInstance(scale, scale));
    stream.transform(Matrix.getTranslateInstance(-bbox.getLowerLeftX(), -bbox.getLowerLeftY()));
    stream.drawForm(form);
    stream.restoreGraphicsState();
  }
}
