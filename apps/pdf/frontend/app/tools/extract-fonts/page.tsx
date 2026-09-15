"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

function parseFilename(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = header.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

export default function ExtractFontsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState("fonts.zip");
  const [resultIsZip, setResultIsZip] = useState(true);

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

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/extract-fonts`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Extraction failed (HTTP ${response.status}).`;
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
        isZip ? "fonts.zip" : "font"
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
        <h1>Extract Fonts</h1>
        <p>Pull the embedded font files out of a PDF.</p>
      </section>

      <section className="workspace">
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 18px" }}>
          Only extract fonts you have the right to use outside this document. Most font licenses
          allow embedding a font in a PDF for display but don&apos;t allow reusing the font file
          itself elsewhere. Most PDFs embed a subset — just the characters that document actually
          uses, not the complete font — which the extracted filename discloses with a 6-letter
          prefix like <code>ABCDEF+FontName</code>.
        </p>

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
            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              {processing ? "Extracting…" : "Extract Fonts"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your fonts are ready</h2>
            <p>
              {resultIsZip
                ? "Every embedded font was packed into a ZIP. Your download should start automatically."
                : "The embedded font was extracted. Your download should start automatically."}
            </p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download={resultFilename}>
                <Download size={18} /> Download {resultFilename}
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Extract from another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
