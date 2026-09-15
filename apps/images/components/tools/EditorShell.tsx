"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { InfoRail } from "@/components/ui/InfoRail";
import { SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { EditorAlert, ImageBadge, PanelTitle, ThumbStrip } from "@/components/ui/EditorParts";
import type { EditorImages } from "@/components/tools/useEditorImages";
import type { Encoded } from "@/lib/canvas/editor";
import type { SourceImage } from "@/lib/canvas/types";
import { formatBytes } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";

/** "image/jpeg" → "JPG". */
export function formatLabel(type: string) {
  const sub = (type.split("/")[1] ?? "").replace("jpeg", "jpg").replace("svg+xml", "svg").replace("x-icon", "ico");
  return sub ? sub.toUpperCase() : "IMAGE";
}

/** "4032 × 3024 · 2.4 MB · JPG", the caption laid over a preview. */
export function describeImage(image: SourceImage) {
  return `${image.width} × ${image.height} · ${formatBytes(image.size)} · ${formatLabel(image.type)}`;
}

/** Signed size change, e.g. "−62%" or "+4%". */
export function sizeChange(before: number, after: number) {
  if (!before) return "";
  const change = Math.round(((after - before) / before) * 100);
  if (change === 0) return "±0%";
  return `${change < 0 ? "−" : "+"}${Math.abs(change)}%`;
}

/** A pixel input that can be cleared and retyped; it commits whenever the text is a valid number. */
export function PixelField({ label, value, onCommit, min = 0 }: { label: string; value: number; onCommit: (value: number) => void; min?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <input
        className="control"
        type="number"
        inputMode="numeric"
        min={min}
        aria-label={label}
        value={draft ?? String(Math.round(value))}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value);
          if (event.target.value !== "" && Number.isFinite(next) && next >= min) onCommit(next);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

/** Shown in place of the preview until the first image arrives. */
function UploadCard({ tool, images }: { tool: ToolDefinition; images: EditorImages }) {
  return (
    <>
      <PanelTitle icon={<UploadCloud size={18} />} title="Upload Image" />
      <UploadZone
        multiple
        accept="image/*"
        label="Choose Image"
        hint={acceptedFormats(tool)}
        maxNote="Max 32 MB per file · up to 20 images"
        onFiles={images.addFiles}
      />
      <SampleStrip samples={samplesFor(tool.id)} activeSrc={images.sampleSrc} onPick={images.addSample} />
      {images.loading && <p className="editor-note"><Loader2 size={13} className="spin" aria-hidden /> Reading image…</p>}
      <EditorAlert message={images.error} />
    </>
  );
}

/**
 * Two columns — the image on the left, the tool's settings on the right — with
 * optional full-width cards underneath and the explanatory rail beside it all.
 */
export function EditorShell({ tool, images, preview, settings, below, railTop }: {
  tool: ToolDefinition;
  images: EditorImages;
  preview: ReactNode;
  settings: ReactNode;
  below?: ReactNode;
  railTop?: ReactNode;
}) {
  return (
    <div className="workspace">
      <div className="workspace-main">
        <div className="editor-grid">
          <section className="card editor-card" aria-label="Image">
            {images.active ? (
              <>
                {preview}
                <EditorAlert message={images.error} />
              </>
            ) : <UploadCard tool={tool} images={images} />}
          </section>
          <section className="card editor-card" aria-label={`${tool.name} settings`}>{settings}</section>
        </div>
        {below}
      </div>
      <aside className="rail" aria-label={`About ${tool.name}`}>
        {railTop}
        <InfoRail tool={tool} include={["reasons", "formats", "tips", "feedback"]} />
      </aside>
    </div>
  );
}

/** The preview surface with its corner badges. Pass children to replace the plain image. */
export function ImageStage({ image, label, meta, transparent, children }: {
  image: SourceImage;
  label?: string;
  meta?: string;
  transparent?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`editor-stage ${transparent ? "checkerboard" : ""}`}>
      {children ?? <img src={image.url} alt={image.name} />}
      {label && <ImageBadge position="top-right">{label}</ImageBadge>}
      {meta && <ImageBadge position="bottom-right">{meta}</ImageBadge>}
    </div>
  );
}

export function EditorThumbs({ images, addLabel }: { images: EditorImages; addLabel?: string }) {
  return (
    <ThumbStrip
      items={images.images}
      activeId={images.active?.id}
      onSelect={images.select}
      onRemove={images.remove}
      onFiles={images.addFiles}
      addLabel={addLabel}
    />
  );
}

export function FileCaption({ image, onRemove }: { image: SourceImage; onRemove?: () => void }) {
  return (
    <div className="file-caption">
      <span>
        <b>{image.name}</b>
        <small>{formatBytes(image.size)} · {image.width} × {image.height}</small>
      </span>
      {onRemove && (
        <button type="button" className="icon-danger" aria-label={`Remove ${image.name}`} onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * An encoded result plus what produced it. `key` is the settings fingerprint:
 * once the settings move on, the result no longer describes them and is hidden.
 */
export type Finished = Encoded & { name: string; key: string; sourceId: string };

/** Holds the latest result and revokes its object URL when it is replaced. */
export function useFinished() {
  const [finished, setFinished] = useState<Finished | null>(null);
  const live = useRef<Finished | null>(null);

  useEffect(() => () => {
    if (live.current) URL.revokeObjectURL(live.current.url);
  }, []);

  const replace = useCallback((next: Finished | null) => {
    if (live.current && live.current.url !== next?.url) URL.revokeObjectURL(live.current.url);
    live.current = next;
    setFinished(next);
  }, []);

  return [finished, replace] as const;
}

/** "Process Another": move to the next loaded image, or back to the upload card. */
export function processAnother(images: EditorImages, clear: () => void) {
  clear();
  if (images.next) images.select(images.next.id);
  else images.clear();
}

export function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
