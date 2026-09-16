"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  Crop, FlipHorizontal2, FlipVertical2, Link2, Loader2, Maximize2, Minus, Plus, RefreshCw, RotateCcw, RotateCw, Settings2, Unlink2
} from "lucide-react";
import { RangeField } from "@/components/ui/Fields";
import { ActionTiles, ChipGroup, EditorAlert, OUTPUT_CHOICES, PanelTitle, ResultPanel } from "@/components/ui/EditorParts";
import {
  EditorShell, EditorThumbs, FileCaption, PixelField, errorMessage, processAnother, sizeChange, useFinished
} from "@/components/tools/EditorShell";
import { useEditorImages } from "@/components/tools/useEditorImages";
import { downloadBlob } from "@/lib/canvas/encode";
import { cropImage, encodeResult, FORMAT_NAME, orient, resolveOutputFormat } from "@/lib/canvas/editor";
import type { SourceImage } from "@/lib/canvas/types";
import { baseName, formatBytes } from "@/lib/format";
import {
  applyOrientation, ASPECT_PRESETS, dragRect, fitToRatio, HANDLES, initialCrop, NO_CHANGE, normalizeRect, rotatedSize,
  type Handle, type Orientation, type Rect, type Size
} from "@/lib/geometry";
import type { ToolDefinition } from "@/lib/tools";

const LOSSY = new Set(["jpeg", "webp", "avif"]);
const STAGE_MAX_HEIGHT = 480;
const PREVIEW_SIDE = 1600;
const ZOOM_STEPS = [50, 75, 100, 150, 200, 300, 400];

/** `last` is the rectangle the latest move produced, which the prop may not reflect yet. */
type Drag = { handle: Handle; startX: number; startY: number; start: Rect; last?: Rect };

/** The image with the selection drawn over it. All geometry is in image pixels. */
export function CropStage({ image, orientation, bounds, rect, ratio, zoom, onChange }: {
  image: SourceImage;
  orientation: Orientation;
  bounds: Size;
  rect: Rect;
  ratio: number | null;
  zoom: number;
  onChange: (rect: Rect) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = holder.current;
    if (!target) return;
    const scale = Math.min(1, PREVIEW_SIDE / Math.max(image.width, image.height));
    const canvas = orient(image.element, image, orientation, { scale });
    canvas.setAttribute("aria-hidden", "true");
    target.replaceChildren(canvas);
  }, [image, orientation]);

  // "100%" means the whole image fits the frame; zooming scrolls within it.
  const fitWidth = Math.max(1, Math.min(available || 640, (STAGE_MAX_HEIGHT * bounds.width) / bounds.height));
  const width = fitWidth * (zoom / 100);
  const scale = width / bounds.width;

  function toImage(event: PointerEvent) {
    const box = stage.current!.getBoundingClientRect();
    return { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale };
  }

  function begin(event: PointerEvent, handle: Handle) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // preventDefault also stops the browser focusing the box; do it here so the
    // arrow keys nudge the selection straight after a click or drag.
    box.current?.focus({ preventScroll: true });
    stage.current?.setPointerCapture(event.pointerId);
    let start = rect;
    if (handle === "se" && event.target === stage.current) {
      // Pressing outside the box starts a fresh selection from that point.
      const point = toImage(event);
      start = { x: point.x, y: point.y, width: 1, height: 1 };
    }
    drag.current = { handle, startX: event.clientX, startY: event.clientY, start };
  }

  function move(event: PointerEvent) {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / scale;
    const dy = (event.clientY - current.startY) / scale;
    current.last = dragRect(current.start, current.handle, dx, dy, bounds, ratio);
    onChange(current.last);
  }

  function end(event: PointerEvent) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (stage.current?.hasPointerCapture(event.pointerId)) stage.current.releasePointerCapture(event.pointerId);
    // A release that follows the last move before React re-renders would see the
    // old `rect` prop and undo the drag, so round what the drag itself produced.
    if (current.last) onChange(normalizeRect(current.last, bounds));
  }

  function nudge(event: KeyboardEvent) {
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    onChange(normalizeRect(dragRect(rect, "move", delta[0], delta[1], bounds, ratio), bounds));
  }

  return (
    <div className="crop-scroller" ref={scroller}>
      <div
        ref={stage}
        className="crop-stage"
        style={{ width }}
        onPointerDown={(event) => begin(event, "se")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={holder} className="stage-canvas" />
        <div
          ref={box}
          className="crop-box"
          role="group"
          tabIndex={0}
          aria-roledescription="crop box"
          aria-label={`Crop selection, ${Math.round(rect.width)} by ${Math.round(rect.height)} pixels at ${Math.round(rect.x)}, ${Math.round(rect.y)}. Arrow keys move it; hold Shift for 10 pixel steps.`}
          style={{ left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }}
          onPointerDown={(event) => begin(event, "move")}
          onKeyDown={nudge}
        >
          <span className="crop-size-badge">{Math.round(rect.width)} × {Math.round(rect.height)}</span>
          <div className="crop-grid" aria-hidden><span className="v1" /><span className="v2" /><span className="h1" /><span className="h2" /></div>
          {HANDLES.map((handle) => (
            <span key={handle} className={`crop-handle ${handle}`} aria-hidden onPointerDown={(event) => begin(event, handle)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CropWorkbench({ tool }: { tool: ToolDefinition }) {
  const images = useEditorImages();
  const image = images.active;
  const [orientation, setOrientation] = useState<Orientation>(NO_CHANGE);
  const [presetId, setPresetId] = useState("free");
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const [stored, setStored] = useState<{ owner: string; rect: Rect } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [choice, setChoice] = useState("auto");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, replace] = useFinished();

  const bounds: Size = image ? rotatedSize(image, orientation.rotation) : { width: 1, height: 1 };
  const ratio = ASPECT_PRESETS.find((preset) => preset.id === presetId)?.ratio ?? lockedRatio;
  // The selection belongs to one image in one orientation; anything else starts fresh.
  const owner = image ? `${image.id}|${orientation.rotation}` : "";
  const rect = stored?.owner === owner ? stored.rect : initialCrop(bounds, ratio);
  const setRect = (next: Rect) => setStored({ owner, rect: next });

  const format = resolveOutputFormat(choice, image?.type ?? "");
  const key = JSON.stringify([normalizeRect(rect, bounds), orientation, format, quality]);
  const result = finished && image && finished.sourceId === image.id && finished.key === key ? finished : null;

  function choosePreset(id: string) {
    const next = ASPECT_PRESETS.find((preset) => preset.id === id)?.ratio ?? null;
    setPresetId(id);
    setLockedRatio(null);
    if (next) setRect(fitToRatio(rect, next, bounds));
  }

  function toggleLock() {
    if (ratio) { setPresetId("free"); setLockedRatio(null); }
    else setLockedRatio(rect.width / rect.height);
  }

  function setSize(width: number, height: number) {
    const sized = normalizeRect({ ...rect, width, height }, bounds);
    setRect(ratio ? fitToRatio(sized, ratio, bounds) : sized);
  }

  function reset() {
    setOrientation(NO_CHANGE);
    setPresetId("free");
    setLockedRatio(null);
    setStored(null);
    setZoom(100);
    setError("");
  }

  async function apply() {
    if (!image) return;
    setBusy(true);
    setError("");
    try {
      const turned = orientation === NO_CHANGE ? image.element : orient(image.element, image, orientation);
      const canvas = cropImage(turned, normalizeRect(rect, bounds));
      const encoded = await encodeResult(canvas, format, quality);
      replace({ ...encoded, name: `${baseName(image.name)}-cropped.${encoded.extension}`, key, sourceId: image.id });
    } catch (cause) {
      setError(errorMessage(cause, "The image could not be cropped."));
    } finally {
      setBusy(false);
    }
  }

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const turn = (action: Parameters<typeof applyOrientation>[1]) => setOrientation((current) => applyOrientation(current, action));

  return (
    <EditorShell
      tool={tool}
      images={images}
      preview={image && (
        <>
          <PanelTitle
            icon={<Crop size={18} />}
            title="Crop Preview"
            actions={(
              <>
                <button type="button" className="ghost-button" onClick={reset}><RefreshCw size={14} /> Reset</button>
                <span className="zoom-inline">
                  <button type="button" aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomIndex - 1)])}><Minus size={14} /></button>
                  <output aria-label="Zoom level">{zoom}%</output>
                  <button type="button" aria-label="Zoom in" disabled={zoomIndex >= ZOOM_STEPS.length - 1} onClick={() => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)])}><Plus size={14} /></button>
                </span>
                <button type="button" className="ghost-button" aria-label="Fit to frame" onClick={() => setZoom(100)}><Maximize2 size={15} /></button>
              </>
            )}
          />
          <CropStage image={image} orientation={orientation} bounds={bounds} rect={rect} ratio={ratio} zoom={zoom} onChange={setRect} />
          <EditorThumbs images={images} addLabel="Add Image" />
          <FileCaption image={image} />
        </>
      )}
      settings={(
        <>
          <PanelTitle icon={<Settings2 size={18} />} title="Crop Settings" />

          <div className="field">
            <span className="field-label">Aspect Ratio</span>
            <div className="ratio-grid" role="radiogroup" aria-label="Aspect ratio">
              {ASPECT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={presetId === preset.id}
                  className="ratio-tile"
                  onClick={() => choosePreset(preset.id)}
                >
                  <b>{preset.label}</b>
                  {preset.id !== "free" && <small>{preset.caption}</small>}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Position & Size</span>
            <div className="split-row">
              <PixelField label="X (px)" value={rect.x} onCommit={(x) => setRect(normalizeRect({ ...rect, x }, bounds))} />
              <PixelField label="Y (px)" value={rect.y} onCommit={(y) => setRect(normalizeRect({ ...rect, y }, bounds))} />
            </div>
            <div className="dimension-row" style={{ marginTop: 12 }}>
              <PixelField label="Width (px)" value={rect.width} onCommit={(width) => setSize(width, ratio ? width / ratio : rect.height)} />
              <button
                type="button"
                className="lock-button"
                aria-pressed={Boolean(ratio)}
                aria-label={ratio ? "Unlock aspect ratio" : "Lock aspect ratio"}
                title={ratio ? "Aspect ratio locked" : "Aspect ratio free"}
                onClick={toggleLock}
              >
                {ratio ? <Link2 size={17} /> : <Unlink2 size={17} />}
              </button>
              <PixelField label="Height (px)" value={rect.height} onCommit={(height) => setSize(ratio ? height * ratio : rect.width, height)} />
            </div>
          </div>

          <ActionTiles
            label="Quick Actions"
            columns={4}
            items={[
              { key: "left", icon: <RotateCcw size={18} />, title: "Rotate Left", onClick: () => turn("left") },
              { key: "right", icon: <RotateCw size={18} />, title: "Rotate Right", onClick: () => turn("right") },
              { key: "h", icon: <FlipHorizontal2 size={18} />, title: "Flip Horizontal", pressed: orientation.flipH, onClick: () => turn("flipH") },
              { key: "v", icon: <FlipVertical2 size={18} />, title: "Flip Vertical", pressed: orientation.flipV, onClick: () => turn("flipV") }
            ]}
          />

          <ChipGroup label="Output Format" value={choice} choices={OUTPUT_CHOICES} onChange={setChoice} />
          {LOSSY.has(format) && <RangeField label="Quality" min={40} max={100} accent unit="%" value={quality} onChange={setQuality} />}

          <EditorAlert message={error} />
          <button type="button" className="btn btn-primary btn-block-lg" disabled={!image || busy} onClick={apply}>
            {busy ? <Loader2 size={18} className="spin" aria-hidden /> : <Crop size={18} aria-hidden />} Crop Image
          </button>
          {!image && <p className="editor-note">Upload an image, then drag the handles or type exact pixel values.</p>}
        </>
      )}
      below={result && image && (
        <ResultPanel
          title="Result"
          thumbUrl={result.url}
          thumbBadge={`${result.width} × ${result.height}`}
          transparent={format !== "jpeg"}
          details={[
            { label: "Original", value: `${bounds.width} × ${bounds.height}` },
            { label: "Dimensions", value: `${result.width} × ${result.height} px` },
            { label: "File size", value: `${formatBytes(result.blob.size)} (${sizeChange(image.size, result.blob.size)})` },
            { label: "Format", value: FORMAT_NAME[result.format] ?? result.format.toUpperCase() }
          ]}
          success="Image cropped successfully!"
          onDownload={() => downloadBlob(result.blob, result.name)}
          onProcessAnother={() => processAnother(images, () => replace(null))}
        />
      )}
    />
  );
}
