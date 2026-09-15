"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Lock, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

export default function LockPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowEditing, setAllowEditing] = useState(false);
  const [allowFillingForms, setAllowFillingForms] = useState(false);
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
      if (password.trim()) formData.append("userPassword", password.trim());
      formData.append("allowPrinting", String(allowPrinting));
      formData.append("allowCopying", String(allowCopying));
      formData.append("allowEditing", String(allowEditing));
      formData.append("allowFillingForms", String(allowFillingForms));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/protect`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Protecting the PDF failed (HTTP ${response.status}).`;
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
      anchor.download = "locked.pdf";
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
    setPassword("");
  };

  return (
    <main className="tool-page">
      <SiteHeader />

      <section className="tool-hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> All tools
        </Link>
        <div className="eyebrow">PDF TOOL</div>
        <h1>Lock PDF</h1>
        <p>Restrict printing, copying, editing and form-filling, and optionally require a password just to open the file.</p>
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
                <h2>Protection</h2>
              </div>
            </div>

            <div className="field">
              <label>Open password (optional)</label>
              <input
                className="text-input"
                type="password"
                value={password}
                placeholder="Leave blank to skip"
                onChange={e => setPassword(e.target.value)}
                disabled={processing}
              />
              <p className="hint">
                If set, this password is required to open the file. Restrictions below apply either way.
              </p>
            </div>

            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={allowPrinting}
                  onChange={e => setAllowPrinting(e.target.checked)}
                  disabled={processing}
                />
                Allow printing
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={allowCopying}
                  onChange={e => setAllowCopying(e.target.checked)}
                  disabled={processing}
                />
                Allow copying text and images
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={allowEditing}
                  onChange={e => setAllowEditing(e.target.checked)}
                  disabled={processing}
                />
                Allow editing the document
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={allowFillingForms}
                  onChange={e => setAllowFillingForms(e.target.checked)}
                  disabled={processing}
                />
                Allow filling in form fields
              </label>
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              <Lock size={16} /> {processing ? "Locking…" : "Lock PDF"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is locked</h2>
            <p>
              {password.trim()
                ? "A password is now required to open this file — keep it somewhere safe, it can't be recovered."
                : "Printing/copying restrictions were applied. No password is required to open the file."}
            </p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="locked.pdf">
                <Download size={18} /> Download locked.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Lock another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
