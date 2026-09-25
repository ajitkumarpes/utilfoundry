"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ChangeEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";
import { renderAllPageThumbnails, renderSinglePage, RenderedPage } from "@/lib/pdfPageRenderer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";
const MAIN_RENDER_WIDTH = 640;

type SignatureSource = "draw" | "upload";
type Placement = { xPct: number; yPct: number; widthPct: number };

export default function SignPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [thumbnails, setThumbnails] = useState<RenderedPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [mainPage, setMainPage] = useState<RenderedPage | null>(null);

  const [signatureSource, setSignatureSource] = useState<SignatureSource>("draw");
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const [placement, setPlacement] = useState<Placement>({ xPct: 0.35, yPct: 0.75, widthPct: 0.3 });
  const dragState = useRef<{ startX: number; startY: number; startXPct: number; startYPct: number } | null>(null);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const selectFile = async (picked: File) => {
    setError(null);
    setDone(false);
    setLoadingPages(true);
    try {
      const pages = await renderAllPageThumbnails(picked);
      setThumbnails(pages);
      setFile(picked);
      setActivePageIndex(0);
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
    setError(null);
    setDone(false);
  };

  const padPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const rect = canvas?.getBoundingClientRect();
    if (ctx && rect) {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };
  const padPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const rect = canvas?.getBoundingClientRect();
    if (ctx && rect) {
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#171717";
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };
  const padPointerUp = () => {
    drawing.current = false;
  };
  const clearPad = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureBlob(null);
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    setSignatureUrl(null);
  };
  const useDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      setSignatureBlob(blob);
      if (signatureUrl) URL.revokeObjectURL(signatureUrl);
      setSignatureUrl(URL.createObjectURL(blob));
    }, "image/png");
  };

  const onUploadSignature = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("Select a PNG or JPEG image for your signature.");
      return;
    }
    setSignatureBlob(picked);
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    setSignatureUrl(URL.createObjectURL(picked));
  };

  const switchSource = (source: SignatureSource) => {
    setSignatureSource(source);
    setSignatureBlob(null);
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    setSignatureUrl(null);
  };

  const onSigPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, startXPct: placement.xPct, startYPct: placement.yPct };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSigPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || !mainPage) return;
    const nextXPct = drag.startXPct + (e.clientX - drag.startX) / mainPage.renderWidth;
    const nextYPct = drag.startYPct + (e.clientY - drag.startY) / mainPage.renderHeight;
    setPlacement(p => ({
      ...p,
      xPct: Math.min(1 - p.widthPct, Math.max(0, nextXPct)),
      yPct: Math.min(1, Math.max(0, nextYPct))
    }));
  };
  const onSigPointerUp = () => {
    dragState.current = null;
  };

  const submit = async () => {
    if (!file || !signatureBlob) return;

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
      formData.append("signatureImage", signatureBlob, "signature.png");
      formData.append(
        "placement",
        JSON.stringify({
          pageIndex: activePageIndex,
          xPct: placement.xPct,
          yPct: placement.yPct,
          widthPct: placement.widthPct
        })
      );

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/sign`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Signing failed (HTTP ${response.status}).`;
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
      anchor.download = "signed.pdf";
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
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    setFile(null);
    setThumbnails([]);
    setMainPage(null);
    setSignatureBlob(null);
    setSignatureUrl(null);
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
        <h1>Sign PDF</h1>
        <p>Draw or upload a signature and drag it onto the page. This places a visual signature stamp — it is not a certified digital signature.</p>
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
                <h2>1. Choose a page</h2>
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
                  <span className="page-num">Page {page.pageIndex + 1}</span>
                </div>
              ))}
            </div>

            <h2 style={{ marginBottom: 14 }}>2. Create your signature</h2>
            <div className="segmented" style={{ marginBottom: 14 }}>
              <button type="button" className={signatureSource === "draw" ? "active" : ""} onClick={() => switchSource("draw")}>
                Draw
              </button>
              <button type="button" className={signatureSource === "upload" ? "active" : ""} onClick={() => switchSource("upload")}>
                Upload image
              </button>
            </div>

            {signatureSource === "draw" && (
              <div style={{ marginBottom: 26 }}>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={140}
                  className="sig-pad"
                  onPointerDown={padPointerDown}
                  onPointerMove={padPointerMove}
                  onPointerUp={padPointerUp}
                  onPointerLeave={padPointerUp}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" className="secondary-btn" onClick={clearPad}>
                    Clear
                  </button>
                  <button type="button" className="secondary-btn" onClick={useDrawnSignature}>
                    Use this signature
                  </button>
                </div>
              </div>
            )}

            {signatureSource === "upload" && (
              <div style={{ marginBottom: 26 }}>
                <label className="secondary-btn" style={{ display: "inline-flex", cursor: "pointer" }}>
                  Choose signature image
                  <input type="file" accept="image/png,image/jpeg" onChange={onUploadSignature} style={{ display: "none" }} />
                </label>
              </div>
            )}

            {signatureUrl && mainPage && (
              <>
                <h2 style={{ marginBottom: 14 }}>3. Drag to place it</h2>
                <div className="page-canvas-wrap" style={{ width: mainPage.renderWidth, height: mainPage.renderHeight }}>
                  <img src={mainPage.dataUrl} alt={`Page ${activePageIndex + 1} preview`} draggable={false} />
                  <div
                    className="sig-overlay"
                    style={{
                      left: placement.xPct * mainPage.renderWidth,
                      top: placement.yPct * mainPage.renderHeight,
                      width: placement.widthPct * mainPage.renderWidth,
                      height: (placement.widthPct * mainPage.renderWidth) / 2
                    }}
                    onPointerDown={onSigPointerDown}
                    onPointerMove={onSigPointerMove}
                    onPointerUp={onSigPointerUp}
                  >
                    <img src={signatureUrl} alt="Your signature" />
                  </div>
                </div>

                <div className="field" style={{ maxWidth: 320, marginTop: 18 }}>
                  <label htmlFor="signature-size">Signature size</label>
                  <input
                id="signature-size"
                    type="range"
                    min={0.1}
                    max={0.6}
                    step={0.02}
                    value={placement.widthPct}
                    onChange={e => setPlacement(p => ({ ...p, widthPct: parseFloat(e.target.value) }))}
                  />
                </div>

                <button
                  type="button"
                  className="primary-btn wide"
                  disabled={processing}
                  onClick={submit}
                  style={{ marginTop: 18 }}
                >
                  {processing ? "Signing…" : "Sign PDF"}
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
            <h2>Your PDF is signed</h2>
            <p>The signature was placed on page {activePageIndex + 1}. Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="signed.pdf">
                <Download size={18} /> Download signed.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Sign another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
