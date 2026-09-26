"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";
import EditPdfEditor, { EditPdfEditorHandle } from "@/components/EditPdfEditor";
import { renderAllPageThumbnails, RenderedPage } from "@/lib/pdfPageRenderer";
import { EditElement } from "@/lib/editPdfTypes";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

/**
 * The wire shape sent to POST /api/v1/pdf/edit — every EditElement field except the
 * client-only `id`. Listed explicitly (rather than destructuring `id` out) so adding a new
 * client-only field to EditElement later can't silently leak into the request body by default;
 * a field has to be added here on purpose.
 *
 * The opposite mistake is just as real, and already happened once while building this: a field
 * added to EditElement (rotationDeg, then opacity) with nobody remembering to add it here too,
 * so the value looked right in the editor's own preview the whole time and simply never reached
 * the PDF. The dev-only check below catches that class of bug the moment it's exercised, rather
 * than requiring someone to notice a missing property in a downloaded file.
 */
function elementForApi(el: EditElement) {
  const wire = {
    kind: el.kind,
    pageIndex: el.pageIndex,
    xPct: el.xPct,
    yPct: el.yPct,
    widthPct: el.widthPct,
    heightPct: el.heightPct,
    rotationDeg: el.rotationDeg,
    opacity: el.opacity,
    text: el.text,
    fontSize: el.fontSize,
    color: el.color,
    imageRef: el.imageRef,
    shapeKind: el.shapeKind,
    strokeWidth: el.strokeWidth,
    filled: el.filled,
    flipped: el.flipped,
    url: el.url,
    fieldKind: el.fieldKind,
    fieldName: el.fieldName,
    multiline: el.multiline,
    optionValue: el.optionValue,
    checked: el.checked,
    options: el.options,
    points: el.points
  };
  if (process.env.NODE_ENV !== "production") {
    const missing = Object.keys(el).filter(key => key !== "id" && !(key in wire));
    if (missing.length > 0) {
      throw new Error(`elementForApi is missing field(s) present on EditElement: ${missing.join(", ")}`);
    }
  }
  return wire;
}

export default function EditPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [thumbnails, setThumbnails] = useState<RenderedPage[]>([]);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const editorHandle = useRef<EditPdfEditorHandle | null>(null);

  const selectFile = async (picked: File) => {
    setError(null);
    setDone(false);
    setLoadingPages(true);
    try {
      const pages = await renderAllPageThumbnails(picked);
      setThumbnails(pages);
      setFile(picked);
    } catch {
      setError("Could not read this PDF. It may be corrupted or password-protected.");
    } finally {
      setLoadingPages(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setThumbnails([]);
    setError(null);
    setDone(false);
  };

  const submit = async () => {
    if (!file || !editorHandle.current) return;
    const elements = editorHandle.current.getElements();
    if (elements.length === 0) {
      setError("Add at least one element before applying changes.");
      return;
    }
    const invalidLink = elements.find(el => el.kind === "LINK" && !/^https?:\/\/|^mailto:/i.test(el.url || ""));
    if (invalidLink) {
      setError("Every link needs a URL starting with https:// (or mailto:) before you can apply changes.");
      return;
    }
    const images = editorHandle.current.getImages();

    setProcessing(true);
    setError(null);
    setDone(false);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      images.forEach((img, i) => formData.append("images", img.file, `image-${i}.png`));
      formData.append("elements", JSON.stringify(elements.map(elementForApi)));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/edit`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Applying changes failed (HTTP ${response.status}).`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = await response.json();
            message = body.error || body.message || message;
          } catch {}
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error("The server returned an empty PDF.");

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDone(true);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "edited.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setThumbnails([]);
    setDone(false);
    setProcessing(false);
    setError(null);
    setDownloadUrl(null);
  };

  // The active editor takes over the full viewport below the header - there is no good way to
  // fit a multi-page canvas, a page rail and per-element controls into the site's usual 900px
  // centered `.workspace`. Every other state (upload, error-before-upload, result) stays in that
  // normal layout, same as every other tool.
  const editing = Boolean(file) && thumbnails.length > 0 && !done;

  return (
    <main className="tool-page">
      <SiteHeader />

      {editing && file ? (
        <>
          {error && (
            <div className="error-box" style={{ margin: "10px 16px 0" }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <EditPdfEditor ref={editorHandle} file={file} thumbnails={thumbnails} onApply={submit} applying={processing} />
        </>
      ) : (
        <>
          <section className="tool-hero">
            <Link href="/" className="back-link">
              <ArrowLeft size={16} /> All tools
            </Link>
            <div className="eyebrow">PDF TOOL</div>
            <h1>Edit PDF</h1>
            <p>
              Add text, images, shapes, links and form fields anywhere on the page, cover content with a whiteout, sign
              or draw freehand — then apply every change in one pass.
            </p>
          </section>

          <section className="workspace">
            {error && (
              <div className="error-box">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {!file && !loadingPages && !done && <SinglePdfInput file={null} onSelect={selectFile} onClear={clearFile} onError={setError} />}

            {loadingPages && (
              <div className="upload-zone">
                <div className="upload-icon">
                  <Loader2 size={30} className="spin" />
                </div>
                <h2>Reading your PDF…</h2>
                <p>Rendering page previews in your browser.</p>
              </div>
            )}

            {done && (
              <div className="result-panel">
                <div className="success-icon">
                  <CheckCircle2 size={38} />
                </div>
                <h2>Your PDF is edited</h2>
                <p>Your download should start automatically.</p>

                {downloadUrl && (
                  <a className="primary-btn" href={downloadUrl} download="edited.pdf">
                    <Download size={18} /> Download edited.pdf
                  </a>
                )}

                <button type="button" className="secondary-btn" onClick={reset}>
                  <XCircle size={17} /> Edit another PDF
                </button>
              </div>
            )}
          </section>
          <SiteFooter />
        </>
      )}
    </main>
  );
}
