"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, type ReactNode } from "react";
import { CheckCircle2, Download, ImageUp, Loader2, Plus, RefreshCw, Share2, X } from "lucide-react";
import type { SourceImage } from "@/lib/canvas/types";

/** Card heading with an outline glyph and optional trailing controls. */
export function PanelTitle({ icon, title, actions }: { icon: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <div className="panel-title">
      <span className="panel-title-icon" aria-hidden>{icon}</span>
      <h2>{title}</h2>
      {actions && <div className="panel-title-actions">{actions}</div>}
    </div>
  );
}

/** Dark translucent label laid over a preview image. */
export function ImageBadge({ children, position = "top-right" }: { children: ReactNode; position?: "top-right" | "bottom-right" | "top-left" }) {
  return <span className={`image-badge is-${position}`}>{children}</span>;
}

/** Thumbnails of every loaded image, plus an "Add More" tile that opens the picker. */
export function ThumbStrip({ items, activeId, onSelect, onRemove, onFiles, accept = "image/*", max = 20, addLabel = "Add More" }: {
  items: SourceImage[];
  activeId?: string;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  onFiles: (files: File[]) => void;
  accept?: string;
  max?: number;
  addLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="thumb-strip" role="listbox" aria-label="Loaded images">
      {items.map((item) => (
        <div className="thumb-wrap" key={item.id}>
          <button
            type="button"
            role="option"
            aria-selected={item.id === activeId}
            className="thumb"
            title={`${item.name} — ${item.width} × ${item.height}`}
            onClick={() => onSelect(item.id)}
          >
            <img src={item.url} alt={item.name} />
          </button>
          {onRemove && (
            <button type="button" className="thumb-remove" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
              <X size={12} strokeWidth={2.6} />
            </button>
          )}
        </div>
      ))}
      {items.length < max && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files?.length) onFiles(Array.from(event.target.files));
              event.target.value = "";
            }}
          />
          <button type="button" className="thumb thumb-add" onClick={() => inputRef.current?.click()}>
            <Plus size={20} aria-hidden />
            <span>{addLabel}</span>
          </button>
        </>
      )}
    </div>
  );
}

export type Choice = { value: string; label: string; icon?: ReactNode };

export const OUTPUT_CHOICES: Choice[] = [
  { value: "auto", label: "Keep original" },
  { value: "jpeg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" }
];

/** A row of equal pill buttons that behaves as one radio group. */
export function ChipGroup({ label, value, choices, onChange, columns }: {
  label?: string;
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
  columns?: number;
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div
        className="chip-row"
        role="radiogroup"
        aria-label={label}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={value === choice.value}
            className="chip"
            onClick={() => onChange(choice.value)}
          >
            {choice.icon}
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Large icon tiles: rotation steps, flip directions, quick actions. */
export function ActionTiles({ items, columns = 3, label }: {
  label?: string;
  columns?: number;
  items: { key: string; icon: ReactNode; title: string; note?: string; pressed?: boolean; onClick: () => void }[];
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="action-tiles" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className="action-tile"
            aria-pressed={item.pressed}
            onClick={item.onClick}
          >
            <span aria-hidden>{item.icon}</span>
            <b>{item.title}</b>
            {item.note && <small>{item.note}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Empty left panel: the drop zone and the samples, shown until an image arrives. */
export function EmptyPanel({ children }: { children: ReactNode }) {
  return <div className="editor-empty">{children}</div>;
}

export type Detail = { label: string; value: ReactNode };

/**
 * The finished file: thumbnail, what changed, and the ways to take it away.
 * Sizes shown here are of the actual encoded blob that Download saves.
 */
export function ResultPanel({ title, thumbUrl, thumbBadge, transparent, details, highlight, success, onDownload, downloadLabel = "Download Image", busy, onProcessAnother, onShare, extra }: {
  title: string;
  thumbUrl: string;
  thumbBadge?: string;
  transparent?: boolean;
  details: Detail[];
  highlight?: { value: string; label: string; tone?: "good" | "neutral" };
  success: string;
  onDownload: () => void;
  downloadLabel?: string;
  busy?: boolean;
  onProcessAnother: () => void;
  onShare?: () => void;
  extra?: ReactNode;
}) {
  return (
    <section className="card result-panel" aria-live="polite">
      <PanelTitle icon={<ImageUp size={18} />} title={title} />
      <div className="result-body">
        <figure className={`result-thumb ${transparent ? "checkerboard" : ""}`}>
          <img src={thumbUrl} alt="Processed result" />
          {thumbBadge && <ImageBadge position="top-right">{thumbBadge}</ImageBadge>}
        </figure>

        <div className="result-details">
          <h3>Result Details</h3>
          <dl>
            {details.map((detail) => (
              <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>
            ))}
          </dl>
          {highlight && (
            <div className={`result-highlight ${highlight.tone === "neutral" ? "is-neutral" : ""}`}>
              <strong>{highlight.value}</strong>
              <small>{highlight.label}</small>
            </div>
          )}
        </div>

        <div className="result-actions">
          <p className="success-pill"><CheckCircle2 size={16} aria-hidden /> {success}</p>
          <button type="button" className="btn btn-success" disabled={busy} onClick={onDownload}>
            {busy ? <Loader2 size={17} className="spin" aria-hidden /> : <Download size={17} aria-hidden />} {downloadLabel}
          </button>
          <button type="button" className="btn btn-outline" onClick={onProcessAnother}>
            <RefreshCw size={16} aria-hidden /> Process Another
          </button>
          {onShare && (
            <button type="button" className="btn btn-outline" onClick={onShare}>
              <Share2 size={16} aria-hidden /> Share Result
            </button>
          )}
          {extra}
        </div>
      </div>
    </section>
  );
}

/** Inline error banner for the editors, which have no status bar. */
export function EditorAlert({ message }: { message: string }) {
  if (!message) return null;
  return <p className="editor-alert" role="alert">{message}</p>;
}

/** Shares a file through the OS sheet where the browser supports it. */
export function canShareFiles() {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], "probe.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

export async function shareFile(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: name });
  } catch (cause) {
    // Dismissing the share sheet rejects with AbortError; that is not a failure.
    if (!(cause instanceof DOMException && cause.name === "AbortError")) throw cause;
  }
}
