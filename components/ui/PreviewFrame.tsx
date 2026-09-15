"use client";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Maximize2, Minus, Plus, ZoomIn } from "lucide-react";

const STEPS = [25, 50, 75, 100, 150, 200, 300];

export function ZoomBar({ zoom, onZoom, onFit }: { zoom: number; onZoom: (value: number) => void; onFit: () => void }) {
  const index = STEPS.findIndex((step) => step >= zoom);
  return (
    <div className="zoom-bar">
      <button type="button" aria-label="Zoom presets" onClick={() => onZoom(100)}><ZoomIn size={16} /></button>
      <button type="button" aria-label="Zoom out" disabled={zoom <= STEPS[0]} onClick={() => onZoom(STEPS[Math.max(0, index - 1)])}><Minus size={16} /></button>
      <output aria-label="Zoom level">{zoom}%</output>
      <button type="button" aria-label="Zoom in" disabled={zoom >= STEPS[STEPS.length - 1]} onClick={() => onZoom(STEPS[Math.min(STEPS.length - 1, index + 1)])}><Plus size={16} /></button>
      <button type="button" aria-label="Fit to frame" onClick={onFit}><Maximize2 size={15} /></button>
    </div>
  );
}

export function PreviewEmpty({ message = "Choose an image to see the preview." }: { message?: string }) {
  return (
    <div className="preview-stage">
      <div className="preview-empty">
        <ImageIcon size={34} strokeWidth={1.4} />
        <span>{message}</span>
      </div>
    </div>
  );
}

/** Single-image stage with its own zoom control. */
export function PreviewStage({ children, zoom = 100, transparent = false }: { children: ReactNode; zoom?: number; transparent?: boolean }) {
  return (
    <div className={`preview-stage ${transparent ? "checkerboard" : ""}`}>
      <div style={{ width: `${zoom}%`, display: "grid", placeItems: "center", maxWidth: zoom > 100 ? "none" : "100%" }}>
        {children}
      </div>
    </div>
  );
}

export function ComparePanes({ beforeLabel, afterLabel, before, after, transparentAfter = false }: {
  beforeLabel: string; afterLabel: string; before: ReactNode; after: ReactNode; transparentAfter?: boolean;
}) {
  return (
    <div className="compare-grid">
      <div className="compare-pane">
        <span>{beforeLabel}</span>
        <div className="preview-stage">{before}</div>
      </div>
      <div className="compare-pane">
        <span>{afterLabel}</span>
        <div className={`preview-stage ${transparentAfter ? "checkerboard" : ""}`}>{after}</div>
      </div>
    </div>
  );
}

export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="pager">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={17} /></button>
      <span>{page} / {total}</span>
      <button type="button" aria-label="Next page" disabled={page >= total} onClick={() => onChange(page + 1)}><ChevronRight size={17} /></button>
    </div>
  );
}

export function useZoom(initial = 100) {
  const [zoom, setZoom] = useState(initial);
  return { zoom, setZoom, reset: () => setZoom(initial) };
}
