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
const MAX_HTML_LENGTH = 500_000;

export default function HtmlToPdfPage() {
  const [html, setHtml] = useState("");
  const [pageSize, setPageSize] = useState<"A4" | "LETTER">("A4");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyHtml = (content: string, sourceLabel: string) => {
    if (content.length > MAX_HTML_LENGTH) {
      setError(
        `${sourceLabel} is ${formatCount(content.length)} characters — only the first ${formatCount(MAX_HTML_LENGTH)} were kept.`
      );
    } else {
      setError(null);
    }
    setHtml(content.slice(0, MAX_HTML_LENGTH));
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const content = await file.text();
      applyHtml(content, "This file");
    } catch {
      setError("Couldn't read that file as text.");
    }
  };

  const submit = async () => {
    if (!html.trim()) {
      setError("Paste or upload some HTML first.");
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
      formData.append("html", html);
      formData.append("pageSize", pageSize);

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/html-to-pdf`, { method: "POST", body: formData });

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
    setHtml("");
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
        <h1>HTML to PDF</h1>
        <p>Paste HTML (with inline or embedded CSS) or upload a .html file and turn it into a PDF.</p>
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
                <h2>Your HTML</h2>
                <p>
                  {formatCount(html.length)} / {formatCount(MAX_HTML_LENGTH)} characters
                </p>
              </div>
              <button type="button" className="add-btn" onClick={pickFile} disabled={processing}>
                <Upload size={16} /> Upload .html file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,text/html"
                onChange={onFileChosen}
                style={{ display: "none" }}
              />
            </div>

            <textarea
              className="text-input"
              placeholder={"<h1>Paste your HTML here…</h1>\n<p>Inline or <style> CSS both work.</p>"}
              value={html}
              onChange={e => applyHtml(e.target.value, "This text")}
              disabled={processing}
              rows={16}
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                resize: "vertical",
                marginBottom: 12,
                lineHeight: 1.5
              }}
            />

            <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 18px" }}>
              For privacy and security, remote images, stylesheets and fonts are never fetched — only
              images embedded directly as a <code>data:</code> URI will show up. SVG images aren&apos;t
              supported.
            </p>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Page size</label>
              <div className="segmented">
                <button
                  type="button"
                  className={pageSize === "A4" ? "active" : ""}
                  onClick={() => setPageSize("A4")}
                  disabled={processing}
                >
                  A4
                </button>
                <button
                  type="button"
                  className={pageSize === "LETTER" ? "active" : ""}
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
              disabled={processing || !html.trim()}
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
              <XCircle size={17} /> Convert more HTML
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
