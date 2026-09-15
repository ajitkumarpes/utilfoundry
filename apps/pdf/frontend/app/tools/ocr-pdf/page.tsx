"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput, { PDF_OR_IMAGE_ACCEPT } from "@/components/SinglePdfInput";
import { useJobPoll } from "@/lib/useJobPoll";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type Language = "eng" | "hin";

const LANGUAGES: { id: Language; label: string; hint: string }[] = [
  { id: "eng", label: "English", hint: "Default" },
  { id: "hin", label: "Hindi", hint: "हिन्दी दस्तावेज़ों के लिए" }
];

const STATUS_COPY: Record<string, string> = {
  QUEUED: "Waiting for a worker…",
  PROCESSING: "Reading your document…"
};

export default function OcrPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<Language>("eng");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

  const { status, error: pollError, resultFilename } = useJobPoll(jobId);

  useEffect(() => {
    const existing = new URLSearchParams(window.location.search).get("job");
    if (existing) queueMicrotask(() => setJobId(existing));
  }, []);

  const selectFile = (picked: File) => {
    setSubmitError(null);
    setFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    setSubmitError(null);
  };

  const submit = async () => {
    if (!file) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("language", language);

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/ocr`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Could not start OCR (HTTP ${response.status}).`;
        try {
          const body = await response.json();
          message = body.error || message;
        } catch {}
        throw new Error(message);
      }

      const body = await response.json();
      setJobId(body.jobId);

      const url = new URL(window.location.href);
      url.searchParams.set("job", body.jobId);
      window.history.replaceState(null, "", url.toString());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const download = useCallback(() => {
    if (!jobId) return;
    // A plain navigation, not fetch().blob() - the backend 302s straight to a presigned MinIO
    // URL on a different origin, and a script-mediated fetch of that redirect would need MinIO's
    // CORS to allow reading the response. Top-level navigation isn't subject to that: the browser
    // follows the redirect and MinIO's own Content-Disposition header drives the save, no JS
    // blob-handling required.
    const anchor = document.createElement("a");
    anchor.href = `${API_BASE_URL}/api/v1/pdf/jobs/${jobId}/download`;
    anchor.click();
    setDownloadTriggered(true);
  }, [jobId]);

  useEffect(() => {
    if (status !== "SUCCEEDED" || !jobId) return;
    const timer = window.setTimeout(download, 0);
    return () => window.clearTimeout(timer);
  }, [status, jobId, download]);

  const reset = () => {
    setFile(null);
    setJobId(null);
    setDownloadTriggered(false);
    setSubmitError(null);

    const url = new URL(window.location.href);
    url.searchParams.delete("job");
    window.history.replaceState(null, "", url.toString());
  };

  const error = submitError || pollError;
  const isWorking = status === "QUEUED" || status === "PROCESSING";

  return (
    <main className="tool-page">
      <SiteHeader />

      <section className="tool-hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> All tools
        </Link>
        <div className="eyebrow">PDF TOOL</div>
        <h1>OCR PDF</h1>
        <p>Turn a scanned PDF or photo into a searchable PDF with real, selectable text.</p>
      </section>

      <section className="workspace">
        {error && status !== "FAILED" && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!jobId && (
          <SinglePdfInput
            file={file}
            onSelect={selectFile}
            onClear={clearFile}
            onError={setSubmitError}
            accept={PDF_OR_IMAGE_ACCEPT}
            disabled={submitting}
          />
        )}

        {!jobId && file && (
          <div className="file-panel" style={{ marginTop: 14 }}>
            <div className="panel-header">
              <div>
                <h2>Document language</h2>
              </div>
            </div>

            <div className="option-grid">
              {LANGUAGES.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`option-card ${language === opt.id ? "selected" : ""}`}
                  onClick={() => setLanguage(opt.id)}
                  disabled={submitting}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.hint}</span>
                </button>
              ))}
            </div>

            <button type="button" className="primary-btn wide" disabled={submitting} onClick={submit}>
              {submitting ? "Starting…" : "Run OCR"}
            </button>
          </div>
        )}

        {jobId && isWorking && (
          <div className="upload-zone">
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>{STATUS_COPY[status ?? "QUEUED"]}</h2>
            <p>This can take a little longer for large or multi-page documents.</p>
          </div>
        )}

        {status === "FAILED" && (
          <div className="result-panel">
            <div className="error-box" style={{ marginBottom: 0 }}>
              <AlertCircle size={18} />
              <span>{pollError || "OCR failed on this file."}</span>
            </div>
            <button type="button" className="secondary-btn" style={{ marginTop: 18 }} onClick={reset}>
              <XCircle size={17} /> Try again
            </button>
          </div>
        )}

        {status === "SUCCEEDED" && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is ready</h2>
            <p>The text is now selectable and searchable. Your download should start automatically.</p>

            <button type="button" className="primary-btn" onClick={download}>
              <Download size={18} /> {downloadTriggered ? "Download again" : "Download"} {resultFilename}
            </button>

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> OCR another file
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
