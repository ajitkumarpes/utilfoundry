"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type Mode = "ALL" | "RANGES" | "ODD" | "EVEN";

function parseFilename(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = header.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("ALL");
  const [ranges, setRanges] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState("split.pdf");
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
    if (mode === "RANGES" && !ranges.trim()) {
      setError("Enter at least one page range, e.g. 1-3,5,8-10.");
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
      formData.append("mode", mode);
      if (mode === "RANGES") formData.append("ranges", ranges.trim());

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/split`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let message = `Split failed (HTTP ${response.status}).`;
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
      const filename = parseFilename(response.headers.get("content-disposition"), isZip ? "split-pages.zip" : "split.pdf");

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
    setRanges("");
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
        <h1>Split PDF</h1>
        <p>Break a PDF into individual pages, or pull out a specific page range.</p>
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
                <h2>How should we split it?</h2>
              </div>
            </div>

            <div className="segmented" style={{ marginBottom: 20 }}>
              <button type="button" className={mode === "ALL" ? "active" : ""} onClick={() => setMode("ALL")} disabled={processing}>
                Every page
              </button>
              <button type="button" className={mode === "RANGES" ? "active" : ""} onClick={() => setMode("RANGES")} disabled={processing}>
                Custom ranges
              </button>
              <button type="button" className={mode === "ODD" ? "active" : ""} onClick={() => setMode("ODD")} disabled={processing}>
                Odd pages
              </button>
              <button type="button" className={mode === "EVEN" ? "active" : ""} onClick={() => setMode("EVEN")} disabled={processing}>
                Even pages
              </button>
            </div>

            {mode === "RANGES" && (
              <div className="field">
                <label htmlFor="ranges">Page ranges</label>
                <input
                  id="ranges"
                  className="text-input"
                  placeholder="e.g. 1-3,5,8-10"
                  value={ranges}
                  onChange={e => setRanges(e.target.value)}
                  disabled={processing}
                />
                <p className="hint">Separate ranges with commas. Each range becomes its own PDF.</p>
              </div>
            )}

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              {processing ? "Splitting…" : "Split PDF"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is ready</h2>
            <p>
              {resultIsZip
                ? "Your PDF was split into multiple files, packed into a ZIP. Your download should start automatically."
                : "Your requested pages were extracted into one PDF. Your download should start automatically."}
            </p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download={resultFilename}>
                <Download size={18} /> Download {resultFilename}
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Split another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
