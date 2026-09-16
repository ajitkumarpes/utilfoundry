"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { GripVertical, ImageIcon, Trash2, UploadCloud, X } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { SourceImage } from "@/lib/canvas/types";
import type { Sample } from "@/lib/samples";

type UploadZoneProps = {
  multiple: boolean;
  accept: string;
  hint: string;
  maxNote: string;
  label: string;
  onFiles: (files: File[]) => void;
  /** Once an image is loaded: a slim "replace" bar instead of the full drop area, so the preview stays in view. */
  compact?: boolean;
};

export function UploadZone({ multiple, accept, hint, maxNote, label, onFiles, compact = false }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(list: FileList | null) {
    if (!list?.length) return;
    onFiles(Array.from(list));
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => { take(event.target.files); event.target.value = ""; }}
      />
      <button
        type="button"
        className={`upload-zone ${compact ? "is-compact" : ""} ${dragging ? "is-dragging" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); take(event.dataTransfer.files); }}
      >
        {compact ? (
          <>
            <UploadCloud size={22} strokeWidth={1.8} />
            <span className="upload-compact-text">
              <strong>{multiple ? "Add more images" : "Replace the image"}</strong>
              <small>Drop {multiple ? "files" : "a file"} here or click to choose · {hint}</small>
            </span>
            <span className="upload-cta"><ImageIcon size={15} /> {multiple ? "Add" : "Choose"}</span>
          </>
        ) : (
          <>
            <UploadCloud size={44} strokeWidth={1.6} />
            <strong>{multiple ? "Drag & drop your images here" : "Drag & drop your image here"}</strong>
            <small>or click to choose {multiple ? "files" : "a file"}</small>
            <span className="upload-cta"><ImageIcon size={17} /> {label}</span>
            <span className="upload-hint">Supports {hint}<br />{maxNote}</span>
          </>
        )}
      </button>
    </>
  );
}

export function SampleStrip({ samples, activeSrc, onPick }: {
  samples: Sample[];
  activeSrc?: string;
  onPick: (sample: Sample) => void;
}) {
  return (
    <div className="sample-strip">
      <span>Try with a sample:</span>
      <div className="sample-thumbs">
        {samples.map((sample) => (
          <button key={sample.src} type="button" aria-pressed={activeSrc === sample.src} aria-label={`Use sample: ${sample.alt}`} onClick={() => onPick(sample)}>
            <img src={sample.src} alt={sample.alt} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FileList({ items, onRemove, onClear, onReorder }: {
  items: SourceImage[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onReorder?: (from: number, to: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <div className="field">
      <div className="file-list-head">
        <strong>Selected image{items.length === 1 ? "" : "s"} ({items.length})</strong>
        <button type="button" className="link-button" onClick={onClear}><Trash2 size={13} /> Clear all</button>
      </div>
      <ul className="file-list">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={`file-row ${dragIndex === index ? "is-dragging" : ""} ${overIndex === index && dragIndex !== index ? "is-over" : ""}`}
            draggable={Boolean(onReorder)}
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            onDragOver={(event) => { if (onReorder) { event.preventDefault(); setOverIndex(index); } }}
            onDrop={(event) => {
              event.preventDefault();
              if (onReorder && dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            {onReorder && <span className="drag-handle" aria-hidden><GripVertical size={15} /></span>}
            <img src={item.url} alt="" />
            <span className="file-row-text">
              <strong>{item.name}</strong>
              <small>{formatBytes(item.size)} · {item.width} × {item.height}</small>
            </span>
            <button type="button" className="file-remove" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      {onReorder && items.length > 1 && <span className="field-help">Drag the rows to change the page order.</span>}
    </div>
  );
}
