"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type Position = "center" | "diagonal";

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [position, setPosition] = useState<Position>("diagonal");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const selectFile = (picked: File) => {
    setError(null);
    setDone(false);
    setFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setDone(false);
  };

  const submit = async () => {
    if (!file) return;
    if (!text.trim()) {
      setError("Enter the watermark text first.");
      return;
    }

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
      formData.append("text", text.trim());
      formData.append("position", position);

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/watermark`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Watermarking failed (HTTP ${response.status}).`;
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
      anchor.download = "watermarked.pdf";
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
        <h1>Add Watermark</h1>
        <p>Stamp text like &quot;CONFIDENTIAL&quot; or a company name across every page.</p>
      </section>

      <section className="workspace">
        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!done && (
          <SinglePdfInput file={file} onSelect={selectFile} onClear={clearFile} onError={setError} disabled={processing} />
        )}

        {file && !done && (
          <div className="file-panel" style={{ marginTop: 14 }}>
            <div className="panel-header">
              <div>
                <h2>Watermark text</h2>
              </div>
            </div>

            <div className="field">
              <label htmlFor="watermark-text">Text</label>
              <input
                id="watermark-text"
                className="text-input"
                value={text}
                maxLength={80}
                placeholder="e.g. CONFIDENTIAL"
                onChange={e => setText(e.target.value)}
                disabled={processing}
              />
              <p className="hint">Up to 80 characters, applied to every page.</p>
            </div>

            <div className="option-grid">
              <button
                type="button"
                className={`option-card ${position === "diagonal" ? "selected" : ""}`}
                onClick={() => setPosition("diagonal")}
                disabled={processing}
              >
                <strong>Diagonal</strong>
                <span>Classic watermark look</span>
              </button>
              <button
                type="button"
                className={`option-card ${position === "center" ? "selected" : ""}`}
                onClick={() => setPosition("center")}
                disabled={processing}
              >
                <strong>Centered</strong>
                <span>Straight, horizontal text</span>
              </button>
            </div>

            <button type="button" className="primary-btn wide" disabled={processing || !text.trim()} onClick={submit}>
              {processing ? "Adding watermark…" : "Add Watermark"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is ready</h2>
            <p>The watermark was added to every page. Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="watermarked.pdf">
                <Download size={18} /> Download watermarked.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Watermark another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
