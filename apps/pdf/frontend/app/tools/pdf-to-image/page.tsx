"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type Format = "jpg" | "png";

const DPI_OPTIONS = [
  { value: 96, label: "Screen" },
  { value: 150, label: "Standard" },
  { value: 300, label: "Print" }
];

function parseFilename(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = header.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

export default function PdfToImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>("jpg");
  const [dpi, setDpi] = useState(150);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState("images.zip");
  const [resultIsZip, setResultIsZip] = useState(false);

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
      formData.append("format", format);
      formData.append("dpi", String(dpi));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/pdf-to-images`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let message = `Conversion failed (HTTP ${response.status}).`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = await response.json();
            message = body.error || body.message || message;
          } catch {}
        }
        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") || "";
      const isZip = contentType.includes("zip");
      const filename = parseFilename(
        response.headers.get("content-disposition"),
        isZip ? "pdf-images.zip" : `page-1.${format}`
      );

      const blob = await response.blob();
      if (!blob.size) throw new Error("The server returned an empty file.");

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setResultFilename(filename);
      setResultIsZip(isZip);
      setDone(true);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
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
        <h1>PDF to Image</h1>
        <p>Convert each page of a PDF into a JPG or PNG image.</p>
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
                <h2>Output format</h2>
              </div>
            </div>

            <div className="option-grid">
              {(["jpg", "png"] as Format[]).map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`option-card ${format === opt ? "selected" : ""}`}
                  onClick={() => setFormat(opt)}
                  disabled={processing}
                >
                  <strong>{opt.toUpperCase()}</strong>
                  <span>{opt === "jpg" ? "Smaller files, photos" : "Sharper edges, text/graphics"}</span>
                </button>
              ))}
            </div>

            <div className="field">
              <label>Quality</label>
              <div className="segmented">
                {DPI_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={dpi === opt.value ? "active" : ""}
                    onClick={() => setDpi(opt.value)}
                    disabled={processing}
                  >
                    {opt.label} ({opt.value} DPI)
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              {processing ? "Converting…" : "Convert to Images"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your images are ready</h2>
            <p>
              {resultIsZip
                ? "Every page was converted and packed into a ZIP. Your download should start automatically."
                : "Your page was converted to an image. Your download should start automatically."}
            </p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download={resultFilename}>
                <Download size={18} /> Download {resultFilename}
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Convert another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
