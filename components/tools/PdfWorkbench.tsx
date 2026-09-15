"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AppWindow, Camera, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, GripVertical, ImageUp, Images, Loader2,
  Monitor, RefreshCw, Scan, Settings2, Trash2, X
} from "lucide-react";
import { CheckboxRow, RadioRow, SelectField, SplitChoice } from "@/components/ui/Fields";
import { EditorAlert, PanelTitle } from "@/components/ui/EditorParts";
import { LandscapePage, PortraitPage } from "@/components/ui/Glyphs";
import { InfoRail } from "@/components/ui/InfoRail";
import { Pager } from "@/components/ui/PreviewFrame";
import { SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { CropStage } from "@/components/tools/CropWorkbench";
import { errorMessage } from "@/components/tools/EditorShell";
import { useImageInput } from "@/components/tools/useImageInput";
import { CaptureCancelled, canCapture, captureScreen, type CaptureSurface } from "@/lib/capture";
import { cropImage } from "@/lib/canvas/editor";
import { canvasToBlob, downloadBlob } from "@/lib/canvas/encode";
import { loadFile, releaseImage } from "@/lib/canvas/load";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";
import { defaultsFor } from "@/lib/defaults";
import { baseName, formatBytes } from "@/lib/format";
import { initialCrop, NO_CHANGE, normalizeRect, type Rect } from "@/lib/geometry";
import { buildPdf, formatStamp, layoutPages } from "@/lib/pdf";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";

const MAX_IMAGES = 20;
/** The preview sheet is drawn this tall, then scaled to the real page ratio. */
const SHEET_HEIGHT = 300;

type Mode = "upload" | "monitor" | "window" | "area";

const CAPTURE_MODES: { value: Mode; label: string; icon: React.ReactNode; note: string }[] = [
  { value: "upload", label: "Upload Images", icon: <ImageUp size={16} />, note: "" },
  { value: "monitor", label: "Capture Screen", icon: <Monitor size={16} />, note: "Capture everything on one of your screens." },
  { value: "window", label: "Capture Window", icon: <AppWindow size={16} />, note: "Capture a single application window." },
  { value: "area", label: "Capture Area", icon: <Scan size={16} />, note: "Capture a screen, then drag to keep just the part you need." }
];

const MARGIN_CHOICES = [
  { value: "0", label: "None" },
  { value: "5", label: "Narrow (5 mm)" },
  { value: "10", label: "Normal (10 mm)" },
  { value: "20", label: "Wide (20 mm)" }
];

const flag = (options: ToolOptions, key: string) => options[key] === true || options[key] === "true";
const noop = () => () => {};

type Built = { key: string; blob: Blob; url: string; pages: number; name: string };

export function PdfWorkbench({ tool }: { tool: ToolDefinition }) {
  const screenshots = tool.id === "screenshot-to-pdf";
  const input = useImageInput({ multiple: true, max: MAX_IMAGES });
  const { images } = input;
  const [options, setOptions] = useState<ToolOptions>(() => defaultsFor(tool.id));
  const [mode, setMode] = useState<Mode>("upload");
  const [capturing, setCapturing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [area, setArea] = useState<{ source: SourceImage; rect: Rect } | null>(null);
  const [requestedPage, setPage] = useState(1);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<Built | null>(null);
  const liveUrl = useRef<string | null>(null);
  // The server has no screen to capture; the browser decides after hydration.
  const captureSupported = useSyncExternalStore(noop, canCapture, () => false);

  useEffect(() => () => { if (liveUrl.current) URL.revokeObjectURL(liveUrl.current); }, []);

  const set = (key: string, value: string | number | boolean) => setOptions((current) => ({ ...current, [key]: value }));
  const pages = useMemo(() => layoutPages(images, options), [images, options]);
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, pages.length));
  const current = pages[page - 1];
  const key = JSON.stringify([options, images.map((image) => image.id)]);
  const result = built && built.key === key ? built : null;
  const original = String(options.pageSize ?? "a4") === "original";

  async function capture(surface: CaptureSurface, keepArea: boolean) {
    setCapturing(true);
    setNote("");
    setError("");
    try {
      const file = await captureScreen(surface);
      if (keepArea) {
        const source = await loadFile(file);
        setArea({ source, rect: initialCrop(source, null) });
      } else {
        await input.addFiles([file]);
        setNote(`Added ${file.name}.`);
      }
    } catch (cause) {
      if (cause instanceof CaptureCancelled) setNote("Capture cancelled. Nothing was added.");
      else setError(errorMessage(cause, "The screen could not be captured."));
    } finally {
      setCapturing(false);
    }
  }

  async function keepSelection() {
    if (!area) return;
    const canvas = cropImage(area.source.element, normalizeRect(area.rect, area.source));
    const blob = await canvasToBlob(canvas, "image/png", 100);
    await input.addFiles([new File([blob], area.source.name.replace(/\.png$/i, "-area.png"), { type: "image/png" })]);
    releaseImage(area.source);
    setArea(null);
    setNote("Selection added.");
  }

  function discardSelection() {
    if (area) releaseImage(area.source);
    setArea(null);
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const blob = await buildPdf(images, options);
      if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
      const url = URL.createObjectURL(blob);
      liveUrl.current = url;
      const name = images.length === 1 ? baseName(images[0].name) : screenshots ? `screenshots-${formatStamp(new Date()).slice(0, 10)}` : "images";
      setBuilt({ key, blob, url, pages: pages.length, name: `${name}.pdf` });
    } catch (cause) {
      setError(errorMessage(cause, "The PDF could not be created."));
    } finally {
      setBusy(false);
    }
  }

  function drop(to: number) {
    if (dragIndex !== null && dragIndex !== to) input.reorder(dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
  }

  const step = (number: number, text: string) => (screenshots ? `${number}. ${text}` : text);
  const active = CAPTURE_MODES.find((item) => item.value === mode) ?? CAPTURE_MODES[0];

  return (
    <div className="workspace">
      <div className="workspace-main">
        <section className="card editor-card" aria-label="Add images">
          <PanelTitle icon={<ImageUp size={18} />} title={screenshots ? step(1, "Capture or Upload Screenshots") : "Add Images"} />

          {screenshots && (
            <div className="seg-tabs capture-tabs" role="tablist" aria-label="How to add screenshots">
              {CAPTURE_MODES.map((item) => (
                <button key={item.value} type="button" role="tab" aria-selected={mode === item.value} onClick={() => setMode(item.value)}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}

          {mode === "upload" ? (
            <>
              <UploadZone
                multiple
                accept="image/*"
                label="Choose Images"
                hint={acceptedFormats(tool)}
                maxNote={`Max ${MAX_IMAGES} images · 32 MB each · combined in order`}
                onFiles={input.addFiles}
              />
              {!images.length && <SampleStrip samples={samplesFor(tool.id)} activeSrc={input.sampleSrc} onPick={input.addSample} />}
            </>
          ) : area ? (
            <div className="area-select">
              <p className="editor-note"><b>Drag to select the area to keep.</b> Everything outside the box is discarded.</p>
              <CropStage
                image={area.source}
                orientation={NO_CHANGE}
                bounds={area.source}
                rect={area.rect}
                ratio={null}
                zoom={100}
                onChange={(rect) => setArea((current) => (current ? { ...current, rect } : current))}
              />
              <div className="area-actions">
                <button type="button" className="btn btn-outline" onClick={discardSelection}>Discard</button>
                <button type="button" className="btn btn-primary" onClick={keepSelection}><CheckCircle2 size={16} aria-hidden /> Add Selection</button>
              </div>
            </div>
          ) : (
            <div className="capture-panel">
              <span className="capture-icon" aria-hidden>{active.icon}</span>
              <b>{active.label}</b>
              <p>{active.note}</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!captureSupported || capturing || images.length >= MAX_IMAGES}
                onClick={() => capture(mode === "window" ? "window" : "monitor", mode === "area")}
              >
                {capturing ? <Loader2 size={16} className="spin" aria-hidden /> : <Camera size={16} aria-hidden />}
                {capturing ? "Waiting for your choice…" : "Take Screenshot"}
              </button>
              <small>
                {captureSupported
                  ? "Your browser asks what to share. One frame is taken and sharing stops immediately; nothing is recorded or uploaded."
                  : "Screen capture is not available in this browser. Upload screenshots instead."}
              </small>
            </div>
          )}
          {note && <p className="editor-note" role="status">{note}</p>}
          <EditorAlert message={input.error || error} />
        </section>

        {images.length > 0 && (
          <section className="card editor-card" aria-label="Arrange images">
            <PanelTitle
              icon={<Images size={18} />}
              title={screenshots ? step(2, `Arrange Screenshots (${images.length})`) : `Your Images (${images.length})`}
              actions={<button type="button" className="btn btn-outline btn-sm" onClick={input.clear}><Trash2 size={14} /> Clear all</button>}
            />
            <ol className="arrange-grid">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className={`arrange-card ${dragIndex === index ? "is-dragging" : ""} ${overIndex === index && dragIndex !== index ? "is-over" : ""}`}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  onDragOver={(event) => { event.preventDefault(); setOverIndex(index); }}
                  onDrop={(event) => { event.preventDefault(); drop(index); }}
                >
                  <div className="arrange-thumb">
                    <img src={image.url} alt="" />
                    <span className="arrange-index" aria-hidden>{index + 1}</span>
                    <span className="arrange-grip" aria-hidden><GripVertical size={16} /></span>
                    <button type="button" className="arrange-remove" aria-label={`Remove ${image.name}`} onClick={() => input.remove(image.id)}><X size={14} /></button>
                  </div>
                  <b title={image.name}>{image.name}</b>
                  <small>{formatBytes(image.size)} · {image.width} × {image.height}</small>
                  <span className="arrange-move">
                    <button type="button" aria-label={`Move ${image.name} earlier`} disabled={index === 0} onClick={() => input.reorder(index, index - 1)}><ChevronLeft size={14} /></button>
                    <button type="button" aria-label={`Move ${image.name} later`} disabled={index === images.length - 1} onClick={() => input.reorder(index, index + 1)}><ChevronRight size={14} /></button>
                  </span>
                </li>
              ))}
            </ol>
            <span className="field-help">Drag the cards, or use the arrows, to set the page order.</span>
          </section>
        )}

        <section className="card editor-card" aria-label="PDF settings">
          <PanelTitle
            icon={<Settings2 size={18} />}
            title={step(3, "PDF Settings")}
            actions={<button type="button" className="ghost-button" onClick={() => setOptions(defaultsFor(tool.id))}><RefreshCw size={14} /> Reset</button>}
          />
          <div className="pdf-settings">
            <div className="pdf-settings-fields">
              <SelectField
                label="Page size"
                value={String(options.pageSize ?? "a4")}
                onChange={(value) => set("pageSize", value)}
                options={[
                  { value: "a4", label: "A4 (210 × 297 mm)" },
                  { value: "letter", label: "Letter (8.5 × 11 in)" },
                  { value: "legal", label: "Legal (8.5 × 14 in)" },
                  { value: "a3", label: "A3 (297 × 420 mm)" },
                  { value: "a5", label: "A5 (148 × 210 mm)" },
                  { value: "original", label: "Original image size" }
                ]}
              />
              {!original ? (
                <SplitChoice
                  label="Orientation"
                  value={String(options.orientation ?? "portrait")}
                  onChange={(value) => set("orientation", value)}
                  options={[
                    { value: "portrait", label: "Portrait", icon: <PortraitPage /> },
                    { value: "landscape", label: "Landscape", icon: <LandscapePage /> }
                  ]}
                />
              ) : <div className="field"><span className="field-label">Orientation</span><p className="editor-note">Each page takes the shape of its image.</p></div>}
              <SelectField
                label="Image fit"
                value={String(options.fit ?? "fit")}
                onChange={(value) => set("fit", value)}
                options={[
                  { value: "fit", label: "Fit to page" },
                  { value: "fill", label: "Fill page (crop edges)" },
                  { value: "stretch", label: "Stretch to page" },
                  { value: "actual", label: "Actual size" }
                ]}
              />
              <SelectField label="Page margin" value={String(options.margin ?? 10)} onChange={(value) => set("margin", Number(value))} options={MARGIN_CHOICES} />
              <RadioRow
                label="Page order"
                value={String(options.order ?? "selected")}
                onChange={(value) => set("order", value)}
                options={[{ value: "selected", label: "As arranged" }, { value: "alphabetical", label: "By file name" }]}
              />
              <div className="pdf-flags">
                <CheckboxRow label="Add page numbers" checked={flag(options, "pageNumbers")} onChange={(value) => set("pageNumbers", value)} />
                <CheckboxRow label="Add date & time" checked={flag(options, "timestamp")} onChange={(value) => set("timestamp", value)} />
                <CheckboxRow label="Add file names" note="As a caption under each image" checked={flag(options, "captions")} onChange={(value) => set("captions", value)} />
                <CheckboxRow label="Create single page" note="Combine every image on one page" checked={flag(options, "mergeToOnePage")} onChange={(value) => set("mergeToOnePage", value)} />
              </div>
            </div>

            <div className="pdf-preview" aria-label="Page preview">
              {!current ? (
                <div className="pdf-preview-empty"><FileText size={30} aria-hidden /><span>Add images to preview the pages.</span></div>
              ) : (
                <>
                  <div className="page-preview">
                    <div className="page-sheet" style={{ height: SHEET_HEIGHT, width: (SHEET_HEIGHT * current.pageWidth) / current.pageHeight, position: "relative" }}>
                      {current.slots.map((slot, index) => (
                        <div key={`${slot.image.id}-${index}`}>
                          <img
                            src={slot.image.url}
                            alt={slot.image.name}
                            style={{
                              position: "absolute",
                              left: `${(slot.x / current.pageWidth) * 100}%`,
                              top: `${(slot.y / current.pageHeight) * 100}%`,
                              width: `${(slot.width / current.pageWidth) * 100}%`,
                              height: `${(slot.height / current.pageHeight) * 100}%`
                            }}
                          />
                          {slot.caption && (
                            <span
                              className="page-caption"
                              style={{
                                left: `${(slot.x / current.pageWidth) * 100}%`,
                                top: `${((slot.y + slot.height + 3) / current.pageHeight) * 100}%`,
                                width: `${(slot.width / current.pageWidth) * 100}%`
                              }}
                            >
                              {slot.caption}
                            </span>
                          )}
                        </div>
                      ))}
                      {flag(options, "pageNumbers") && <span className="page-number">{page} / {pages.length}</span>}
                      {flag(options, "timestamp") && <span className="page-stamp">Date &amp; time</span>}
                    </div>
                  </div>
                  <Pager page={page} total={pages.length} onChange={setPage} />
                </>
              )}
            </div>
          </div>

          <button type="button" className="btn btn-primary btn-block-lg" disabled={!images.length || busy} onClick={create}>
            {busy ? <Loader2 size={18} className="spin" aria-hidden /> : <FileText size={18} aria-hidden />} {tool.action}
          </button>

          {result && (
            <div className="queue-summary" aria-live="polite">
              <span>
                <strong>Your PDF is ready</strong> · {result.pages} page{result.pages === 1 ? "" : "s"} · {formatBytes(result.blob.size)}
              </span>
              <button type="button" className="btn btn-success" onClick={() => downloadBlob(result.blob, result.name)}>
                <Download size={16} aria-hidden /> Download PDF
              </button>
            </div>
          )}
        </section>
      </div>

      <aside className="rail" aria-label={`About ${tool.name}`}>
        <InfoRail tool={tool} include={["reasons", "formats", "tips", "feedback"]} />
      </aside>
    </div>
  );
}
