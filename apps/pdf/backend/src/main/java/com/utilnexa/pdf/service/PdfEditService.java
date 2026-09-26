package com.utilnexa.pdf.service;

import com.utilnexa.pdf.api.dto.EditElement;
import com.utilnexa.pdf.api.dto.EditPoint;
import com.utilnexa.pdf.service.support.PdfFileValidator;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.imageio.ImageIO;

import org.apache.pdfbox.cos.COSDictionary;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAppearanceDictionary;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAppearanceStream;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationWidget;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDBorderStyleDictionary;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDCheckBox;
import org.apache.pdfbox.pdmodel.interactive.form.PDComboBox;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDRadioButton;
import org.apache.pdfbox.pdmodel.interactive.form.PDTextField;
import org.apache.pdfbox.util.Matrix;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bakes a canvas full of placed elements from /tools/edit-pdf into one PDF in a single pass:
 * text, images, a signature stamp (an IMAGE under another name), shapes, a cosmetic whiteout
 * cover, link annotations, AcroForm fields and freehand ink strokes. Elements draw onto each
 * page's content stream in the order the client sent them, so later elements sit on top of
 * earlier ones exactly as they did on the editing canvas; link and form-field annotations are
 * order-independent (they carry no visible paint of their own).
 *
 * <p>Whiteout is deliberately cosmetic, not {@link PdfRedactService}'s true removal: it paints
 * an opaque rectangle over the region and nothing else. The page it lives on says so, and it is
 * never described as redaction.
 */
@Service
public class PdfEditService {

  private static final int MAX_ELEMENTS = 500;
  private static final int MAX_IMAGES = 40;
  private static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;
  private static final int MAX_TEXT_LENGTH = 4000;
  private static final Color DEFAULT_COLOR = Color.BLACK;
  private static final char DEVANAGARI_BLOCK_START = 'ऀ';
  private static final char DEVANAGARI_BLOCK_END = 'ॿ';

  private static final byte[] LATIN_UNICODE_FONT_BYTES = readClasspathFont("fonts/NotoSans-Regular.ttf");
  private static final byte[] DEVANAGARI_FONT_BYTES = readClasspathFont("fonts/NotoSansDevanagari-Regular.ttf");

  public byte[] edit(MultipartFile file, List<MultipartFile> images, List<EditElement> elements) throws IOException {
    PdfFileValidator.requirePdf(file);
    if (elements == null || elements.isEmpty()) {
      throw new IllegalArgumentException("At least one edit is required.");
    }
    if (elements.size() > MAX_ELEMENTS) {
      throw new IllegalArgumentException("A single edit can place at most " + MAX_ELEMENTS + " elements.");
    }
    List<MultipartFile> imageFiles = images == null ? List.of() : images;
    if (imageFiles.size() > MAX_IMAGES) {
      throw new IllegalArgumentException("A single edit can include at most " + MAX_IMAGES + " images.");
    }
    for (MultipartFile image : imageFiles) {
      validateImage(image);
    }

    byte[] bytes = file.getBytes();
    try (PDDocument document = PdfFileValidator.loadDecrypted(bytes)) {
      int pageCount = document.getNumberOfPages();
      for (EditElement element : elements) {
        if (element.kind() == null) {
          throw new IllegalArgumentException("Every element needs a kind.");
        }
        if (element.pageIndex() < 0 || element.pageIndex() >= pageCount) {
          throw new IllegalArgumentException("pageIndex " + element.pageIndex() + " is out of range.");
        }
        if ((element.kind() == EditElement.Kind.IMAGE || element.kind() == EditElement.Kind.SIGN)
            && (element.imageRef() == null || element.imageRef() < 0 || element.imageRef() >= imageFiles.size())) {
          throw new IllegalArgumentException("An image element's imageRef does not match an uploaded image.");
        }
      }

      Map<Integer, List<EditElement>> byPage =
          elements.stream().collect(Collectors.groupingBy(EditElement::pageIndex, LinkedHashMap::new, Collectors.toList()));

      PDAcroForm acroForm = null;
      // Every RADIO element sharing a fieldName is one option of the same field, even when its
      // sibling options land on a different page - so this has to live outside the per-page loop.
      Map<String, PDRadioButton> radioFields = new LinkedHashMap<>();
      for (Map.Entry<Integer, List<EditElement>> entry : byPage.entrySet()) {
        PDPage page = document.getPage(entry.getKey());
        PDRectangle mediaBox = page.getMediaBox();

        try (PDPageContentStream stream = new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
          for (EditElement element : entry.getValue()) {
            switch (element.kind()) {
              case TEXT -> withTransform(stream, mediaBox, element, () -> drawText(document, stream, mediaBox, element));
              case IMAGE, SIGN -> withTransform(
                  stream, mediaBox, element, () -> drawImage(document, stream, mediaBox, element, imageFiles.get(element.imageRef())));
              case SHAPE -> withTransform(stream, mediaBox, element, () -> drawShape(stream, mediaBox, element));
              case WHITEOUT -> withTransform(stream, mediaBox, element, () -> drawWhiteout(stream, mediaBox, element));
              // Rotating or fading a freehand stroke has no natural meaning here - points are
              // absolute already, and there is no single box to pivot or fade as a unit.
              case ANNOTATE -> drawStroke(stream, mediaBox, element);
              case LINK, FORM_FIELD -> {
                // Annotations, not content-stream paint; handled below.
              }
            }
          }
        }

        for (EditElement element : entry.getValue()) {
          if (element.kind() == EditElement.Kind.LINK) {
            addLink(page, mediaBox, element);
          } else if (element.kind() == EditElement.Kind.FORM_FIELD) {
            if (acroForm == null) {
              acroForm = getOrCreateAcroForm(document);
            }
            addFormField(document, acroForm, page, mediaBox, element, radioFields);
          }
        }
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("Editing the PDF produced an empty document.");
      }
      return out;
    }
  }

  // ---- rotation / opacity ----------------------------------------------------------------------

  @FunctionalInterface
  private interface DrawBody {
    void draw() throws IOException;
  }

  /**
   * Wraps one element's draw calls in a saved graphics state, applying rotation (around the
   * element's own center, clockwise to match how a screen editor's rotation handle reads) and/or
   * opacity first — {@code body} then draws using the exact same absolute page coordinates the
   * unrotated case always used, since the rotation lives entirely in the content stream's current
   * transformation matrix, not in the coordinates the caller computes.
   */
  private void withTransform(PDPageContentStream stream, PDRectangle box, EditElement element, DrawBody body) throws IOException {
    boolean hasRotation = element.rotationDeg() != null && element.rotationDeg() % 360f != 0f;
    boolean hasOpacity = element.opacity() != null && element.opacity() >= 0f && element.opacity() < 1f;
    if (!hasRotation && !hasOpacity) {
      body.draw();
      return;
    }

    stream.saveGraphicsState();
    try {
      if (hasOpacity) {
        float alpha = Math.max(0f, Math.min(1f, element.opacity()));
        PDExtendedGraphicsState transparency = new PDExtendedGraphicsState();
        transparency.setNonStrokingAlphaConstant(alpha);
        transparency.setStrokingAlphaConstant(alpha);
        stream.setGraphicsStateParameters(transparency);
      }
      if (hasRotation) {
        float cx = box.getLowerLeftX() + (clamp01(element.xPct()) + clamp01(element.widthPct()) / 2f) * box.getWidth();
        float cyTop = box.getUpperRightY() - clamp01(element.yPct()) * box.getHeight();
        float cy = cyTop - clamp01(element.heightPct()) / 2f * box.getHeight();
        // PDF angles increase counter-clockwise; negating matches a rotation handle a user drags
        // clockwise, which is what every screen editor's rotation gesture means.
        double radians = Math.toRadians(-element.rotationDeg());
        stream.transform(Matrix.getTranslateInstance(cx, cy));
        stream.transform(Matrix.getRotateInstance(radians, 0, 0));
        stream.transform(Matrix.getTranslateInstance(-cx, -cy));
      }
      body.draw();
    } finally {
      stream.restoreGraphicsState();
    }
  }

  // ---- TEXT ----------------------------------------------------------------------------------

  private void drawText(PDDocument document, PDPageContentStream stream, PDRectangle box, EditElement element)
      throws IOException {
    String text = element.text();
    if (text == null || text.isBlank()) return;
    if (text.length() > MAX_TEXT_LENGTH) {
      throw new IllegalArgumentException("Text elements must be " + MAX_TEXT_LENGTH + " characters or fewer.");
    }
    float fontSize = element.fontSize() == null ? 16f : Math.max(4f, Math.min(400f, element.fontSize()));
    Color color = parseColor(element.color());

    boolean hasDevanagari = containsDevanagari(text);
    PDFont latinFont = loadUnicodeFont(document, false);
    PDFont devanagariFont = hasDevanagari ? loadUnicodeFont(document, true) : null;

    float x = box.getLowerLeftX() + clamp01(element.xPct()) * box.getWidth();
    float boxWidthPts = clamp01(element.widthPct()) * box.getWidth();
    float yTop = box.getUpperRightY() - clamp01(element.yPct()) * box.getHeight();
    float leading = fontSize * 1.25f;

    List<String> wrappedLines = new ArrayList<>();
    for (String rawLine : text.split("\n", -1)) {
      wrappedLines.addAll(wrapLine(rawLine, fontSize, boxWidthPts > 8 ? boxWidthPts : Float.MAX_VALUE));
    }

    stream.beginText();
    stream.setNonStrokingColor(color);
    stream.setLeading(leading);
    stream.newLineAtOffset(x, yTop - fontSize);
    for (String wrappedLine : wrappedLines) {
      // A single wrapped line can still mix scripts ("Room 101 कमरा"), and
      // NotoSansDevanagari-Regular.ttf has no Latin glyphs (see PdfWatermarkService) — so each
      // line is drawn as consecutive same-line runs on whichever font its script needs, not one
      // font for the whole line.
      for (TextRun run : splitRuns(wrappedLine)) {
        stream.setFont(run.devanagari() ? devanagariFont : latinFont, fontSize);
        stream.showText(run.text());
      }
      stream.newLine();
    }
    stream.endText();
  }

  /** Greedy word wrap using real glyph widths, so text stays inside the box it was dropped in. */
  private List<String> wrapLine(String line, float fontSize, float maxWidthPts) {
    List<String> out = new ArrayList<>();
    if (line.isEmpty()) {
      out.add("");
      return out;
    }
    String[] words = line.split(" ");
    StringBuilder current = new StringBuilder();
    for (String word : words) {
      String candidate = current.isEmpty() ? word : current + " " + word;
      if (textWidth(candidate, fontSize) > maxWidthPts && !current.isEmpty()) {
        out.add(current.toString());
        current = new StringBuilder(word);
      } else {
        current = new StringBuilder(candidate);
      }
    }
    out.add(current.toString());
    return out;
  }

  /**
   * Splits text into consecutive runs of Devanagari vs. non-Devanagari characters, so a mixed
   * line can be drawn as separate same-line {@code showText} calls on the two different embedded
   * fonts. Mirrors {@code PdfWatermarkService.splitRuns} — duplicated rather than shared, since
   * refactoring a already-shipped tool's private helper into a new one is more risk than the
   * ~15 lines are worth.
   */
  private static List<TextRun> splitRuns(String text) {
    List<TextRun> runs = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    Boolean currentIsDevanagari = null;
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      boolean isDevanagari = c >= DEVANAGARI_BLOCK_START && c <= DEVANAGARI_BLOCK_END;
      if (currentIsDevanagari != null && isDevanagari != currentIsDevanagari) {
        runs.add(new TextRun(current.toString(), currentIsDevanagari));
        current.setLength(0);
      }
      currentIsDevanagari = isDevanagari;
      current.append(c);
    }
    if (current.length() > 0 || runs.isEmpty()) {
      runs.add(new TextRun(current.toString(), Boolean.TRUE.equals(currentIsDevanagari)));
    }
    return runs;
  }

  private float textWidth(String text, float fontSize) {
    try {
      // Width-only estimate for wrap decisions: NotoSans's own width table for the non-Devanagari
      // case, and a plain per-character estimate for Devanagari text, which NotoSans has no
      // glyphs for at all. Either way this only decides where a line breaks — final rendering
      // above always picks the correct font per run regardless of where wrapping landed.
      return STATIC_LATIN_FONT.getStringWidth(text) / 1000 * fontSize;
    } catch (IllegalArgumentException | IOException e) {
      return text.length() * fontSize * 0.55f;
    }
  }

  // ---- IMAGE / SIGN ----------------------------------------------------------------------------

  private void drawImage(
      PDDocument document, PDPageContentStream stream, PDRectangle box, EditElement element, MultipartFile imageFile)
      throws IOException {
    BufferedImage buffered = ImageIO.read(imageFile.getInputStream());
    if (buffered == null) {
      throw new IllegalArgumentException("One of the uploaded images could not be read.");
    }
    PDImageXObject imageObject = LosslessFactory.createFromImage(document, buffered);

    float x = box.getLowerLeftX() + clamp01(element.xPct()) * box.getWidth();
    float widthPts = clamp01(element.widthPct()) * box.getWidth();
    float heightPts = clamp01(element.heightPct()) * box.getHeight();
    float yTop = box.getUpperRightY() - clamp01(element.yPct()) * box.getHeight();
    float y = yTop - heightPts;

    stream.drawImage(imageObject, x, y, widthPts, heightPts);
  }

  // ---- SHAPE -------------------------------------------------------------------------------

  private void drawShape(PDPageContentStream stream, PDRectangle box, EditElement element) throws IOException {
    EditElement.ShapeKind shapeKind = element.shapeKind() == null ? EditElement.ShapeKind.RECTANGLE : element.shapeKind();
    Color color = parseColor(element.color());
    float strokeWidth = element.strokeWidth() == null ? 2f : Math.max(0.5f, Math.min(40f, element.strokeWidth()));
    boolean filled = Boolean.TRUE.equals(element.filled());

    float x = box.getLowerLeftX() + clamp01(element.xPct()) * box.getWidth();
    float widthPts = clamp01(element.widthPct()) * box.getWidth();
    float heightPts = clamp01(element.heightPct()) * box.getHeight();
    float yTop = box.getUpperRightY() - clamp01(element.yPct()) * box.getHeight();
    float yBottom = yTop - heightPts;

    if (shapeKind == EditElement.ShapeKind.X_MARK) {
      float inset = 0.1f;
      stream.moveTo(x + widthPts * inset, yBottom + heightPts * inset);
      stream.lineTo(x + widthPts * (1 - inset), yBottom + heightPts * (1 - inset));
      stream.moveTo(x + widthPts * (1 - inset), yBottom + heightPts * inset);
      stream.lineTo(x + widthPts * inset, yBottom + heightPts * (1 - inset));
      stream.setStrokingColor(color);
      stream.setLineWidth(strokeWidth);
      stream.setLineCapStyle(1);
      stream.stroke();
      return;
    }

    if (shapeKind == EditElement.ShapeKind.CHECK) {
      // Short down-stroke then a longer up-stroke, the same proportions as a handwritten check.
      stream.moveTo(x + widthPts * 0.05f, yBottom + heightPts * 0.55f);
      stream.lineTo(x + widthPts * 0.35f, yBottom + heightPts * 0.10f);
      stream.lineTo(x + widthPts * 0.95f, yBottom + heightPts * 0.80f);
      stream.setStrokingColor(color);
      stream.setLineWidth(strokeWidth);
      stream.setLineCapStyle(1);
      stream.setLineJoinStyle(1);
      stream.stroke();
      return;
    }

    if (shapeKind == EditElement.ShapeKind.ARROW) {
      // A stroked shaft plus its own filled triangular head - distinct enough from a plain
      // stroke-or-fill path (RECTANGLE/ELLIPSE/LINE below) that it draws itself rather than
      // being squeezed into that shared branch.
      boolean flipped = Boolean.TRUE.equals(element.flipped());
      float x1 = x;
      float y1 = flipped ? yBottom : yTop;
      float x2 = x + widthPts;
      float y2 = flipped ? yTop : yBottom;
      stream.moveTo(x1, y1);
      stream.lineTo(x2, y2);
      stream.setStrokingColor(color);
      stream.setLineWidth(strokeWidth);
      stream.stroke();
      addArrowhead(stream, x1, y1, x2, y2, strokeWidth, color);
      return;
    }

    switch (shapeKind) {
      case RECTANGLE -> stream.addRect(x, yBottom, widthPts, heightPts);
      case LINE -> {
        if (Boolean.TRUE.equals(element.flipped())) {
          stream.moveTo(x, yBottom);
          stream.lineTo(x + widthPts, yTop);
        } else {
          stream.moveTo(x, yTop);
          stream.lineTo(x + widthPts, yBottom);
        }
      }
      case ELLIPSE -> addEllipse(stream, x, yBottom, widthPts, heightPts);
      case ARROW, X_MARK, CHECK -> throw new IllegalStateException("handled above");
    }

    if (filled && shapeKind != EditElement.ShapeKind.LINE) {
      stream.setNonStrokingColor(color);
      stream.fill();
    } else {
      stream.setStrokingColor(color);
      stream.setLineWidth(strokeWidth);
      stream.stroke();
    }
  }

  /** A filled triangular head pointing from (x1,y1) toward (x2,y2), sized to the line's stroke. */
  private void addArrowhead(PDPageContentStream stream, float x1, float y1, float x2, float y2, float strokeWidth, Color color)
      throws IOException {
    double angle = Math.atan2(y2 - y1, x2 - x1);
    float headLength = Math.max(8f, strokeWidth * 4f);
    double spread = Math.toRadians(28);
    float leftX = (float) (x2 - headLength * Math.cos(angle - spread));
    float leftY = (float) (y2 - headLength * Math.sin(angle - spread));
    float rightX = (float) (x2 - headLength * Math.cos(angle + spread));
    float rightY = (float) (y2 - headLength * Math.sin(angle + spread));
    stream.moveTo(x2, y2);
    stream.lineTo(leftX, leftY);
    stream.lineTo(rightX, rightY);
    stream.closePath();
    stream.setNonStrokingColor(color);
    stream.fill();
  }

  /** Four cubic Béziers inscribed in the box, using the standard k ≈ 0.5523 circle constant. */
  private void addEllipse(PDPageContentStream stream, float x, float y, float w, float h) throws IOException {
    float k = 0.5523f;
    float rx = w / 2;
    float ry = h / 2;
    float cx = x + rx;
    float cy = y + ry;
    stream.moveTo(cx - rx, cy);
    stream.curveTo(cx - rx, cy + ry * k, cx - rx * k, cy + ry, cx, cy + ry);
    stream.curveTo(cx + rx * k, cy + ry, cx + rx, cy + ry * k, cx + rx, cy);
    stream.curveTo(cx + rx, cy - ry * k, cx + rx * k, cy - ry, cx, cy - ry);
    stream.curveTo(cx - rx * k, cy - ry, cx - rx, cy - ry * k, cx - rx, cy);
    stream.closePath();
  }

  // ---- WHITEOUT ------------------------------------------------------------------------------

  /**
   * A cosmetic cover only: an opaque rectangle painted over the region. The content underneath
   * is untouched — unlike {@link PdfRedactService}, nothing is removed from the page. The editor
   * must not describe this as redaction.
   */
  private void drawWhiteout(PDPageContentStream stream, PDRectangle box, EditElement element) throws IOException {
    float x = box.getLowerLeftX() + clamp01(element.xPct()) * box.getWidth();
    float widthPts = clamp01(element.widthPct()) * box.getWidth();
    float heightPts = clamp01(element.heightPct()) * box.getHeight();
    float yTop = box.getUpperRightY() - clamp01(element.yPct()) * box.getHeight();
    float yBottom = yTop - heightPts;

    stream.setNonStrokingColor(Color.WHITE);
    stream.addRect(x, yBottom, widthPts, heightPts);
    stream.fill();
  }

  // ---- ANNOTATE (freehand ink) ----------------------------------------------------------------

  private void drawStroke(PDPageContentStream stream, PDRectangle box, EditElement element) throws IOException {
    List<EditPoint> points = element.points();
    if (points == null || points.size() < 2) return;

    Color color = parseColor(element.color());
    float strokeWidth = element.strokeWidth() == null ? 3f : Math.max(0.5f, Math.min(40f, element.strokeWidth()));

    EditPoint first = points.get(0);
    stream.moveTo(toX(box, first.xPct()), toY(box, first.yPct()));
    for (int i = 1; i < points.size(); i++) {
      EditPoint p = points.get(i);
      stream.lineTo(toX(box, p.xPct()), toY(box, p.yPct()));
    }
    stream.setStrokingColor(color);
    stream.setLineWidth(strokeWidth);
    stream.setLineCapStyle(1);
    stream.setLineJoinStyle(1);
    stream.stroke();
  }

  private float toX(PDRectangle box, float xPct) {
    return box.getLowerLeftX() + clamp01(xPct) * box.getWidth();
  }

  private float toY(PDRectangle box, float yPct) {
    return box.getUpperRightY() - clamp01(yPct) * box.getHeight();
  }

  // ---- LINK ----------------------------------------------------------------------------------

  private void addLink(PDPage page, PDRectangle box, EditElement element) throws IOException {
    String url = element.url() == null ? "" : element.url().trim();
    if (!url.matches("(?i)^(https?://|mailto:).+")) {
      throw new IllegalArgumentException("Link URLs must start with http://, https:// or mailto:.");
    }

    PDAnnotationLink link = new PDAnnotationLink();
    link.setRectangle(toPdRectangle(box, element));
    PDBorderStyleDictionary border = new PDBorderStyleDictionary();
    border.setWidth(0);
    link.setBorderStyle(border);
    PDActionURI action = new PDActionURI();
    action.setURI(url);
    link.setAction(action);

    addAnnotation(page, link);
  }

  // ---- FORM_FIELD ------------------------------------------------------------------------------

  private PDAcroForm getOrCreateAcroForm(PDDocument document) throws IOException {
    PDAcroForm acroForm = document.getDocumentCatalog().getAcroForm();
    if (acroForm != null) return acroForm;
    acroForm = new PDAcroForm(document);
    document.getDocumentCatalog().setAcroForm(acroForm);
    PDResources resources = new PDResources();
    resources.put(COSName.getPDFName("Helv"), new PDType1Font(Standard14Fonts.FontName.HELVETICA));
    acroForm.setDefaultResources(resources);
    acroForm.setDefaultAppearance("/Helv 11 Tf 0 g");
    // NeedAppearances is deliberately left at its default (false/unset). It tells a viewer "do
    // not trust the /AP streams on any field in this document, regenerate them yourself" - fine
    // for a plain text field or dropdown with no value (there is nothing to render either way,
    // since every field this tool creates is blank for whoever opens the PDF next to fill in, not
    // pre-filled by this tool), but verified experimentally (rendering with poppler, not just
    // reasoning about it) to make viewers ignore this service's own hand-built checkbox and radio
    // appearance streams below - poppler drew the checkmark from some internal default and
    // nothing at all for the radio dot the moment this flag was set, versus rendering both
    // correctly, border included, the moment it was removed.
    return acroForm;
  }

  private void addFormField(
      PDDocument document, PDAcroForm acroForm, PDPage page, PDRectangle box, EditElement element, Map<String, PDRadioButton> radioFields)
      throws IOException {
    EditElement.FieldKind fieldKind = element.fieldKind() == null ? EditElement.FieldKind.TEXT_FIELD : element.fieldKind();
    switch (fieldKind) {
      case TEXT_FIELD -> addTextField(acroForm, page, box, element);
      case CHECKBOX -> addCheckbox(document, acroForm, page, box, element);
      case RADIO -> addRadioOption(document, acroForm, page, box, element, radioFields);
      case DROPDOWN -> addDropdown(acroForm, page, box, element);
    }
  }

  private void addTextField(PDAcroForm acroForm, PDPage page, PDRectangle box, EditElement element) throws IOException {
    PDTextField field = new PDTextField(acroForm);
    field.setPartialName(uniqueFieldName(acroForm, element.fieldName()));
    if (Boolean.TRUE.equals(element.multiline())) {
      field.setMultiline(true);
    }
    acroForm.getFields().add(field);
    PDAnnotationWidget widget = field.getWidgets().get(0);
    widget.setRectangle(toPdRectangle(box, element));
    widget.setPage(page);
    addAnnotation(page, widget);
  }

  private void addCheckbox(PDDocument document, PDAcroForm acroForm, PDPage page, PDRectangle box, EditElement element)
      throws IOException {
    PDCheckBox field = new PDCheckBox(acroForm);
    field.setPartialName(uniqueFieldName(acroForm, element.fieldName()));
    acroForm.getFields().add(field);

    PDRectangle rect = toPdRectangle(box, element);
    PDAnnotationWidget widget = field.getWidgets().get(0);
    widget.setRectangle(rect);
    widget.setPage(page);

    boolean checked = Boolean.TRUE.equals(element.checked());
    applyCheckOrRadioAppearance(document, widget, rect, "Yes", checked, false);
    if (checked) field.setValue("Yes");
    addAnnotation(page, widget);
  }

  private void addRadioOption(
      PDDocument document, PDAcroForm acroForm, PDPage page, PDRectangle box, EditElement element, Map<String, PDRadioButton> radioFields)
      throws IOException {
    String groupName = (element.fieldName() == null || element.fieldName().isBlank()) ? "Group" : element.fieldName().trim();
    PDRadioButton field = radioFields.get(groupName);
    // A brand-new PDRadioButton has no real widgets yet, but PDField.getWidgets() on a field with
    // no /Kids treats the field's own dictionary as if it were also a widget and returns that -
    // confirmed by rendering it: the phantom entry (no /Rect, since it is really the field dict)
    // has to be excluded here rather than folded into the list, or the group ends up one option
    // "wider" than intended with a rect-less widget that a strict renderer can choke on.
    boolean brandNewGroup = field == null;
    if (brandNewGroup) {
      field = new PDRadioButton(acroForm);
      field.setPartialName(uniqueFieldName(acroForm, groupName));
      acroForm.getFields().add(field);
      radioFields.put(groupName, field);
    }

    int existingOptionCount = brandNewGroup ? 0 : field.getWidgets().size();
    String exportValue =
        (element.optionValue() == null || element.optionValue().isBlank()) ? "Option" + (existingOptionCount + 1) : element.optionValue().trim();

    PDRectangle rect = toPdRectangle(box, element);
    PDAnnotationWidget widget = new PDAnnotationWidget();
    widget.setRectangle(rect);
    widget.setPage(page);
    boolean checked = Boolean.TRUE.equals(element.checked());
    applyCheckOrRadioAppearance(document, widget, rect, exportValue, checked, true);

    List<PDAnnotationWidget> widgets = brandNewGroup ? new ArrayList<>() : new ArrayList<>(field.getWidgets());
    widgets.add(widget);
    field.setWidgets(widgets);
    if (checked) field.setValue(exportValue);

    addAnnotation(page, widget);
  }

  private void addDropdown(PDAcroForm acroForm, PDPage page, PDRectangle box, EditElement element) throws IOException {
    PDComboBox field = new PDComboBox(acroForm);
    field.setPartialName(uniqueFieldName(acroForm, element.fieldName()));
    List<String> options = element.options() == null || element.options().isEmpty() ? List.of("Option 1", "Option 2") : element.options();
    field.setOptions(options);
    acroForm.getFields().add(field);
    PDAnnotationWidget widget = field.getWidgets().get(0);
    widget.setRectangle(toPdRectangle(box, element));
    widget.setPage(page);
    addAnnotation(page, widget);
  }

  /**
   * Builds real "Off" and on-state appearance streams for a checkbox or radio widget, rather than
   * leaning on {@code NeedAppearances} the way the plain text fields above do. A viewer
   * synthesizing text from a value is routine; synthesizing "draw a checkmark" or "draw a filled
   * dot" from nothing but a value name is not something every viewer does reliably (Acrobat
   * itself always ships real appearance streams for these), so this draws both states by hand —
   * a bordered box (or circle, for a radio option) in both, plus the mark itself only in the on
   * state, using the exact technique Acrobat's own default checkbox style uses: a ZapfDingbats
   * glyph for the check, a filled circle for the radio dot.
   */
  private void applyCheckOrRadioAppearance(
      PDDocument document, PDAnnotationWidget widget, PDRectangle rect, String onName, boolean checked, boolean isRadio)
      throws IOException {
    PDRectangle localBBox = new PDRectangle(rect.getWidth(), rect.getHeight());

    PDAppearanceStream offAppearance = new PDAppearanceStream(document);
    offAppearance.setBBox(localBBox);
    offAppearance.setResources(new PDResources());
    try (PDPageContentStream cs = new PDPageContentStream(document, offAppearance)) {
      drawFieldBorder(cs, localBBox, isRadio);
    }

    PDAppearanceStream onAppearance = new PDAppearanceStream(document);
    onAppearance.setBBox(localBBox);
    PDResources onResources = new PDResources();
    onAppearance.setResources(onResources);
    try (PDPageContentStream cs = new PDPageContentStream(document, onAppearance)) {
      drawFieldBorder(cs, localBBox, isRadio);
      if (isRadio) {
        drawFilledDot(cs, localBBox);
      } else {
        drawCheckMark(cs, localBBox);
      }
    }

    COSDictionary normalStates = new COSDictionary();
    normalStates.setItem(COSName.getPDFName("Off"), offAppearance.getCOSObject());
    normalStates.setItem(COSName.getPDFName(onName), onAppearance.getCOSObject());
    COSDictionary appearanceDict = new COSDictionary();
    appearanceDict.setItem(COSName.N, normalStates);
    widget.getCOSObject().setItem(COSName.AP, appearanceDict);
    widget.getCOSObject().setName(COSName.AS, checked ? onName : "Off");
  }

  private void drawFieldBorder(PDPageContentStream cs, PDRectangle bbox, boolean isRadio) throws IOException {
    cs.setStrokingColor(Color.BLACK);
    cs.setLineWidth(1f);
    if (isRadio) {
      addEllipse(cs, 1f, 1f, bbox.getWidth() - 2f, bbox.getHeight() - 2f);
    } else {
      cs.addRect(1f, 1f, bbox.getWidth() - 2f, bbox.getHeight() - 2f);
    }
    cs.stroke();
  }

  private void drawFilledDot(PDPageContentStream cs, PDRectangle bbox) throws IOException {
    float inset = Math.min(bbox.getWidth(), bbox.getHeight()) * 0.28f;
    addEllipse(cs, inset, inset, bbox.getWidth() - inset * 2, bbox.getHeight() - inset * 2);
    cs.setNonStrokingColor(Color.BLACK);
    cs.fill();
  }

  /**
   * ZapfDingbats byte code 0x34 is glyph "a20" in that symbol font's standard encoding - a check
   * mark - the same technique Acrobat's own default "Check" checkbox style uses. PDFBox's
   * {@code showText} takes Unicode text and encodes it via each character's glyph name, not a raw
   * byte value, so the ASCII digit '4' fails (its glyph name is "four", which ZapfDingbats has no
   * such glyph for) - U+2714 HEAVY CHECK MARK is the Unicode character PDFBox's glyph list
   * actually maps to "a20", which is what reaches the right byte code here.
   */
  private void drawCheckMark(PDPageContentStream cs, PDRectangle bbox) throws IOException {
    PDFont zapfDingbats = new PDType1Font(Standard14Fonts.FontName.ZAPF_DINGBATS);
    float fontSize = bbox.getHeight() * 0.75f;
    cs.beginText();
    cs.setFont(zapfDingbats, fontSize);
    cs.setNonStrokingColor(Color.BLACK);
    cs.newLineAtOffset(bbox.getWidth() * 0.14f, bbox.getHeight() * 0.18f);
    cs.showText("✔");
    cs.endText();
  }

  private void addAnnotation(PDPage page, PDAnnotation annotation) throws IOException {
    List<PDAnnotation> annotations = page.getAnnotations();
    annotations.add(annotation);
    page.setAnnotations(annotations);
  }

  private String uniqueFieldName(PDAcroForm acroForm, String requested) throws IOException {
    String base = (requested == null || requested.isBlank()) ? "Field" : requested.trim();
    if (acroForm.getField(base) == null) return base;
    for (int i = 2; i < 10_000; i++) {
      String candidate = base + " " + i;
      if (acroForm.getField(candidate) == null) return candidate;
    }
    throw new IllegalArgumentException("Too many form fields share the name \"" + base + "\".");
  }

  // ---- shared helpers --------------------------------------------------------------------------

  // A font needs a PDDocument to embed into, even one used only to measure string widths for word
  // wrap. PDFBox parses the font program into memory at load time, so the font stays usable after
  // this scratch document would be closed — but it is deliberately never closed at all: it is a
  // single object for the process's whole lifetime, not one per request, and PDDocument.close()
  // on some PDFBox versions releases the embedded TrueTypeFont's internal buffers along with it,
  // which would make width lookups on this font unsafe afterward.
  private static final PDDocument MEASURING_SCRATCH_DOCUMENT = new PDDocument();
  private static final PDFont STATIC_LATIN_FONT;

  static {
    try {
      STATIC_LATIN_FONT =
          PDType0Font.load(MEASURING_SCRATCH_DOCUMENT, new ByteArrayInputStream(LATIN_UNICODE_FONT_BYTES), false);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private PDFont loadUnicodeFont(PDDocument document, boolean devanagari) throws IOException {
    byte[] source = devanagari ? DEVANAGARI_FONT_BYTES : LATIN_UNICODE_FONT_BYTES;
    return PDType0Font.load(document, new ByteArrayInputStream(source));
  }

  private static boolean containsDevanagari(String text) {
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      if (c >= DEVANAGARI_BLOCK_START && c <= DEVANAGARI_BLOCK_END) {
        return true;
      }
    }
    return false;
  }

  private PDRectangle toPdRectangle(PDRectangle box, EditElement element) {
    float x = box.getLowerLeftX() + clamp01(element.xPct()) * box.getWidth();
    float widthPts = clamp01(element.widthPct()) * box.getWidth();
    float heightPts = clamp01(element.heightPct()) * box.getHeight();
    float yTop = box.getUpperRightY() - clamp01(element.yPct()) * box.getHeight();
    float yBottom = yTop - heightPts;
    return new PDRectangle(x, yBottom, widthPts, heightPts);
  }

  private Color parseColor(String hex) {
    if (hex == null || hex.isBlank()) return DEFAULT_COLOR;
    try {
      String normalized = hex.startsWith("#") ? hex.substring(1) : hex;
      if (!normalized.matches("[0-9a-fA-F]{6}")) return DEFAULT_COLOR;
      return new Color(Integer.parseInt(normalized, 16));
    } catch (NumberFormatException e) {
      return DEFAULT_COLOR;
    }
  }

  private static float clamp01(float v) {
    return Math.max(0f, Math.min(1f, v));
  }

  private void validateImage(MultipartFile image) {
    if (image == null || image.isEmpty()) {
      throw new IllegalArgumentException("An uploaded image is empty.");
    }
    String type = image.getContentType();
    String name = image.getOriginalFilename() == null ? "" : image.getOriginalFilename().toLowerCase();
    boolean looksLikeImage = (type != null && type.startsWith("image/")) || name.matches(".*\\.(png|jpe?g|webp)$");
    if (!looksLikeImage) {
      throw new IllegalArgumentException("Only PNG, JPEG or WebP images can be placed.");
    }
    if (image.getSize() > MAX_IMAGE_BYTES) {
      throw new IllegalArgumentException("Each image must be 10 MB or smaller.");
    }
  }

  private static byte[] readClasspathFont(String classpathPath) {
    try (InputStream in = new ClassPathResource(classpathPath).getInputStream()) {
      return in.readAllBytes();
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to load bundled font: " + classpathPath, e);
    }
  }

  private record TextRun(String text, boolean devanagari) {}
}
