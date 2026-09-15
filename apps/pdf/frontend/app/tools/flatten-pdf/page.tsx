"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Layers, Loader2, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type ScanResult = { hasFormFields: boolean; annotationCount: number };

export default function FlattenPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [flattenForms, setFlattenForms] = useState(false);
  const [flattenAnnotations, setFlattenAnnotations] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const selectFile = async (picked: File) => {
    setError(null);
    setDone(false);
    setFile(picked);
    setScan(null);
    setScanning(true);

    try {
      const formData = new FormData();
      formData.append("file", picked, picked.name);
      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/flatten/scan`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Reading this PDF failed (HTTP ${response.status}).`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = await response.json();
            message = body.error || body.message || message;
          } catch {}
        }
        throw new Error(message);
      }

      const result: ScanResult = await response.json();
      setScan(result);
      setFlattenForms(result.hasFormFields);
      setFlattenAnnotations(result.annotationCount > 0);
    } catch (err) {
      setFile(null);
      setError(err instanceof Error ? err.message : "Something went wrong reading this PDF.");
    } finally {
      setScanning(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setScan(null);
    setError(null);
    setDone(false);
  };

  const submit = async () => {
    if (!file) return;
    if (!flattenForms && !flattenAnnotations) {
      setError("Select at least one thing to flatten.");
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
      formData.append("flattenForms", String(flattenForms));
      formData.append("flattenAnnotations", String(flattenAnnotations));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/flatten`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Flattening failed (HTTP ${response.status}).`;
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
      anchor.download = "flattened.pdf";
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
    setScan(null);
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
        <h1>Flatten PDF</h1>
        <p>Bake filled-in form fields and comment/markup annotations permanently into the page, so they can no longer be edited or removed.</p>
      </section>

      <section className="workspace">
        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!file && !scanning && !done && (
          <SinglePdfInput file={null} onSelect={selectFile} onClear={clearFile} onError={setError} />
        )}

        {scanning && (
          <div className="upload-zone">
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>Scanning for form fields and annotations…</h2>
          </div>
        )}

        {file && scan && !scanning && !done && (
          <div className="file-panel">
            <div className="panel-header">
              <div>
                <h2>What to flatten</h2>
                <p>Pre-checked based on what this file actually has. Uncheck anything you want to keep editable.</p>
              </div>
            </div>

            <div className="option-grid">
              <label className={`option-card ${flattenForms ? "selected" : ""}`}>
                <input type="checkbox" checked={flattenForms} onChange={e => setFlattenForms(e.target.checked)} disabled={processing} style={{ marginRight: 8 }} />
                <strong>Form fields</strong>
                <span>{scan.hasFormFields ? "This PDF has an interactive form" : "None found"}</span>
              </label>
              <label className={`option-card ${flattenAnnotations ? "selected" : ""}`}>
                <input type="checkbox" checked={flattenAnnotations} onChange={e => setFlattenAnnotations(e.target.checked)} disabled={processing} style={{ marginRight: 8 }} />
                <strong>Comments &amp; markup</strong>
                <span>{scan.annotationCount > 0 ? `${scan.annotationCount} found` : "None found"}</span>
              </label>
            </div>

            <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>
              A small number of annotations with a rotated or skewed appearance may be left as-is
              rather than flattened incorrectly — everything else about the file is unaffected.
            </p>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              <Layers size={16} /> {processing ? "Flattening…" : "Flatten PDF"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is flattened</h2>
            <p>Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="flattened.pdf">
                <Download size={18} /> Download flattened.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Flatten another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
