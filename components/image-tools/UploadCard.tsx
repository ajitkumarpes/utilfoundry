"use client";
/* eslint-disable @next/next/no-img-element */

import { CheckCircle2, FileImage, ImageIcon, UploadCloud } from "lucide-react";
import type { RefObject } from "react";
import type { ToolDefinition } from "@/lib/tools";

type UploadCardProps = {
  tool: ToolDefinition;
  file: File | null;
  base64: string;
  previewUrl: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onBase64Change: (value: string) => void;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
  title: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadCard({ tool, file, base64, previewUrl, inputRef, onBase64Change, onFile, onClear, title }: UploadCardProps) {
  return (
    <section className="upload-card">
      {tool.needsBase64 ? (
        <label className="base64-input"><span>Base64 image payload</span><textarea value={base64} onChange={(event) => onBase64Change(event.target.value)} placeholder="data:image/png;base64,..." spellCheck={false} /></label>
      ) : (
        <button className={`upload-zone ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFile(event.dataTransfer.files?.[0]); }}>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => onFile(event.target.files?.[0])} />
          {file ? <><FileImage size={46} /><strong>{file.name}</strong><small>{formatBytes(file.size)} · click to replace</small></> : <><UploadCloud size={49} /><strong>Drop your image here</strong><small>or click to choose a file</small><span className="choose-button"><ImageIcon size={17} /> Choose Image</span><em>Supports JPG, PNG, WebP, AVIF, GIF, TIFF <b>·</b> Max 32 MB</em></>}
        </button>
      )}
      {file && previewUrl && <div className="preview-strip"><img src={previewUrl} alt="Selected image preview" /><div><strong>{file.name}</strong><small>{formatBytes(file.size)} · ready for {title.toLowerCase()}</small></div><span className="ready-status"><CheckCircle2 size={15} /> Ready</span><button aria-label="Remove selected image" onClick={(event) => { event.stopPropagation(); onClear(); }}>×</button></div>}
    </section>
  );
}
