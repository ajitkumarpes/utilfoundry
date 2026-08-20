"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Tag, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

export default function EditMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");
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
    if (!title.trim() && !author.trim() && !subject.trim() && !keywords.trim()) {
      setError("Fill in at least one field.");
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
      if (title.trim()) formData.append("title", title.trim());
      if (author.trim()) formData.append("author", author.trim());
      if (subject.trim()) formData.append("subject", subject.trim());
      if (keywords.trim()) formData.append("keywords", keywords.trim());

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/metadata`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Updating metadata failed (HTTP ${response.status}).`;
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
      anchor.download = "updated-metadata.pdf";
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
    setTitle("");
    setAuthor("");
    setSubject("");
    setKeywords("");
  };

  return (
    <main className="tool-page">
      <SiteHeader />

      <section className="tool-hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> All tools
        </Link>
        <div className="eyebrow">PDF TOOL</div>
        <h1>Edit PDF Metadata</h1>
        <p>Change the Title, Author, Subject and Keywords stored inside a PDF&apos;s document properties.</p>
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
                <h2>Document properties</h2>
                <p>Only fields you fill in are changed — leave the rest blank to leave them as they are.</p>
              </div>
            </div>

            <div className="field">
              <label>Title</label>
              <input
                className="text-input"
                type="text"
                value={title}
                maxLength={300}
                onChange={e => setTitle(e.target.value)}
                disabled={processing}
              />
            </div>
            <div className="field">
              <label>Author</label>
              <input
                className="text-input"
                type="text"
                value={author}
                maxLength={300}
                onChange={e => setAuthor(e.target.value)}
                disabled={processing}
              />
            </div>
            <div className="field">
              <label>Subject</label>
              <input
                className="text-input"
                type="text"
                value={subject}
                maxLength={300}
                onChange={e => setSubject(e.target.value)}
                disabled={processing}
              />
            </div>
            <div className="field">
              <label>Keywords</label>
              <input
                className="text-input"
                type="text"
                value={keywords}
                maxLength={300}
                placeholder="Comma-separated"
                onChange={e => setKeywords(e.target.value)}
                disabled={processing}
              />
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              <Tag size={16} /> {processing ? "Updating…" : "Update Metadata"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Metadata updated</h2>
            <p>Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="updated-metadata.pdf">
                <Download size={18} /> Download updated-metadata.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Edit another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
