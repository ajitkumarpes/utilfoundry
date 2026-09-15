"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type Level = "LOW" | "MEDIUM" | "HIGH";

const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "LOW", label: "Low compression", hint: "Best quality, smaller size cut" },
  { id: "MEDIUM", label: "Medium compression", hint: "Balanced — recommended" },
  { id: "HIGH", label: "High compression", hint: "Smallest file, lower image quality" }
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<Level>("MEDIUM");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

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
    if (!file) {
      setError("Select a PDF file first.");
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
      formData.append("level", level);

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/compress`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let message = `Compression failed (HTTP ${response.status}).`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = await response.json();
            message = body.error || body.message || message;
          } catch {}
        }
        throw new Error(message);
      }

      const original = Number(response.headers.get("X-Original-Size") || file.size);
      const compressed = Number(response.headers.get("X-Compressed-Size") || 0);

      const blob = await response.blob();
      if (!blob.size) throw new Error("The server returned an empty PDF.");

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setOriginalSize(original);
      setCompressedSize(compressed || blob.size);
      setDone(true);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "compressed.pdf";
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

  const reduction = originalSize > 0 ? Math.max(0, Math.round((1 - compressedSize / originalSize) * 100)) : 0;

  return (
    <main className="tool-page">
      <SiteHeader />

      <section className="tool-hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> All tools
        </Link>
        <div className="eyebrow">PDF TOOL</div>
        <h1>Compress PDF</h1>
        <p>Shrink image-heavy PDFs — scans, photos, reports — while keeping them readable.</p>
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
                <h2>Compression level</h2>
                <p>Higher compression reduces image quality inside the PDF.</p>
              </div>
            </div>

            <div className="option-grid">
              {LEVELS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`option-card ${level === opt.id ? "selected" : ""}`}
                  onClick={() => setLevel(opt.id)}
                  disabled={processing}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.hint}</span>
                </button>
              ))}
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              {processing ? "Compressing…" : "Compress PDF"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is ready</h2>
            <p>Compressed with the {level.toLowerCase()} setting. Your download should start automatically.</p>

            <div className="meta-row">
              <div>
                <strong>{formatSize(originalSize)}</strong>
                <span>Original</span>
              </div>
              <div>
                <strong>{formatSize(compressedSize)}</strong>
                <span>Compressed</span>
              </div>
              <div className="down">
                <strong>{reduction > 0 ? `-${reduction}%` : "—"}</strong>
                <span>Reduced by</span>
              </div>
            </div>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="compressed.pdf">
                <Download size={18} /> Download compressed.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Compress another
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
