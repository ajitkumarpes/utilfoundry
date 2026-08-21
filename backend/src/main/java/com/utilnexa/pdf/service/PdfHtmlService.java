package com.utilnexa.pdf.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.util.function.BiPredicate;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.jsoup.helper.W3CDom;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;

import com.openhtmltopdf.extend.FSStream;
import com.openhtmltopdf.extend.FSStreamFactory;
import com.openhtmltopdf.extend.FSUriResolver;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.PageSizeUnits;
import com.openhtmltopdf.outputdevice.helper.ExternalResourceControlPriority;
import com.openhtmltopdf.outputdevice.helper.ExternalResourceType;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

/**
 * Renders untrusted, user-supplied HTML to PDF. Every external-resource-loading hook openhtmltopdf
 * exposes is wired to a strict allowlist (data: URIs only) as three independent layers, not one:
 * {@link #ACCESS_CONTROL} (checked before URI resolution even happens, covering every
 * {@link ExternalResourceType} — fonts, CSS, images alike), {@link #STRICT_RESOLVER} (rejects
 * anything the access check didn't already reject), and {@link #DENY_STREAM_FACTORY} (refuses to
 * actually open a connection for http/https/ftp/file regardless of how a URI reached that point).
 * This defense-in-depth is deliberate: a documented openhtmltopdf issue
 * (github.com/danfickle/openhtmltopdf/issues/444) describes a resource-loading path that bypassed
 * the configured resolver, so no single layer is trusted alone. Verified against a real controlled
 * listener before shipping — see PdfHtmlServiceSsrfTest.
 */
@Service
public class PdfHtmlService {

  private static final int MAX_HTML_LENGTH = 500_000;
  private static final int MAX_PAGES = 500;
  private static final String BASE_URI = "about:blank";

  private static final BiPredicate<String, ExternalResourceType> ACCESS_CONTROL =
      (uri, type) -> isDataUri(uri);

  private static final FSUriResolver STRICT_RESOLVER =
      (baseUri, uri) -> isDataUri(uri) ? uri : null;

  private static final FSStreamFactory DENY_STREAM_FACTORY = url -> new FSStream() {
    @Override
    public InputStream getStream() {
      return null;
    }

    @Override
    public Reader getReader() {
      return null;
    }
  };

  public byte[] convert(String html, String pageSizeParam) throws IOException {
    if (html == null || html.isBlank()) {
      throw new IllegalArgumentException("HTML is required.");
    }
    if (html.length() > MAX_HTML_LENGTH) {
      throw new IllegalArgumentException("HTML must be " + MAX_HTML_LENGTH + " characters or fewer.");
    }
    float[] pageSizeMm = resolvePageSizeMm(pageSizeParam);

    org.jsoup.nodes.Document jsoupDoc = org.jsoup.Jsoup.parse(html, BASE_URI);
    Document w3cDoc = W3CDom.convert(jsoupDoc);

    ByteArrayOutputStream output = new ByteArrayOutputStream();
    try {
      PdfRendererBuilder builder = new PdfRendererBuilder();
      builder.useFastMode();
      builder.withW3cDocument(w3cDoc, BASE_URI);
      builder.useDefaultPageSize(pageSizeMm[0], pageSizeMm[1], PageSizeUnits.MM);
      builder.useExternalResourceAccessControl(ACCESS_CONTROL, ExternalResourceControlPriority.RUN_BEFORE_RESOLVING_URI);
      builder.useUriResolver(STRICT_RESOLVER);
      builder.useProtocolsStreamImplementation(DENY_STREAM_FACTORY, "http", "https", "ftp", "file");
      builder.toStream(output);
      builder.run();
    } catch (IOException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalArgumentException("This HTML could not be rendered: " + e.getMessage());
    }

    byte[] result = output.toByteArray();
    if (result.length == 0) {
      throw new IOException("PDF generation produced an empty document.");
    }
    enforcePageLimit(result);
    return result;
  }

  private void enforcePageLimit(byte[] pdf) throws IOException {
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      if (doc.getNumberOfPages() > MAX_PAGES) {
        throw new IllegalArgumentException(
            "This HTML produces more than " + MAX_PAGES + " pages. Please shorten it.");
      }
    }
  }

  private static boolean isDataUri(String uri) {
    return uri != null && uri.trim().toLowerCase().startsWith("data:");
  }

  private float[] resolvePageSizeMm(String pageSize) {
    if (pageSize == null || pageSize.isBlank()) {
      return new float[] {210f, 297f};
    }
    return switch (pageSize.trim().toUpperCase()) {
      case "A4" -> new float[] {210f, 297f};
      case "LETTER" -> new float[] {215.9f, 279.4f};
      default -> throw new IllegalArgumentException("pageSize must be A4 or LETTER.");
    };
  }
}
