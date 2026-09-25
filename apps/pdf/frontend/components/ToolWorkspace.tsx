"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

type FileKind = "pdf" | "image";

type Props = {
  title: string;
  description: string;
  actionLabel: string;
  endpoint: string;
  resultFilename: string;
  resultNoun: string;
  resultVerb: string;
  fileKind: FileKind;
  minFiles?: number;
};

type StagedFile = { id: string; file: File };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";
const MAX_FILES = 20;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;

const KIND_CONFIG: Record<
  FileKind,
  { accept: Record<string, string[]>; test: (f: File) => boolean; label: string; icon: typeof FileText }
> = {
  pdf: {
    accept: { "application/pdf": [".pdf"] },
    test: f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    label: "PDF",
    icon: FileText
  },
  image: {
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    test: f => f.type.startsWith("image/") || /\.(jpe?g|png)$/i.test(f.name),
    label: "image",
    icon: ImageIcon
  }
};

let idSeq = 0;
const nextId = () => `f${Date.now()}-${idSeq++}`;

export default function ToolWorkspace({
  title,
  description,
  actionLabel,
  endpoint,
  resultFilename,
  resultNoun,
  resultVerb,
  fileKind,
  minFiles = 2
}: Props) {
  const config = KIND_CONFIG[fileKind];
  const [items, setItems] = useState<StagedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      setError(null);
      setDone(false);

      const valid = incoming.filter(config.test);
      if (valid.length !== incoming.length) {
        setError(`Only ${config.label} files are allowed.`);
      }

      setItems(prev => {
        const combined = [...prev, ...valid.map(file => ({ id: nextId(), file }))];

        if (combined.length > MAX_FILES) {
          setError(`You can add up to ${MAX_FILES} files at once.`);
          return combined.slice(0, MAX_FILES);
        }

        const oversized = combined.find(s => s.file.size > MAX_FILE_SIZE);
        if (oversized) {
          setError(`${oversized.file.name} is larger than the 50 MB limit.`);
          return prev;
        }

        const total = combined.reduce((sum, s) => sum + s.file.size, 0);
        if (total > MAX_TOTAL_SIZE) {
          setError("The combined file size cannot exceed 100 MB.");
          return prev;
        }

        return combined;
      });
    },
    [config]
  );

  const onDrop = useCallback((accepted: File[]) => addFiles(accepted), [addFiles]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: config.accept,
    noClick: true,
    multiple: true
  });

  const remove = (id: string) => {
    setError(null);
    setItems(prev => prev.filter(s => s.id !== id));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    setItems(prev => arrayMove(prev, index, target));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const submit = async () => {
    if (items.length < minFiles) {
      setError(minFiles === 1 ? "Select at least 1 file." : `Select at least ${minFiles} files.`);
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
      items.forEach(({ file }) => formData.append("files", file, file.name));

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
        } else {
          try {
            const text = await response.text();
            if (text.trim()) message = text;
          } catch {}
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The server returned an empty file.");
      }

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setResultCount(items.length);
      setDone(true);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resultFilename;
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
    setItems([]);
    setDone(false);
    setProcessing(false);
    setError(null);
    setDownloadUrl(null);
  };

  const Icon = config.icon;

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
        <input {...getInputProps()} aria-label={`Select ${config.label} files`} />

        {error && (
          <div className="error-box" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!items.length && !done && (
          <div {...getRootProps()} className={`upload-zone ${isDragActive ? "dragging" : ""}`}>
            <div className="upload-icon">
              <UploadCloud size={30} />
            </div>
            <h2>{isDragActive ? `Drop your ${config.label} files here` : `Drop ${config.label} files here`}</h2>
            <p>or choose files from your device</p>
            <button type="button" onClick={open} className="primary-btn">
              <Plus size={18} /> Select {config.label} files
            </button>
            <div className="trust-row">
              <span>
                <ShieldCheck size={15} /> Files are private
              </span>
              <span>Up to {MAX_FILES} files</span>
            </div>
          </div>
        )}

        {items.length > 0 && !done && (
          <div className="file-panel">
            <div className="panel-header">
              <div>
                <h2>Your files</h2>
                <p>
                  {items.length} file{items.length !== 1 ? "s" : ""} selected · drag to reorder
                </p>
              </div>
              <button type="button" className="add-btn" onClick={open} disabled={processing}>
                <Plus size={17} /> Add files
              </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="file-list">
                  {items.map((item, i) => (
                    <SortableFileRow
                      key={item.id}
                      item={item}
                      index={i}
                      isFirst={i === 0}
                      isLast={i === items.length - 1}
                      processing={processing}
                      Icon={Icon}
                      onMove={move}
                      onRemove={remove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              {processing ? "Processing…" : actionLabel}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel" role="status" aria-live="polite">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your file is ready</h2>
            <p>
              {resultCount} {resultNoun}
              {resultCount === 1 ? "" : "s"} {resultCount === 1 ? "was" : "were"} {resultVerb} successfully. Your
              download should start automatically.
            </p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download={resultFilename}>
                <Download size={18} /> Download {resultFilename}
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Start another
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}

function SortableFileRow({
  item,
  index,
  isFirst,
  isLast,
  processing,
  Icon,
  onMove,
  onRemove
}: {
  item: StagedFile;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  processing: boolean;
  Icon: typeof FileText;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`file-row ${isDragging ? "dragging" : ""}`}>
      <span className="grip" {...attributes} {...listeners} aria-label={`Drag to reorder ${item.file.name}`}>
        <GripVertical size={18} />
      </span>
      <div className="file-icon">
        <Icon size={20} />
      </div>
      <div className="file-info">
        <strong>
          {index + 1}. {item.file.name}
        </strong>
        <span>{(item.file.size / 1048576).toFixed(2)} MB</span>
      </div>
      <button type="button" className="move-btn" disabled={isFirst || processing} onClick={() => onMove(index, -1)} aria-label="Move up">
        ↑
      </button>
      <button type="button" className="move-btn" disabled={isLast || processing} onClick={() => onMove(index, 1)} aria-label="Move down">
        ↓
      </button>
      <button type="button" className="icon-btn" disabled={processing} onClick={() => onRemove(item.id)} aria-label="Remove">
        <Trash2 size={17} />
      </button>
    </div>
  );
}
