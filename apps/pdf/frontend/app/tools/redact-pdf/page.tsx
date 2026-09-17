"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, X, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";
import { renderAllPageThumbnails, renderSinglePage, RenderedPage } from "@/lib/pdfPageRenderer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";
const MAIN_RENDER_WIDTH = 640;

type Rect = { xPct: number; yPct: number; widthPct: number; heightPct: number };

export default function RedactPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [thumbnails, setThumbnails] = useState<RenderedPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [mainPage, setMainPage] = useState<RenderedPage | null>(null);

  const [rectsByPage, setRectsByPage] = useState<Record<number, Rect[]>>({});
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const selectFile = async (picked: File) => {
    setError(null);
    setDone(false);
    setLoadingPages(true);
    try {
      const pages = await renderAllPageThumbnails(picked);
      setThumbnails(pages);
      setFile(picked);
      setActivePageIndex(0);
      setRectsByPage({});
    } catch {
      setError("Could not read this PDF. It may be corrupted or password-protected.");
    } finally {
      setLoadingPages(false);
    }
  };

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    renderSinglePage(file, activePageIndex, MAIN_RENDER_WIDTH)
      .then(page => {
        if (!cancelled) setMainPage(page);
      })
      .catch(() => {
        if (!cancelled) setError("Could not render this page.");
      });
    return () => {
      cancelled = true;
    };
  }, [file, activePageIndex]);

  const clearFile = () => {
    setFile(null);
    setThumbnails([]);
    setMainPage(null);
    setRectsByPage({});
    setError(null);
    setDone(false);
  };

  const relativePos = (e: ReactMouseEvent) => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onCanvasMouseDown = (e: ReactMouseEvent) => {
    const pos = relativePos(e);
    drawStart.current = pos;
    setDraft({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
  };
  const onCanvasMouseMove = (e: ReactMouseEvent) => {
    if (!drawStart.current) return;
    const pos = relativePos(e);
    setDraft({ x0: drawStart.current.x, y0: drawStart.current.y, x1: pos.x, y1: pos.y });
  };
  const onCanvasMouseUp = () => {
    if (!drawStart.current || !draft || !mainPage) {
      drawStart.current = null;
      setDraft(null);
      return;
    }
    const x0 = Math.min(draft.x0, draft.x1);
    const y0 = Math.min(draft.y0, draft.y1);
    const w = Math.abs(draft.x1 - draft.x0);
    const h = Math.abs(draft.y1 - draft.y0);
    drawStart.current = null;
    setDraft(null);

    if (w < 8 || h < 8) return;

    const rect: Rect = {
      xPct: x0 / mainPage.renderWidth,
      yPct: y0 / mainPage.renderHeight,
      widthPct: w / mainPage.renderWidth,
      heightPct: h / mainPage.renderHeight
    };
    setRectsByPage(prev => ({
      ...prev,
      [activePageIndex]: [...(prev[activePageIndex] || []), rect]
    }));
  };

  const removeRect = (pageIndex: number, index: number) => {
    setRectsByPage(prev => ({
      ...prev,
      [pageIndex]: prev[pageIndex].filter((_, i) => i !== index)
    }));
  };

  const totalRects = Object.values(rectsByPage).reduce((sum, list) => sum + list.length, 0);
  const activeRects = rectsByPage[activePageIndex] || [];

  const submit = async () => {
    if (!file || totalRects === 0) return;

    setProcessing(true);
    setError(null);
    setDone(false);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const redactions = Object.entries(rectsByPage).flatMap(([pageIndex, rects]) =>
        rects.map(r => ({ pageIndex: Number(pageIndex), ...r }))
      );

      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("redactions", JSON.stringify(redactions));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/redact`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Redacting failed (HTTP ${response.status}).`;
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
      anchor.download = "redacted.pdf";
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
    setMainPage(null);
    setRectsByPage({});
    setDone(false);
    setProcessing(false);
    setError(null);
    setDownloadUrl(null);
  };

  return (
    <main className="tool-page">
      <SiteHeader />

      <section className="tool-hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> All tools
        </Link>
        <div className="eyebrow">PDF TOOL</div>
        <h1>Redact PDF</h1>
        <p>
          Draw boxes over text or images to remove them for good — the underlying content is deleted, not just
          painted over. Works on standard PDFs; content grouped by complex design-tool layouts may need manual
          review.
        </p>
      </section>

      <section className="workspace">
        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!file && !loadingPages && !done && (
          <SinglePdfInput file={null} onSelect={selectFile} onClear={clearFile} onError={setError} />
        )}

        {loadingPages && (
          <div className="upload-zone">
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>Reading your PDF…</h2>
            <p>Rendering page previews in your browser.</p>
          </div>
        )}

        {file && thumbnails.length > 0 && !done && (
          <div className="file-panel">
            <div className="toolbar-row">
              <div>
                <h2>Pages</h2>
                <p style={{ margin: "4px 0 0", color: "var(--text-faint)", fontSize: 13 }}>
                  {totalRects} area{totalRects !== 1 ? "s" : ""} marked across {thumbnails.length} page
                  {thumbnails.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="page-grid" style={{ marginBottom: 26 }}>
              {thumbnails.map(page => (
                <div
                  key={page.pageIndex}
                  className={`page-thumb selectable ${page.pageIndex === activePageIndex ? "selected" : ""}`}
                  onClick={() => setActivePageIndex(page.pageIndex)}
                >
                  <div className="thumb-canvas-wrap">
                    <img src={page.dataUrl} alt={`Page ${page.pageIndex + 1}`} draggable={false} />
                  </div>
                  <span className="page-num">
                    Page {page.pageIndex + 1}
                    {(rectsByPage[page.pageIndex] || []).length > 0
                      ? ` · ${rectsByPage[page.pageIndex].length} marked`
                      : ""}
                  </span>
                </div>
              ))}
            </div>

            {mainPage && (
              <>
                <h2 style={{ marginBottom: 14 }}>Draw over what to remove</h2>
                <div
                  ref={canvasWrapRef}
                  className="page-canvas-wrap"
                  style={{ width: mainPage.renderWidth, height: mainPage.renderHeight, cursor: "crosshair" }}
                  onMouseDown={onCanvasMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onMouseLeave={onCanvasMouseUp}
                >
                  <img src={mainPage.dataUrl} alt={`Page ${activePageIndex + 1} preview`} draggable={false} />

                  {activeRects.map((r, i) => (
                    <div
                      key={i}
                      className="redact-box"
                      style={{
                        left: r.xPct * mainPage.renderWidth,
                        top: r.yPct * mainPage.renderHeight,
                        width: r.widthPct * mainPage.renderWidth,
                        height: r.heightPct * mainPage.renderHeight
                      }}
                    >
                      <button
                        type="button"
                        className="remove-box"
                        onClick={e => {
                          e.stopPropagation();
                          removeRect(activePageIndex, i);
                        }}
                        aria-label="Remove this redaction"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {draft && (
                    <div
                      className="redact-draft"
                      style={{
                        left: Math.min(draft.x0, draft.x1),
                        top: Math.min(draft.y0, draft.y1),
                        width: Math.abs(draft.x1 - draft.x0),
                        height: Math.abs(draft.y1 - draft.y0)
                      }}
                    />
                  )}
                </div>

                <button
                  type="button"
                  className="primary-btn wide"
                  disabled={processing || totalRects === 0}
                  onClick={submit}
                  style={{ marginTop: 18 }}
                >
                  {processing
                    ? "Redacting…"
                    : `Redact PDF${totalRects > 0 ? ` (${totalRects} area${totalRects !== 1 ? "s" : ""})` : ""}`}
                </button>
              </>
            )}
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is redacted</h2>
            <p>The marked areas were permanently removed. Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="redacted.pdf">
                <Download size={18} /> Download redacted.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Redact another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
