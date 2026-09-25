"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
  XCircle
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { formatCount } from "@/lib/format";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";
const MAX_MARKDOWN_LENGTH = 500_000;

export default function MarkdownToPdfPage() {
  const [markdown, setMarkdown] = useState("");
  const [pageSize, setPageSize] = useState<"A4" | "LETTER">("A4");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyMarkdown = (content: string, sourceLabel: string) => {
    if (content.length > MAX_MARKDOWN_LENGTH) {
      setError(
        `${sourceLabel} is ${formatCount(content.length)} characters — only the first ${formatCount(MAX_MARKDOWN_LENGTH)} were kept.`
      );
    } else {
      setError(null);
    }
    setMarkdown(content.slice(0, MAX_MARKDOWN_LENGTH));
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const content = await file.text();
      applyMarkdown(content, "This file");
    } catch {
      setError("Couldn't read that file as text.");
    }
  };

  const submit = async () => {
    if (!markdown.trim()) {
      setError("Paste or upload some Markdown first.");
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
      formData.append("markdown", markdown);
      formData.append("pageSize", pageSize);

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/markdown-to-pdf`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Converting failed (HTTP ${response.status}).`;
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
      anchor.download = "document.pdf";
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
    setMarkdown("");
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
        <h1>Markdown to PDF</h1>
        <p>Paste Markdown or upload a .md file. Headings, lists, code blocks, quotes and links all render.</p>
      </section>

      <section className="workspace">
        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!done && (
          <div className="file-panel">
            <div className="panel-header">
              <div>
                <h2>Your Markdown</h2>
                <p>
                  {formatCount(markdown.length)} / {formatCount(MAX_MARKDOWN_LENGTH)} characters
                </p>
              </div>
              <button type="button" className="add-btn" onClick={pickFile} disabled={processing}>
                <Upload size={16} /> Upload .md file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={onFileChosen}
                style={{ display: "none" }}
              />
            </div>

            <textarea
              className="text-input"
              placeholder={"# Paste your Markdown here…\n\n- headings, **bold**, *italic*\n- lists, `code`, > quotes, links"}
              value={markdown}
              onChange={e => applyMarkdown(e.target.value, "This text")}
              disabled={processing}
              rows={16}
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                resize: "vertical",
                marginBottom: 18,
                lineHeight: 1.5
              }}
            />

            <div className="field" style={{ marginBottom: 0 }}>
              <span id="page-size-label" className="field-label">Page size</span>
              <div className="segmented" role="group" aria-labelledby="page-size-label">
                <button
                  type="button"
                  className={pageSize === "A4" ? "active" : ""}
                  aria-pressed={pageSize === "A4"}
                  onClick={() => setPageSize("A4")}
                  disabled={processing}
                >
                  A4
                </button>
                <button
                  type="button"
                  className={pageSize === "LETTER" ? "active" : ""}
                  aria-pressed={pageSize === "LETTER"}
                  onClick={() => setPageSize("LETTER")}
                  disabled={processing}
                >
                  Letter
                </button>
              </div>
            </div>

            <button
              type="button"
              className="primary-btn wide"
              disabled={processing || !markdown.trim()}
              onClick={submit}
              style={{ marginTop: 20 }}
            >
              {processing ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}{" "}
              {processing ? "Creating…" : "Create PDF"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>PDF created</h2>
            <p>Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="document.pdf">
                <Download size={18} /> Download document.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Convert more Markdown
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
