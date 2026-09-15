"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileStack,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
  Undo2,
  XCircle
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type PageKind = "SOURCE" | "SOURCE2" | "BLANK";

type PageState = {
  id: string;
  kind: PageKind;
  sourceIndex: number | null;
  thumbnail: string | null;
  rotation: number;
  excluded: boolean;
};

type ThumbInfo = { sourceIndex: number; thumbnail: string };

let idSeq = 0;
const nextId = () => `p${Date.now()}-${idSeq++}`;

async function renderThumbnails(file: File): Promise<ThumbInfo[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const out: ThumbInfo[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.45 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
    out.push({ sourceIndex: i - 1, thumbnail: canvas.toDataURL("image/png") });
  }
  return out;
}

export default function OrganizePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageState[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [file2, setFile2] = useState<File | null>(null);
  const [file2Pages, setFile2Pages] = useState<ThumbInfo[]>([]);
  const [loadingFile2, setLoadingFile2] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const file2InputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadThumbnails = useCallback(async (picked: File) => {
    setLoadingThumbs(true);
    setError(null);
    try {
      const thumbs = await renderThumbnails(picked);
      setPages(
        thumbs.map(t => ({
          id: nextId(),
          kind: "SOURCE" as const,
          sourceIndex: t.sourceIndex,
          thumbnail: t.thumbnail,
          rotation: 0,
          excluded: false
        }))
      );
      setFile(picked);
    } catch {
      setError("Could not read this PDF. It may be corrupted or password-protected.");
    } finally {
      setLoadingThumbs(false);
    }
  }, []);

  const pickFile2 = () => file2InputRef.current?.click();

  const onFile2Chosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    setLoadingFile2(true);
    setError(null);
    try {
      const thumbs = await renderThumbnails(picked);
      setFile2(picked);
      setFile2Pages(thumbs);
    } catch {
      setError("Could not read the second PDF. It may be corrupted or password-protected.");
    } finally {
      setLoadingFile2(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPages([]);
    setFile2(null);
    setFile2Pages([]);
    setError(null);
    setDone(false);
  };

  const insertBlankPage = () => {
    setPages(prev => [
      ...prev,
      { id: nextId(), kind: "BLANK", sourceIndex: null, thumbnail: null, rotation: 0, excluded: false }
    ]);
  };

  const insertFromFile2 = (thumb: ThumbInfo) => {
    setPages(prev => [
      ...prev,
      {
        id: nextId(),
        kind: "SOURCE2",
        sourceIndex: thumb.sourceIndex,
        thumbnail: thumb.thumbnail,
        rotation: 0,
        excluded: false
      }
    ]);
  };

  const rotate = (id: string) => {
    setPages(prev => prev.map(p => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  };

  const toggleExclude = (id: string) => {
    setPages(prev => prev.map(p => (p.id === id ? { ...p, excluded: !p.excluded } : p)));
  };

  const duplicate = (id: string) => {
    setPages(prev => {
      const index = prev.findIndex(p => p.id === id);
      if (index === -1) return prev;
      const clone: PageState = { ...prev[index], id: nextId() };
      return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPages(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id);
      const newIndex = prev.findIndex(p => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const activeCount = pages.filter(p => !p.excluded).length;

  const submit = async () => {
    if (!file) return;
    if (activeCount === 0) {
      setError("Keep at least one page.");
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
      const activePages = pages.filter(p => !p.excluded);
      const plan = {
        pages: activePages.map(p => ({ kind: p.kind, sourceIndex: p.sourceIndex, rotation: p.rotation }))
      };
      const needsFile2 = activePages.some(p => p.kind === "SOURCE2");

      const formData = new FormData();
      formData.append("file", file, file.name);
      if (needsFile2 && file2) {
        formData.append("file2", file2, file2.name);
      }
      formData.append("plan", JSON.stringify(plan));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/organize`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let message = `Request failed (HTTP ${response.status}).`;
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
      setSavedCount(plan.pages.length);
      setDone(true);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "organized.pdf";
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
    setPages([]);
    setFile2(null);
    setFile2Pages([]);
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
        <h1>Organize Pages</h1>
        <p>Reorder, rotate, duplicate, or remove pages — or insert a blank page or pages from another PDF. Drag thumbnails to rearrange.</p>
      </section>

      <section className="workspace">
        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!file && !loadingThumbs && !done && (
          <SinglePdfInput file={null} onSelect={loadThumbnails} onClear={clearFile} onError={setError} />
        )}

        {loadingThumbs && (
          <div className="upload-zone">
            <div className="upload-icon">
              <Loader2 size={30} className="spin" />
            </div>
            <h2>Reading your PDF…</h2>
            <p>Rendering page previews in your browser.</p>
          </div>
        )}

        {file && pages.length > 0 && !done && (
          <div className="file-panel">
            <div className="toolbar-row">
              <div>
                <h2>
                  {pages.length} page{pages.length !== 1 ? "s" : ""}
                </h2>
                <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
                  {activeCount} will be kept · drag to reorder · use the icons to rotate, duplicate, or remove a page
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="add-btn" onClick={insertBlankPage} disabled={processing}>
                  <Plus size={16} /> Blank page
                </button>
                <button type="button" className="add-btn" onClick={pickFile2} disabled={processing || loadingFile2}>
                  <FileStack size={16} /> {loadingFile2 ? "Reading…" : "From another PDF"}
                </button>
                <button type="button" className="add-btn" onClick={clearFile} disabled={processing}>
                  <Trash2 size={17} /> Replace file
                </button>
              </div>
            </div>
            <input
              ref={file2InputRef}
              type="file"
              accept="application/pdf"
              onChange={onFile2Chosen}
              style={{ display: "none" }}
            />

            {file2Pages.length > 0 && (
              <div className="file-panel" style={{ background: "#f7f7f5", marginBottom: 18 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666" }}>
                  From <strong>{file2?.name}</strong> — click a page to insert it at the end of the list below.
                </p>
                <div className="page-grid">
                  {file2Pages.map(t => (
                    <button
                      key={t.sourceIndex}
                      type="button"
                      className="page-thumb selectable"
                      onClick={() => insertFromFile2(t)}
                      disabled={processing}
                      style={{ border: "1px solid #deded8" }}
                    >
                      <div className="thumb-canvas-wrap">
                        <img src={t.thumbnail} alt={`Second file page ${t.sourceIndex + 1}`} draggable={false} />
                      </div>
                      <span className="page-num">Page {t.sourceIndex + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
                <div className="page-grid">
                  {pages.map((page, i) => (
                    <SortablePageThumb
                      key={page.id}
                      page={page}
                      position={i + 1}
                      onRotate={() => rotate(page.id)}
                      onToggleExclude={() => toggleExclude(page.id)}
                      onDuplicate={() => duplicate(page.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button type="button" className="primary-btn wide" disabled={processing || activeCount === 0} onClick={submit}>
              {processing
                ? "Saving…"
                : `Download organized PDF (${activeCount} page${activeCount !== 1 ? "s" : ""})`}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is ready</h2>
            <p>
              Your organized PDF was saved with {savedCount} page{savedCount !== 1 ? "s" : ""}. Your download should
              start automatically.
            </p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="organized.pdf">
                <Download size={18} /> Download organized.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Organize another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}

function SortablePageThumb({
  page,
  position,
  onRotate,
  onToggleExclude,
  onDuplicate
}: {
  page: PageState;
  position: number;
  onRotate: () => void;
  onToggleExclude: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const rotClass = page.rotation ? ` rot-${page.rotation}` : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`page-thumb ${isDragging ? "dragging" : ""} ${page.excluded ? "excluded" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className={`thumb-canvas-wrap${rotClass}`}>
        {page.thumbnail ? (
          <img src={page.thumbnail} alt={`Page ${position}`} draggable={false} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1.5px dashed #ccc",
              color: "#aaa",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            Blank
          </div>
        )}
      </div>
      <span className="page-num">
        Page {position}
        {page.kind === "SOURCE2" ? " · 2nd file" : ""}
      </span>
      <div className="thumb-actions">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onRotate();
          }}
          aria-label="Rotate page"
        >
          <RotateCw size={14} />
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onDuplicate();
          }}
          aria-label="Duplicate page"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggleExclude();
          }}
          aria-label={page.excluded ? "Keep page" : "Remove page"}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {page.excluded && (
        <button
          type="button"
          className="restore-btn"
          onClick={e => {
            e.stopPropagation();
            onToggleExclude();
          }}
        >
          <Undo2 size={14} /> Restore
        </button>
      )}
    </div>
  );
}
