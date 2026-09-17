"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  IndentDecrease,
  IndentIncrease,
  Loader2,
  Plus,
  Trash2,
  XCircle
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

/** level: 0 for a top-level bookmark, 1 for a sub-section under the nearest level-0 row above it, and so on. */
type BookmarkRow = { id: string; pageNumber: string; title: string; level: number };

const MAX_LEVEL = 8;

/** After a move or delete, no row may sit more than one level below the row above it. */
function normalizeLevels(rows: BookmarkRow[]): BookmarkRow[] {
  let ceiling = 0;
  return rows.map(row => {
    const level = Math.min(row.level, ceiling);
    ceiling = Math.min(MAX_LEVEL, level + 1);
    return level === row.level ? row : { ...row, level };
  });
}

let idSeq = 0;
const nextId = () => `bm${Date.now()}-${idSeq++}`;

export default function BookmarksPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [rows, setRows] = useState<BookmarkRow[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const selectFile = async (picked: File) => {
    setError(null);
    setDone(false);
    setFile(picked);
    setRows([]);
    setPageCount(0);
    setLoadingExisting(true);

    try {
      const formData = new FormData();
      formData.append("file", picked, picked.name);
      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/bookmarks/read`, { method: "POST", body: formData });

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

      const data: { pageCount: number; bookmarks: { pageIndex: number; title: string; level?: number }[] } = await response.json();
      setPageCount(data.pageCount);
      setRows(
        data.bookmarks.map(b => ({ id: nextId(), pageNumber: String(b.pageIndex + 1), title: b.title, level: b.level ?? 0 }))
      );
    } catch (err) {
      setFile(null);
      setError(err instanceof Error ? err.message : "Something went wrong reading this PDF.");
    } finally {
      setLoadingExisting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setRows([]);
    setPageCount(0);
    setError(null);
    setDone(false);
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: nextId(), pageNumber: "1", title: "", level: 0 }]);
  };

  const removeRow = (id: string) => {
    setRows(prev => normalizeLevels(prev.filter(r => r.id !== id)));
  };

  const updateRow = (id: string, patch: Partial<BookmarkRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  /** A row can go one level deeper than the row above it, never further. */
  const shiftLevel = (index: number, delta: -1 | 1) => {
    setRows(prev => {
      const row = prev[index];
      const ceiling = index === 0 ? 0 : Math.min(MAX_LEVEL, prev[index - 1].level + 1);
      const level = Math.max(0, Math.min(ceiling, row.level + delta));
      if (level === row.level) return prev;
      const next = [...prev];
      next[index] = { ...row, level };
      return next;
    });
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return normalizeLevels(next);
    });
  };

  const submit = async () => {
    if (!file) return;
    for (const row of rows) {
      const page = Number(row.pageNumber);
      if (!Number.isInteger(page) || page < 1 || page > pageCount) {
        setError(`"${row.title || "Untitled"}" points at page ${row.pageNumber}, which isn't in this ${pageCount}-page PDF.`);
        return;
      }
      if (!row.title.trim()) {
        setError("Every bookmark needs a title.");
        return;
      }
    }

    setProcessing(true);
    setError(null);
    setDone(false);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const bookmarks = rows.map(r => ({ pageIndex: Number(r.pageNumber) - 1, title: r.title.trim(), level: r.level }));

      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("bookmarks", JSON.stringify(bookmarks));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/bookmarks`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Updating bookmarks failed (HTTP ${response.status}).`;
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
      anchor.download = "bookmarked.pdf";
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
    setRows([]);
    setPageCount(0);
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
        <h1>Edit Bookmarks</h1>
        <p>Add, remove, or reorder the page bookmarks shown in a PDF viewer&apos;s sidebar.</p>
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

        {loadingExisting && (
          <div className="upload-zone">
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>Reading existing bookmarks…</h2>
          </div>
        )}

        {file && !loadingExisting && !done && (
          <div className="file-panel">
            <div className="panel-header">
              <div>
                <h2>{pageCount}-page PDF</h2>
                <p>
                  {rows.length === 0
                    ? "No existing bookmarks. Add one below."
                    : `${rows.length} bookmark${rows.length !== 1 ? "s" : ""}. Sub-bookmarks are indented under their ` +
                      "chapter and keep their place when you save. Entries that linked to a web address are saved as a " +
                      "link to the page shown."}
                </p>
              </div>
              <button type="button" className="add-btn" onClick={addRow} disabled={processing}>
                <Plus size={16} /> Add bookmark
              </button>
            </div>

            <div className="file-list">
              {rows.map((row, i) => (
                <div className="file-row" key={row.id} style={row.level ? { marginLeft: row.level * 24 } : undefined}>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    max={pageCount || undefined}
                    value={row.pageNumber}
                    onChange={e => updateRow(row.id, { pageNumber: e.target.value })}
                    disabled={processing}
                    style={{ width: 70, flex: "0 0 auto" }}
                    aria-label="Page number"
                  />
                  <input
                    className="text-input"
                    type="text"
                    placeholder="Bookmark title"
                    value={row.title}
                    maxLength={300}
                    onChange={e => updateRow(row.id, { title: e.target.value })}
                    disabled={processing}
                    style={{ flex: 1 }}
                    aria-label="Bookmark title"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => shiftLevel(i, -1)}
                    disabled={processing || row.level === 0}
                    aria-label="Move out one level"
                    title="Move out one level"
                  >
                    <IndentDecrease size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => shiftLevel(i, 1)}
                    disabled={processing || i === 0 || row.level > rows[i - 1].level || row.level >= MAX_LEVEL}
                    aria-label="Make a sub-bookmark of the row above"
                    title="Make a sub-bookmark of the row above"
                  >
                    <IndentIncrease size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveRow(i, -1)}
                    disabled={processing || i === 0}
                    aria-label="Move up"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveRow(i, 1)}
                    disabled={processing || i === rows.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeRow(row.id)}
                    disabled={processing}
                    aria-label="Remove bookmark"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit} style={{ marginTop: rows.length ? 18 : 0 }}>
              <Bookmark size={16} /> {processing ? "Saving…" : "Save Bookmarks"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Bookmarks saved</h2>
            <p>Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="bookmarked.pdf">
                <Download size={18} /> Download bookmarked.pdf
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
