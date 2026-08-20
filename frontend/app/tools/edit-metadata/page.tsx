"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, Tag, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type MetaSnapshot = { title: string; author: string; subject: string; keywords: string };

const emptySnapshot: MetaSnapshot = { title: "", author: "", subject: "", keywords: "" };

export default function EditMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loaded, setLoaded] = useState<MetaSnapshot>(emptySnapshot);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const selectFile = async (picked: File) => {
    setError(null);
    setDone(false);
    setFile(picked);
    setLoadingMeta(true);
    setLoaded(emptySnapshot);
    setTitle("");
    setAuthor("");
    setSubject("");
    setKeywords("");

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const buffer = await picked.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const meta = await pdf.getMetadata();
      const info = (meta.info ?? {}) as Record<string, unknown>;

      const snapshot: MetaSnapshot = {
        title: typeof info.Title === "string" ? info.Title : "",
        author: typeof info.Author === "string" ? info.Author : "",
        subject: typeof info.Subject === "string" ? info.Subject : "",
        keywords: typeof info.Keywords === "string" ? info.Keywords : ""
      };

      setLoaded(snapshot);
      setTitle(snapshot.title);
      setAuthor(snapshot.author);
      setSubject(snapshot.subject);
      setKeywords(snapshot.keywords);
    } catch {
      // Reading the current values is a convenience, not a requirement — if this file's
      // metadata can't be pre-read (e.g. it's encrypted), fields just start blank and the
      // real submit below still works and reports any actual problem with the file.
    } finally {
      setLoadingMeta(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setLoaded(emptySnapshot);
    setError(null);
    setDone(false);
  };

  const submit = async () => {
    if (!file) return;
    if (
      title.trim() === loaded.title.trim() &&
      author.trim() === loaded.author.trim() &&
      subject.trim() === loaded.subject.trim() &&
      keywords.trim() === loaded.keywords.trim()
    ) {
      setError("Change at least one field first.");
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
      formData.append("title", title.trim());
      formData.append("author", author.trim());
      formData.append("subject", subject.trim());
      formData.append("keywords", keywords.trim());

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
    setLoaded(emptySnapshot);
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

        {file && loadingMeta && !done && (
          <div className="upload-zone" style={{ marginTop: 14 }}>
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>Reading current properties…</h2>
          </div>
        )}

        {file && !loadingMeta && !done && (
          <div className="file-panel" style={{ marginTop: 14 }}>
            <div className="panel-header">
              <div>
                <h2>Document properties</h2>
                <p>These are the file&apos;s current values — edit or clear whatever you&apos;d like to change.</p>
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
