"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import SinglePdfInput, { FileAccept, PDF_ACCEPT } from "./SinglePdfInput";
import { useJobPoll } from "@/lib/useJobPoll";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type Props = {
  title: string;
  description: string;
  actionLabel: string;
  endpoint: string;
  accept?: FileAccept;
  resultNote?: string;
};

const STATUS_COPY: Record<string, string> = {
  QUEUED: "Waiting for a worker…",
  PROCESSING: "Converting your file…"
};

export default function JobToolWorkspace({
  title,
  description,
  actionLabel,
  endpoint,
  accept = PDF_ACCEPT,
  resultNote
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const { status, error: pollError, resultFilename } = useJobPoll(jobId);

  // Resume an in-flight job across a page refresh - the job keeps processing server-side
  // regardless, but without this the UI would silently lose track of it.
  useEffect(() => {
    const existing = new URLSearchParams(window.location.search).get("job");
    if (existing) setJobId(existing);
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

      const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Could not start the job (HTTP ${response.status}).`;
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

  const download = async () => {
    if (!jobId) return;
    const response = await fetch(`${API_BASE_URL}/api/v1/pdf/jobs/${jobId}/download`);
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = resultFilename || "download";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  useEffect(() => {
    if (status === "SUCCEEDED" && jobId) {
      download();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, jobId]);

  const reset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setJobId(null);
    setDownloadUrl(null);
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
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <section className="workspace">
        {error && status !== "FAILED" && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!jobId && (
          <SinglePdfInput file={file} onSelect={selectFile} onClear={clearFile} onError={setSubmitError} accept={accept} disabled={submitting} />
        )}

        {!jobId && file && (
          <button type="button" className="primary-btn wide" style={{ marginTop: 14 }} disabled={submitting} onClick={submit}>
            {submitting ? "Starting…" : actionLabel}
          </button>
        )}

        {jobId && isWorking && (
          <div className="upload-zone">
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>{STATUS_COPY[status ?? "QUEUED"]}</h2>
            <p>This can take a little longer for large or complex files.</p>
          </div>
        )}

        {status === "FAILED" && (
          <div className="result-panel">
            <div className="error-box" style={{ marginBottom: 0 }}>
              <AlertCircle size={18} />
              <span>{pollError || "This job failed."}</span>
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
            <h2>Your file is ready</h2>
            <p>Your download should start automatically.{resultNote ? ` ${resultNote}` : ""}</p>

            {downloadUrl ? (
              <a className="primary-btn" href={downloadUrl} download={resultFilename || "download"}>
                <Download size={18} /> Download {resultFilename}
              </a>
            ) : (
              <button type="button" className="primary-btn" onClick={download}>
                <Download size={18} /> Download {resultFilename}
              </button>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Convert another
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
