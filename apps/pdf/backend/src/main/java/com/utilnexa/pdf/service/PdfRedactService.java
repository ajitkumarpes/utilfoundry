package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.RedactionArea;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.geom.Point2D;
import java.awt.geom.Rectangle2D;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.pdfbox.contentstream.operator.Operator;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.common.PDStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdfwriter.ContentStreamWriter;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * True content-removal redaction, not a visual overlay. A custom {@link PDFTextStripper}
 * subclass walks each page's real content stream and rebuilds it with any text-show or
 * image-draw operator that overlaps a redaction rectangle dropped entirely, before an opaque
 * box is drawn over the same region. Extending {@code PDFTextStripper} (rather than the bare
 * {@code PDFStreamEngine}) is deliberate: its constructor already registers the full standard
 * operator set, so {@code cm}/{@code Tm}/{@code Tf}/etc. state tracking is guaranteed correct
 * without hand-listing ~20 operator classes from memory — a silent gap there would mean this
 * tool appears to redact while doing nothing.
 */
@Service
public class PdfRedactService {

  public byte[] redact(MultipartFile file, List<RedactionArea> redactions) throws IOException {
    PdfFileValidator.requirePdf(file);
    if (redactions == null || redactions.isEmpty()) {
      throw new IllegalArgumentException("At least one redaction area is required.");
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      int pageCount = document.getNumberOfPages();
      for (RedactionArea r : redactions) {
        if (r.pageIndex() < 0 || r.pageIndex() >= pageCount) {
          throw new IllegalArgumentException("pageIndex " + r.pageIndex() + " is out of range.");
        }
      }

      Map<Integer, List<RedactionArea>> byPage =
          redactions.stream().collect(Collectors.groupingBy(RedactionArea::pageIndex));

      for (Map.Entry<Integer, List<RedactionArea>> entry : byPage.entrySet()) {
        PDPage page = document.getPage(entry.getKey());
        PDRectangle mediaBox = page.getMediaBox();
        List<Rectangle2D> pageRects =
            entry.getValue().stream().map(r -> toPageRect(mediaBox, r)).collect(Collectors.toList());

        filterContentStream(document, page, entry.getKey() + 1, pageRects);
        removeOverlappingAnnotations(page, pageRects);
        drawOpaqueCovers(document, page, pageRects);
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Redacting the PDF produced an empty document.");
      }
      return out;
    }
  }

  private void filterContentStream(PDDocument document, PDPage page, int onePagedPageNumber, List<Rectangle2D> rects)
      throws IOException {
    RedactionStripper stripper = new RedactionStripper(rects);
    stripper.setStartPage(onePagedPageNumber);
    stripper.setEndPage(onePagedPageNumber);
    stripper.getText(document);

    PDStream newStream = new PDStream(document);
    try (OutputStream os = newStream.createOutputStream(COSName.FLATE_DECODE)) {
      new ContentStreamWriter(os).writeTokens(stripper.outputTokens);
    }
    page.setContents(newStream);
  }

  private void removeOverlappingAnnotations(PDPage page, List<Rectangle2D> rects) throws IOException {
    List<PDAnnotation> kept = new ArrayList<>();
    for (PDAnnotation annotation : page.getAnnotations()) {
      PDRectangle rect = annotation.getRectangle();
      Rectangle2D box =
          rect == null
              ? null
              : new Rectangle2D.Float(rect.getLowerLeftX(), rect.getLowerLeftY(), rect.getWidth(), rect.getHeight());
      if (box == null || rects.stream().noneMatch(r -> r.intersects(box))) {
        kept.add(annotation);
      }
    }
    page.setAnnotations(kept);
  }

  private void drawOpaqueCovers(PDDocument document, PDPage page, List<Rectangle2D> rects) throws IOException {
    try (PDPageContentStream stream = new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
      stream.setNonStrokingColor(0, 0, 0);
      for (Rectangle2D r : rects) {
        stream.addRect((float) r.getX(), (float) r.getY(), (float) r.getWidth(), (float) r.getHeight());
      }
      stream.fill();
    }
  }

  private static Rectangle2D toPageRect(PDRectangle box, RedactionArea r) {
    float x = box.getLowerLeftX() + clamp01(r.xPct()) * box.getWidth();
    float widthPts = clamp01(r.widthPct()) * box.getWidth();
    float topFromTop = clamp01(r.yPct()) * box.getHeight();
    float heightPts = clamp01(r.heightPct()) * box.getHeight();
    float yTop = box.getUpperRightY() - topFromTop;
    float yBottom = yTop - heightPts;
    return new Rectangle2D.Float(x, yBottom, widthPts, yTop - yBottom);
  }

  private static float clamp01(float v) {
    return Math.max(0f, Math.min(1f, v));
  }

  private static final class RedactionStripper extends PDFTextStripper {

    private static final Set<String> TEXT_SHOW_OPS = Set.of("Tj", "TJ", "'", "\"");

    private final List<Rectangle2D> redactionRects;
    private final List<Object> outputTokens = new ArrayList<>();
    private int formDepth = 0;
    private boolean hitSinceTopLevelReset = false;

    RedactionStripper(List<Rectangle2D> redactionRects) throws IOException {
      this.redactionRects = redactionRects;
    }

    @Override
    protected void processOperator(Operator operator, List<COSBase> operands) throws IOException {
      boolean topLevel = formDepth == 0;
      String name = operator.getName();

      boolean directImageHit = false;
      boolean enteringForm = false;
      if (topLevel && "Do".equals(name) && !operands.isEmpty() && operands.get(0) instanceof COSName xobjectName) {
        PDXObject xobject = resolveXObject(xobjectName);
        if (xobject instanceof PDImageXObject) {
          directImageHit = intersectsAny(unitSquareBounds(getGraphicsState().getCurrentTransformationMatrix()));
        } else if (xobject != null) {
          enteringForm = true;
        }
      }

      if (topLevel) {
        hitSinceTopLevelReset = false;
      }
      if (enteringForm) {
        formDepth++;
      }

      super.processOperator(operator, operands);

      if (enteringForm) {
        formDepth--;
      }

      if (topLevel) {
        boolean isTextShow = TEXT_SHOW_OPS.contains(name);
        boolean drop = directImageHit || ((isTextShow || "Do".equals(name)) && hitSinceTopLevelReset);
        if (!drop) {
          outputTokens.addAll(operands);
          outputTokens.add(operator);
        }
      }
    }

    @Override
    protected void processTextPosition(TextPosition text) {
      if (intersectsAny(unitSquareBounds(text.getTextMatrix()))) {
        hitSinceTopLevelReset = true;
      }
      super.processTextPosition(text);
    }

    private PDXObject resolveXObject(COSName name) {
      try {
        PDResources resources = getResources();
        return resources == null ? null : resources.getXObject(name);
      } catch (IOException e) {
        return null;
      }
    }

    private boolean intersectsAny(Rectangle2D box) {
      for (Rectangle2D r : redactionRects) {
        if (r.intersects(box)) return true;
      }
      return false;
    }

    private Rectangle2D unitSquareBounds(Matrix m) {
      Point2D p00 = m.transformPoint(0, 0);
      Point2D p10 = m.transformPoint(1, 0);
      Point2D p01 = m.transformPoint(0, 1);
      Point2D p11 = m.transformPoint(1, 1);
      double minX = Math.min(Math.min(p00.getX(), p10.getX()), Math.min(p01.getX(), p11.getX()));
      double maxX = Math.max(Math.max(p00.getX(), p10.getX()), Math.max(p01.getX(), p11.getX()));
      double minY = Math.min(Math.min(p00.getY(), p10.getY()), Math.min(p01.getY(), p11.getY()));
      double maxY = Math.max(Math.max(p00.getY(), p10.getY()), Math.max(p01.getY(), p11.getY()));
      return new Rectangle2D.Double(minX, minY, maxX - minX, maxY - minY);
    }
  }
}
