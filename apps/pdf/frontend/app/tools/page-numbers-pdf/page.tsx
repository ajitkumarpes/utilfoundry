"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type Position = "bottom-center" | "bottom-right" | "top-right";

const POSITIONS: { id: Position; label: string }[] = [
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "top-right", label: "Top right" }
];

export default function PageNumbersPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [startAt, setStartAt] = useState("1");
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
      formData.append("position", position);
      formData.append("startAt", String(Math.max(0, parseInt(startAt, 10) || 1)));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/page-numbers`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Adding page numbers failed (HTTP ${response.status}).`;
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
      anchor.download = "numbered.pdf";
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
        <h1>Add Page Numbers</h1>
        <p>Number every page automatically — pick where the numbers go and where counting starts.</p>
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
                <h2>Position</h2>
              </div>
            </div>

            <div className="option-grid">
              {POSITIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`option-card ${position === opt.id ? "selected" : ""}`}
                  onClick={() => setPosition(opt.id)}
                  disabled={processing}
                >
                  <strong>{opt.label}</strong>
                </button>
              ))}
            </div>

            <div className="field">
              <label htmlFor="page-numbers-start">Start numbering at</label>
              <input
                id="page-numbers-start"
                className="text-input"
                type="number"
                min={0}
                value={startAt}
                onChange={e => setStartAt(e.target.value)}
                disabled={processing}
                style={{ maxWidth: 120 }}
              />
              <p className="hint">Useful if page 1 of the PDF is a cover page that should not count.</p>
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              {processing ? "Adding page numbers…" : "Add Page Numbers"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is ready</h2>
            <p>Page numbers were added to every page. Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="numbered.pdf">
                <Download size={18} /> Download numbered.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Number another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
