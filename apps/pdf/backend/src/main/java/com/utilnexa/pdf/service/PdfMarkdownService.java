package com.utilnexa.pdf.service;

import java.awt.Color;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDBorderStyleDictionary;
import org.apache.pdfbox.util.Matrix;
import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Code;
import org.commonmark.node.Emphasis;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.Heading;
import org.commonmark.node.Image;
import org.commonmark.node.IndentedCodeBlock;
import org.commonmark.node.Link;
import org.commonmark.node.ListItem;
import org.commonmark.node.Node;
import org.commonmark.node.OrderedList;
import org.commonmark.node.Paragraph;
import org.commonmark.node.SoftLineBreak;
import org.commonmark.node.StrongEmphasis;
import org.commonmark.node.Text;
import org.commonmark.node.ThematicBreak;
import org.commonmark.parser.Parser;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class PdfMarkdownService {

  private static final int MAX_MARKDOWN_LENGTH = 500_000;
  private static final int MAX_PAGES = 500;
  private static final float MARGIN = 50f;
  private static final float BODY_SIZE = 11f;
  private static final float CODE_SIZE = 10f;
  private static final float[] HEADING_SIZES = {24f, 20f, 17f, 15f, 13f, 12f};
  private static final float LEADING_RATIO = 1.35f;
  private static final float BLOCK_GAP = 9f;
  private static final float HEADING_GAP_BEFORE = 15f;
  private static final float LIST_INDENT = 18f;
  private static final float QUOTE_INDENT = 14f;
  private static final float QUOTE_BAR_WIDTH = 2.2f;
  private static final float CODE_PAD = 8f;
  private static final float RULE_GAP = 10f;
  private static final Color LINK_COLOR = new Color(37, 99, 235);
  private static final char DEVANAGARI_BLOCK_START = 'ऀ';
  private static final char DEVANAGARI_BLOCK_END = 'ॿ';

  private static final byte[] LATIN_REGULAR = readClasspathFont("fonts/NotoSans-Regular.ttf");
  private static final byte[] LATIN_BOLD = readClasspathFont("fonts/NotoSans-Bold.ttf");
  private static final byte[] LATIN_ITALIC = readClasspathFont("fonts/NotoSans-Italic.ttf");
  private static final byte[] DEVANAGARI_REGULAR = readClasspathFont("fonts/NotoSansDevanagari-Regular.ttf");
  private static final byte[] DEVANAGARI_BOLD = readClasspathFont("fonts/NotoSansDevanagari-Bold.ttf");

  private static final Parser PARSER = Parser.builder().build();

  public byte[] convert(String markdown, String pageSizeParam) throws IOException {
    if (markdown == null || markdown.isBlank()) {
      throw new IllegalArgumentException("Markdown text is required.");
    }
    if (markdown.length() > MAX_MARKDOWN_LENGTH) {
      throw new IllegalArgumentException("Markdown must be " + MAX_MARKDOWN_LENGTH + " characters or fewer.");
    }
    PDRectangle pageSize = resolvePageSize(pageSizeParam);

    Node root = PARSER.parse(markdown);
    MdVisitor visitor = new MdVisitor();
    root.accept(visitor);
    List<Block> blocks = visitor.blocks;
    if (blocks.isEmpty()) {
      throw new IllegalArgumentException("This didn't produce any visible content.");
    }

    try (PDDocument document = new PDDocument()) {
      Renderer renderer = new Renderer(document, pageSize);
      for (Block block : blocks) {
        renderer.render(block);
      }
      renderer.close();

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      document.save(output);
      byte[] out = output.toByteArray();
      if (out.length == 0) {
        throw new IOException("PDF generation produced an empty document.");
      }
      return out;
    }
  }

  private PDRectangle resolvePageSize(String pageSize) {
    if (pageSize == null || pageSize.isBlank()) {
      return PDRectangle.A4;
    }
    return switch (pageSize.trim().toUpperCase()) {
      case "A4" -> PDRectangle.A4;
      case "LETTER" -> PDRectangle.LETTER;
      default -> throw new IllegalArgumentException("pageSize must be A4 or LETTER.");
    };
  }

  private static byte[] readClasspathFont(String classpathPath) {
    try (InputStream in = new ClassPathResource(classpathPath).getInputStream()) {
      return in.readAllBytes();
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to load bundled font: " + classpathPath, e);
    }
  }

  // ==================== AST -> Block collection ====================

  private enum BlockKind { HEADING, PARAGRAPH, CODE_BLOCK, LIST_ITEM, RULE }

  private record StyledRun(String text, boolean bold, boolean italic, boolean code, String linkUrl) {}

  private record Block(
      BlockKind kind, int level, int indentDepth, int quoteDepth,
      String marker, String literalText, List<StyledRun> runs) {}

  private static final class ListCtx {
    final boolean ordered;
    int counter;
    final String delimiter;

    ListCtx(boolean ordered, int counter, String delimiter) {
      this.ordered = ordered;
      this.counter = counter;
      this.delimiter = delimiter;
    }
  }

  private static final class MdVisitor extends AbstractVisitor {
    final List<Block> blocks = new ArrayList<>();
    List<StyledRun> currentRuns;
    boolean bold;
    boolean italic;
    boolean code;
    String linkUrl;
    int quoteDepth;
    final Deque<ListCtx> listStack = new ArrayDeque<>();

    @Override
    public void visit(Heading heading) {
      currentRuns = new ArrayList<>();
      visitChildren(heading);
      if (!currentRuns.isEmpty()) {
        blocks.add(new Block(BlockKind.HEADING, heading.getLevel(), 0, quoteDepth, null, null, currentRuns));
      }
      currentRuns = null;
    }

    @Override
    public void visit(Paragraph paragraph) {
      currentRuns = new ArrayList<>();
      visitChildren(paragraph);
      if (!currentRuns.isEmpty()) {
        blocks.add(new Block(BlockKind.PARAGRAPH, 0, 0, quoteDepth, null, null, currentRuns));
      }
      currentRuns = null;
    }

    @Override
    public void visit(Text text) {
      if (currentRuns != null && !text.getLiteral().isEmpty()) {
        currentRuns.add(new StyledRun(text.getLiteral(), bold, italic, code, linkUrl));
      }
    }

    @Override
    public void visit(Emphasis emphasis) {
      boolean prev = italic;
      italic = true;
      visitChildren(emphasis);
      italic = prev;
    }

    @Override
    public void visit(StrongEmphasis strongEmphasis) {
      boolean prev = bold;
      bold = true;
      visitChildren(strongEmphasis);
      bold = prev;
    }

    @Override
    public void visit(Code codeSpan) {
      if (currentRuns != null) {
        currentRuns.add(new StyledRun(codeSpan.getLiteral(), bold, italic, true, linkUrl));
      }
    }

    @Override
    public void visit(Link link) {
      String prev = linkUrl;
      linkUrl = sanitizeUrl(link.getDestination());
      visitChildren(link);
      linkUrl = prev;
    }

    @Override
    public void visit(Image image) {
      if (currentRuns != null) {
        String alt = extractText(image);
        currentRuns.add(new StyledRun("[Image" + (alt.isEmpty() ? "" : ": " + alt) + "]", bold, true, false, null));
      }
    }

    @Override
    public void visit(SoftLineBreak softLineBreak) {
      if (currentRuns != null) {
        currentRuns.add(new StyledRun(" ", bold, italic, code, linkUrl));
      }
    }

    @Override
    public void visit(HardLineBreak hardLineBreak) {
      if (currentRuns != null) {
        currentRuns.add(new StyledRun("\n", bold, italic, code, linkUrl));
      }
    }

    @Override
    public void visit(FencedCodeBlock fencedCodeBlock) {
      blocks.add(new Block(
          BlockKind.CODE_BLOCK, 0, 0, quoteDepth, null, stripOneTrailingNewline(fencedCodeBlock.getLiteral()), null));
    }

    @Override
    public void visit(IndentedCodeBlock indentedCodeBlock) {
      blocks.add(new Block(
          BlockKind.CODE_BLOCK, 0, 0, quoteDepth, null, stripOneTrailingNewline(indentedCodeBlock.getLiteral()), null));
    }

    @Override
    public void visit(ThematicBreak thematicBreak) {
      blocks.add(new Block(BlockKind.RULE, 0, 0, quoteDepth, null, null, null));
    }

    @Override
    public void visit(BlockQuote blockQuote) {
      quoteDepth++;
      visitChildren(blockQuote);
      quoteDepth--;
    }

    @Override
    public void visit(BulletList bulletList) {
      String marker = bulletList.getMarker() != null && !bulletList.getMarker().isEmpty()
          ? bulletList.getMarker()
          : "-";
      listStack.push(new ListCtx(false, 0, marker));
      visitChildren(bulletList);
      listStack.pop();
    }

    @Override
    public void visit(OrderedList orderedList) {
      int start = orderedList.getMarkerStartNumber() != null ? orderedList.getMarkerStartNumber() : 1;
      String delimiter = orderedList.getMarkerDelimiter() != null ? orderedList.getMarkerDelimiter() : ".";
      listStack.push(new ListCtx(true, start, delimiter));
      visitChildren(orderedList);
      listStack.pop();
    }

    @Override
    public void visit(ListItem listItem) {
      ListCtx ctx = listStack.peek();
      int depth = Math.max(0, listStack.size() - 1);
      boolean first = true;
      Node child = listItem.getFirstChild();
      while (child != null) {
        if (child instanceof Paragraph paragraph) {
          currentRuns = new ArrayList<>();
          visitChildren(paragraph);
          String marker = "";
          if (first) {
            marker = ctx == null ? "-" : (ctx.ordered ? (ctx.counter++) + ctx.delimiter : ctx.delimiter);
          }
          blocks.add(new Block(BlockKind.LIST_ITEM, 0, depth, quoteDepth, marker, null, currentRuns));
          currentRuns = null;
          first = false;
        } else {
          child.accept(this);
        }
        child = child.getNext();
      }
    }
  }

  private static String extractText(Node node) {
    StringBuilder sb = new StringBuilder();
    Node child = node.getFirstChild();
    while (child != null) {
      if (child instanceof Text t) {
        sb.append(t.getLiteral());
      }
      child = child.getNext();
    }
    return sb.toString();
  }

  private static String stripOneTrailingNewline(String s) {
    return s.endsWith("\n") ? s.substring(0, s.length() - 1) : s;
  }

  /**
   * Only http(s)/mailto destinations become a clickable action; anything else (javascript:,
   * data:, relative paths meaningless outside the source document) is dropped rather than
   * embedded, since a generated PDF should never carry an executable or data URI a reader could
   * be tricked into invoking.
   */
  private static String sanitizeUrl(String destination) {
    if (destination == null) {
      return null;
    }
    String trimmed = destination.trim();
    String lower = trimmed.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) {
      return trimmed;
    }
    return null;
  }

  // ==================== Block list -> PDF drawing ====================

  private record ResolvedGlyph(PDFont font, String text, float width, String linkUrl) {}

  private record FontChoice(PDFont font, String text, float rawWidth) {}

  private record GlyphKey(char c, boolean bold, boolean italic, boolean code) {}

  private final class Renderer {
    private final PDDocument document;
    private final PDRectangle pageSize;

    private final PDFont helvetica = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private final PDFont helveticaBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private final PDFont helveticaOblique = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);
    private final PDFont helveticaBoldOblique = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD_OBLIQUE);
    private final PDFont courier = new PDType1Font(Standard14Fonts.FontName.COURIER);
    private final PDFont notoRegular;
    private final PDFont notoBold;
    private final PDFont notoItalic;
    private final PDFont devanagariRegular;
    private final PDFont devanagariBold;

    private final Map<GlyphKey, FontChoice> fontChoiceCache = new HashMap<>();

    private PDPage page;
    private PDPageContentStream stream;
    private float y;
    private int pageCount;
    private boolean atPageTop;

    Renderer(PDDocument document, PDRectangle pageSize) throws IOException {
      this.document = document;
      this.pageSize = pageSize;
      this.notoRegular = PDType0Font.load(document, new ByteArrayInputStream(LATIN_REGULAR));
      this.notoBold = PDType0Font.load(document, new ByteArrayInputStream(LATIN_BOLD));
      this.notoItalic = PDType0Font.load(document, new ByteArrayInputStream(LATIN_ITALIC));
      this.devanagariRegular = PDType0Font.load(document, new ByteArrayInputStream(DEVANAGARI_REGULAR));
      this.devanagariBold = PDType0Font.load(document, new ByteArrayInputStream(DEVANAGARI_BOLD));
      newPage();
    }

    void render(Block block) throws IOException {
      switch (block.kind()) {
        case HEADING -> renderTextLike(block, HEADING_SIZES[block.level() - 1], true, HEADING_GAP_BEFORE);
        case PARAGRAPH -> renderTextLike(block, BODY_SIZE, false, BLOCK_GAP);
        case LIST_ITEM -> renderTextLike(block, BODY_SIZE, false, BLOCK_GAP * 0.6f);
        case CODE_BLOCK -> renderCodeBlock(block);
        case RULE -> renderRule(block);
      }
    }

    void close() throws IOException {
      stream.close();
    }

    private void newPage() throws IOException {
      if (stream != null) {
        stream.close();
      }
      pageCount++;
      if (pageCount > MAX_PAGES) {
        throw new IllegalArgumentException(
            "This document produces more than " + MAX_PAGES + " pages. Please shorten it.");
      }
      page = new PDPage(pageSize);
      document.addPage(page);
      stream = new PDPageContentStream(document, page);
      y = pageSize.getHeight() - MARGIN;
      atPageTop = true;
    }

    private void renderTextLike(Block block, float fontSize, boolean forceBold, float gapBefore) throws IOException {
      List<StyledRun> runs = block.runs();
      if (runs == null || runs.isEmpty()) {
        return;
      }

      float indent = MARGIN + block.quoteDepth() * QUOTE_INDENT + block.indentDepth() * LIST_INDENT;
      float lineWidth = (pageSize.getWidth() - MARGIN) - indent;
      float leading = fontSize * LEADING_RATIO;

      List<ResolvedGlyph> flat = flattenRuns(runs, forceBold, fontSize);
      List<List<ResolvedGlyph>> lines = wrapGlyphs(flat, lineWidth);
      if (lines.isEmpty()) {
        return;
      }

      if (!atPageTop) {
        y -= leading + gapBefore;
      }
      if (y < MARGIN) {
        newPage();
      }
      atPageTop = false;

      boolean first = true;
      for (List<ResolvedGlyph> line : lines) {
        if (!first) {
          y -= leading;
          if (y < MARGIN) {
            newPage();
          }
        }
        if (block.quoteDepth() > 0) {
          drawQuoteBars(block.quoteDepth(), leading);
        }
        if (first && block.marker() != null && !block.marker().isEmpty()) {
          drawMarker(block.marker(), indent, fontSize);
        }
        drawLine(line, indent, y, fontSize);
        first = false;
      }
    }

    private void renderCodeBlock(Block block) throws IOException {
      String literal = block.literalText() == null ? "" : block.literalText();
      float indent = MARGIN + block.quoteDepth() * QUOTE_INDENT;
      float boxWidth = (pageSize.getWidth() - MARGIN) - indent;
      float textLeft = indent + CODE_PAD;
      float lineWidth = boxWidth - 2 * CODE_PAD;
      float leading = CODE_SIZE * LEADING_RATIO;

      List<List<ResolvedGlyph>> lines = new ArrayList<>();
      for (String raw : literal.split("\n", -1)) {
        List<ResolvedGlyph> glyphs = new ArrayList<>(raw.length());
        for (int i = 0; i < raw.length(); i++) {
          FontChoice fc = resolveFontChoice(raw.charAt(i), false, false, true);
          glyphs.add(new ResolvedGlyph(fc.font(), fc.text(), fc.rawWidth() / 1000f * CODE_SIZE, null));
        }
        lines.addAll(wrapGlyphs(glyphs, lineWidth));
      }
      if (lines.isEmpty()) {
        return;
      }

      if (!atPageTop) {
        y -= leading + BLOCK_GAP;
      }
      atPageTop = false;

      int i = 0;
      while (i < lines.size()) {
        if (y - MARGIN < leading + 2 * CODE_PAD) {
          newPage();
        }
        float available = y - MARGIN - 2 * CODE_PAD;
        int count = Math.max(1, Math.min((int) (available / leading), lines.size() - i));
        float boxHeight = count * leading + 2 * CODE_PAD;
        float boxTop = y + CODE_PAD;

        stream.setNonStrokingColor(new Color(244, 244, 241));
        stream.addRect(indent, boxTop - boxHeight, boxWidth, boxHeight);
        stream.fill();

        float lineY = y;
        for (int k = i; k < i + count; k++) {
          drawLine(lines.get(k), textLeft, lineY, CODE_SIZE);
          lineY -= leading;
        }
        y = boxTop - boxHeight;
        i += count;
        if (i < lines.size()) {
          newPage();
        }
      }
    }

    private void renderRule(Block block) throws IOException {
      if (!atPageTop) {
        y -= BODY_SIZE * LEADING_RATIO + BLOCK_GAP;
      }
      if (y - RULE_GAP * 2 < MARGIN) {
        newPage();
      }
      atPageTop = false;
      float indent = MARGIN + block.quoteDepth() * QUOTE_INDENT;
      float ruleY = y - RULE_GAP;
      stream.setStrokingColor(new Color(210, 210, 205));
      stream.setLineWidth(1f);
      stream.moveTo(indent, ruleY);
      stream.lineTo(pageSize.getWidth() - MARGIN, ruleY);
      stream.stroke();
      y -= RULE_GAP * 2;
    }

    private void drawQuoteBars(int quoteDepth, float leading) throws IOException {
      stream.setNonStrokingColor(new Color(206, 206, 199));
      for (int level = 0; level < quoteDepth; level++) {
        float barX = MARGIN + level * QUOTE_INDENT;
        stream.addRect(barX, y - leading * 0.22f, QUOTE_BAR_WIDTH, leading);
      }
      stream.fill();
    }

    private void drawMarker(String marker, float indent, float fontSize) throws IOException {
      float width = helvetica.getStringWidth(marker) / 1000f * fontSize;
      float gutterX = indent - width - 6f;
      stream.setNonStrokingColor(Color.BLACK);
      stream.beginText();
      stream.setFont(helvetica, fontSize);
      stream.setTextMatrix(Matrix.getTranslateInstance(gutterX, y));
      stream.showText(marker);
      stream.endText();
    }

    private void drawLine(List<ResolvedGlyph> line, float xStart, float lineY, float fontSize) throws IOException {
      if (line.isEmpty()) {
        return;
      }
      stream.beginText();
      stream.setTextMatrix(Matrix.getTranslateInstance(xStart, lineY));

      List<float[]> linkUnderlines = new ArrayList<>();
      float x = xStart;
      int i = 0;
      int n = line.size();
      while (i < n) {
        PDFont font = line.get(i).font();
        String linkUrl = line.get(i).linkUrl();
        StringBuilder text = new StringBuilder();
        float runStartX = x;
        int j = i;
        while (j < n && line.get(j).font() == font && Objects.equals(line.get(j).linkUrl(), linkUrl)) {
          text.append(line.get(j).text());
          x += line.get(j).width();
          j++;
        }
        stream.setNonStrokingColor(linkUrl != null ? LINK_COLOR : Color.BLACK);
        stream.setFont(font, fontSize);
        stream.showText(text.toString());
        if (linkUrl != null) {
          addLinkAnnotation(linkUrl, runStartX, lineY, x - runStartX, fontSize);
          linkUnderlines.add(new float[] {runStartX, x - runStartX});
        }
        i = j;
      }
      stream.endText();

      if (!linkUnderlines.isEmpty()) {
        float underlineY = lineY - fontSize * 0.12f;
        stream.setStrokingColor(LINK_COLOR);
        stream.setLineWidth(0.6f);
        for (float[] seg : linkUnderlines) {
          stream.moveTo(seg[0], underlineY);
          stream.lineTo(seg[0] + seg[1], underlineY);
        }
        stream.stroke();
      }
    }

    private void addLinkAnnotation(String url, float x, float lineY, float width, float fontSize) throws IOException {
      PDAnnotationLink link = new PDAnnotationLink();
      PDActionURI action = new PDActionURI();
      action.setURI(url);
      link.setAction(action);
      PDBorderStyleDictionary borderStyle = new PDBorderStyleDictionary();
      borderStyle.setWidth(0);
      link.setBorderStyle(borderStyle);
      float descent = fontSize * 0.22f;
      link.setRectangle(new PDRectangle(x, lineY - descent, width, fontSize + descent));
      page.getAnnotations().add(link);
    }

    /**
     * Flattens a block's styled runs into one resolved-glyph sequence: hard line breaks become a
     * zero-width sentinel (font == null) the wrap pass treats as an unconditional line split.
     */
    private List<ResolvedGlyph> flattenRuns(List<StyledRun> runs, boolean forceBold, float fontSize) throws IOException {
      List<ResolvedGlyph> flat = new ArrayList<>();
      for (StyledRun run : runs) {
        if (run.text().equals("\n")) {
          flat.add(new ResolvedGlyph(null, "", 0f, null));
          continue;
        }
        boolean effectiveBold = forceBold || run.bold();
        String text = run.text();
        for (int i = 0; i < text.length(); i++) {
          char c = text.charAt(i);
          FontChoice fc = resolveFontChoice(c, effectiveBold, run.italic(), run.code());
          flat.add(new ResolvedGlyph(fc.font(), fc.text(), fc.rawWidth() / 1000f * fontSize, run.linkUrl()));
        }
      }
      return flat;
    }

    /**
     * Greedy word-wrap over pre-resolved glyphs (mirrors PdfTextToPdfService's proven token-wrap
     * algorithm, generalized from plain characters to glyphs that already carry a per-character
     * font). A hard-break sentinel (font == null) unconditionally flushes the current line.
     */
    private List<List<ResolvedGlyph>> wrapGlyphs(List<ResolvedGlyph> glyphs, float maxWidth) {
      List<List<ResolvedGlyph>> outputLines = new ArrayList<>();
      List<ResolvedGlyph> currentLine = new ArrayList<>();
      float currentWidth = 0f;
      int n = glyphs.size();
      int i = 0;

      while (i < n) {
        ResolvedGlyph g = glyphs.get(i);
        if (g.font() == null) {
          outputLines.add(currentLine);
          currentLine = new ArrayList<>();
          currentWidth = 0f;
          i++;
          continue;
        }

        boolean isWs = Character.isWhitespace(g.text().charAt(0));
        int j = i;
        float tokenWidth = 0f;
        while (j < n && glyphs.get(j).font() != null
            && Character.isWhitespace(glyphs.get(j).text().charAt(0)) == isWs) {
          tokenWidth += glyphs.get(j).width();
          j++;
        }

        if (tokenWidth > maxWidth) {
          if (!currentLine.isEmpty()) {
            outputLines.add(currentLine);
            currentLine = new ArrayList<>();
            currentWidth = 0f;
          }
          List<ResolvedGlyph> chunk = new ArrayList<>();
          float chunkWidth = 0f;
          for (int k = i; k < j; k++) {
            ResolvedGlyph gk = glyphs.get(k);
            if (chunkWidth + gk.width() > maxWidth && !chunk.isEmpty()) {
              outputLines.add(chunk);
              chunk = new ArrayList<>();
              chunkWidth = 0f;
            }
            chunk.add(gk);
            chunkWidth += gk.width();
          }
          currentLine = chunk;
          currentWidth = chunkWidth;
        } else {
          if (currentWidth + tokenWidth > maxWidth) {
            outputLines.add(currentLine);
            currentLine = new ArrayList<>();
            currentWidth = 0f;
          }
          for (int k = i; k < j; k++) {
            currentLine.add(glyphs.get(k));
          }
          currentWidth += tokenWidth;
        }
        i = j;
      }
      outputLines.add(currentLine);
      return outputLines;
    }

    private FontChoice resolveFontChoice(char c, boolean bold, boolean italic, boolean code) throws IOException {
      GlyphKey key = new GlyphKey(c, bold, italic, code);
      FontChoice cached = fontChoiceCache.get(key);
      if (cached != null) {
        return cached;
      }
      FontChoice resolved = doResolveFontChoice(c, bold, italic, code);
      fontChoiceCache.put(key, resolved);
      return resolved;
    }

    private FontChoice doResolveFontChoice(char c, boolean bold, boolean italic, boolean code) throws IOException {
      String s = String.valueOf(c);
      if (code) {
        FontChoice viaCourier = tryMeasure(courier, s);
        if (viaCourier != null) {
          return viaCourier;
        }
        FontChoice viaNoto = tryMeasure(notoRegular, s);
        return viaNoto != null ? viaNoto : forceMeasure(courier, "?");
      }
      if (c >= DEVANAGARI_BLOCK_START && c <= DEVANAGARI_BLOCK_END) {
        PDFont devFont = bold ? devanagariBold : devanagariRegular;
        FontChoice viaDev = tryMeasure(devFont, s);
        return viaDev != null ? viaDev : forceMeasure(courier, "?");
      }
      PDFont helveticaVariant = selectHelvetica(bold, italic);
      FontChoice viaHelvetica = tryMeasure(helveticaVariant, s);
      if (viaHelvetica != null) {
        return viaHelvetica;
      }
      PDFont notoVariant = selectNoto(bold, italic);
      FontChoice viaNoto = tryMeasure(notoVariant, s);
      return viaNoto != null ? viaNoto : forceMeasure(courier, "?");
    }

    private PDFont selectHelvetica(boolean bold, boolean italic) {
      if (bold && italic) {
        return helveticaBoldOblique;
      }
      if (bold) {
        return helveticaBold;
      }
      if (italic) {
        return helveticaOblique;
      }
      return helvetica;
    }

    private PDFont selectNoto(boolean bold, boolean italic) {
      if (bold) {
        return notoBold;
      }
      if (italic) {
        return notoItalic;
      }
      return notoRegular;
    }

    private FontChoice tryMeasure(PDFont font, String s) throws IOException {
      try {
        return new FontChoice(font, s, font.getStringWidth(s));
      } catch (IllegalArgumentException e) {
        return null;
      }
    }

    private FontChoice forceMeasure(PDFont font, String s) throws IOException {
      return new FontChoice(font, s, font.getStringWidth(s));
    }
  }
}
