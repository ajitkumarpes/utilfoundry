"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, ShieldCheck, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type ScanResult = { hasMetadata: boolean; attachmentCount: number; annotationCount: number; hasScripts: boolean };

export default function SanitizePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [clearMetadata, setClearMetadata] = useState(false);
  const [removeAttachments, setRemoveAttachments] = useState(false);
  const [removeAnnotations, setRemoveAnnotations] = useState(false);
  const [removeScripts, setRemoveScripts] = useState(false);
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
      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/sanitize/scan`, { method: "POST", body: formData });

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
      setClearMetadata(result.hasMetadata);
      setRemoveAttachments(result.attachmentCount > 0);
      setRemoveAnnotations(result.annotationCount > 0);
      setRemoveScripts(result.hasScripts);
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
    if (!clearMetadata && !removeAttachments && !removeAnnotations && !removeScripts) {
      setError("Select at least one thing to remove.");
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
      formData.append("clearMetadata", String(clearMetadata));
      formData.append("removeAttachments", String(removeAttachments));
      formData.append("removeAnnotations", String(removeAnnotations));
      formData.append("removeScripts", String(removeScripts));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/sanitize`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Sanitizing failed (HTTP ${response.status}).`;
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
      anchor.download = "sanitized.pdf";
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
        <h1>Sanitize PDF</h1>
        <p>Strip hidden metadata, attachments, comments, or embedded scripts before sharing a file.</p>
      </section>

      <section className="workspace">
        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!file && !done && (
          <SinglePdfInput file={null} onSelect={selectFile} onClear={clearFile} onError={setError} />
        )}

        {scanning && (
          <div className="upload-zone">
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>Scanning for metadata, attachments, comments, and scripts…</h2>
          </div>
        )}

        {file && scan && !scanning && !done && (
          <div className="file-panel">
            <div className="panel-header">
              <div>
                <h2>What to remove</h2>
                <p>Pre-checked based on what this file actually has. Uncheck anything you want to keep.</p>
              </div>
            </div>

            <div className="option-grid">
              <label className={`option-card ${clearMetadata ? "selected" : ""}`}>
                <input type="checkbox" checked={clearMetadata} onChange={e => setClearMetadata(e.target.checked)} disabled={processing} style={{ marginRight: 8 }} />
                <strong>Document metadata</strong>
                <span>{scan.hasMetadata ? "Title, author, or other properties are set" : "None found"}</span>
              </label>
              <label className={`option-card ${removeAttachments ? "selected" : ""}`}>
                <input type="checkbox" checked={removeAttachments} onChange={e => setRemoveAttachments(e.target.checked)} disabled={processing} style={{ marginRight: 8 }} />
                <strong>Embedded attachments</strong>
                <span>{scan.attachmentCount > 0 ? `${scan.attachmentCount} found` : "None found"}</span>
              </label>
              <label className={`option-card ${removeAnnotations ? "selected" : ""}`}>
                <input type="checkbox" checked={removeAnnotations} onChange={e => setRemoveAnnotations(e.target.checked)} disabled={processing} style={{ marginRight: 8 }} />
                <strong>Comments &amp; markup</strong>
                <span>{scan.annotationCount > 0 ? `${scan.annotationCount} found` : "None found"}</span>
              </label>
              <label className={`option-card ${removeScripts ? "selected" : ""}`}>
                <input type="checkbox" checked={removeScripts} onChange={e => setRemoveScripts(e.target.checked)} disabled={processing} style={{ marginRight: 8 }} />
                <strong>Embedded scripts &amp; actions</strong>
                <span>{scan.hasScripts ? "Found" : "None found"}</span>
              </label>
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              <ShieldCheck size={16} /> {processing ? "Sanitizing…" : "Sanitize PDF"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is sanitized</h2>
            <p>Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="sanitized.pdf">
                <Download size={18} /> Download sanitized.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Sanitize another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
