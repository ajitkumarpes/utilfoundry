"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { NumberField, RadioRow, RangeField, SelectField, ToggleRow } from "@/components/ui/Fields";
import { PreviewEmpty } from "@/components/ui/PreviewFrame";
import { StepCard } from "@/components/ui/StepCard";
import { DownloadSplit, StatusBar } from "@/components/ui/StatusBar";
import { TipBar } from "@/components/ui/TipBar";
import { FileList, SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { useImageInput } from "@/components/tools/useImageInput";
import { canvasToBlob, downloadBlob } from "@/lib/canvas/encode";
import { context, createCanvas } from "@/lib/canvas/effects";
import { defaultsFor } from "@/lib/defaults";
import { baseName, formatBytes } from "@/lib/format";
import {
  animationDuration, decodeAnimation, selectFrames, type Animation, type AnimationFrame
} from "@/lib/gif";
import { samplesFor } from "@/lib/samples";
import { createZip, sequenceName, type ZipEntry } from "@/lib/zip";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import type { ToolOptions } from "@/lib/canvas/types";

/** Thumbnails shown before the grid switches to "show all". */
const THUMBNAIL_LIMIT = 12;

const FORMATS = [
  { value: "png", label: "PNG (best quality)" },
  { value: "jpeg", label: "JPG (smaller files)" },
  { value: "webp", label: "WebP" }
];

/** Paints one decoded frame into a canvas, optionally resized. */
function frameCanvas(frame: AnimationFrame, targetWidth = 0) {
  const source = createCanvas(frame.width, frame.height);
  context(source).putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
  if (!targetWidth || targetWidth === frame.width) return source;

  const scale = targetWidth / frame.width;
  const resized = createCanvas(targetWidth, Math.max(1, Math.round(frame.height * scale)));
  const ctx = context(resized);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, resized.width, resized.height);
  return resized;
}

export function FramesWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;

  const [options, setOptions] = useState<ToolOptions>(() => defaultsFor(tool.id));
  const [animation, setAnimation] = useState<{ id: string; data: Animation } | null>(null);
  const [decodeError, setDecodeError] = useState<{ id: string; message: string } | null>(null);
  const [exportError, setExportError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);
  const set = useCallback((key: string, value: string | number | boolean) => {
    setOptions((current) => ({ ...current, [key]: value }));
  }, []);

  // Keyed by image id throughout, so a new upload invalidates the old result
  // without an effect needing to clear anything up front.
  useEffect(() => {
    if (!image?.file) return;
    const id = image.id;
    let cancelled = false;

    image.file.arrayBuffer()
      .then(decodeAnimation)
      .then((data) => {
        if (cancelled) return;
        setAnimation({ id, data });
        setOptions((current) => ({ ...current, rangeFrom: 1, rangeTo: data.frames.length }));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDecodeError({ id, message: cause instanceof Error ? cause.message : "This animation could not be read." });
      });

    return () => { cancelled = true; };
  }, [image]);

  const data = image && animation?.id === image.id ? animation.data : null;
  const failure = image && decodeError?.id === image.id ? decodeError.message : "";
  const decoding = Boolean(image) && !data && !failure;

  const selected = useMemo(() => {
    if (!data) return [];
    return selectFrames(
      data.frames,
      String(options.extractMode ?? "all"),
      Number(options.nth ?? 2),
      Number(options.rangeFrom ?? 1),
      Number(options.rangeTo ?? data.frames.length)
    );
  }, [data, options.extractMode, options.nth, options.rangeFrom, options.rangeTo]);

  const expanded = Boolean(image) && showAll === image?.id;
  const shown = expanded ? selected : selected.slice(0, THUMBNAIL_LIMIT);

  // Thumbnails are drawn imperatively: one canvas per frame, replaced wholesale.
  useEffect(() => {
    if (!gridRef.current) return;
    if (!shown.length) { gridRef.current.replaceChildren(); return; }

    const nodes = shown.map((frame) => {
      const figure = document.createElement("figure");
      figure.className = "tile-card";

      const thumb = document.createElement("div");
      thumb.className = "tile-thumb";
      const canvas = frameCanvas(frame, Math.min(frame.width, 240));
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Frame ${frame.index + 1}`);
      thumb.append(canvas);

      const caption = document.createElement("figcaption");
      const label = document.createElement("b");
      label.textContent = `Frame ${frame.index + 1}`;
      const timing = document.createElement("span");
      timing.textContent = `${frame.delay} ms`;
      caption.append(label, timing);

      figure.append(thumb, caption);
      return figure;
    });

    gridRef.current.replaceChildren(...nodes);
  }, [shown]);

  const exportFrames = useCallback(async () => {
    if (!data || !selected.length || !image) return;
    setBusy(true);
    setExportError("");
    try {
      const format = String(options.format ?? "png");
      const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
      const extension = format === "jpeg" ? "jpg" : format;
      const quality = Number(options.quality ?? 92);
      const targetWidth = options.keepOriginalSize === false ? Number(options.frameWidth ?? 0) : 0;
      const prefix = baseName(image.name);

      const entries: ZipEntry[] = [];
      for (const [index, frame] of selected.entries()) {
        const blob = await canvasToBlob(frameCanvas(frame, targetWidth), mime as "image/png", quality);
        entries.push({
          name: sequenceName("frame", index, selected.length, extension),
          data: new Uint8Array(await blob.arrayBuffer())
        });
      }

      downloadBlob(createZip(entries), `${prefix}-frames.zip`);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "The frames could not be exported.");
    } finally {
      setBusy(false);
    }
  }, [data, selected, image, options]);

  const error = input.error || failure || exportError;
  const tone = error ? "error" : busy || decoding ? "busy" : data ? "ready" : "idle";
  const mode = String(options.extractMode ?? "all");

  return (
    <>
      <div className="workspace is-full">
        <div className="workspace-main">
          <div className="step-grid is-triple">
            <StepCard step={1} title="Upload a GIF" subtitle={tool.uploadNote}>
              <UploadZone
                multiple={false}
                accept="image/gif,image/webp,image/png"
                label="Choose GIF"
                hint={acceptedFormats(tool)}
                maxNote="Max 32 MB per file"
                onFiles={input.addFiles}
              />
              {image
                ? <FileList items={input.images} onRemove={input.remove} onClear={input.clear} />
                : <SampleStrip samples={samples} activeSrc={input.sampleSrc} onPick={input.addSample} />}
            </StepCard>

            <StepCard
              step={2}
              title="Preview & Frames"
              subtitle="The animation, and the frames inside it"
              actions={selected.length > THUMBNAIL_LIMIT ? (
                <button type="button" className="link-button" onClick={() => setShowAll(expanded ? null : image?.id ?? null)}>
                  {expanded ? "Show fewer" : `Show all ${selected.length}`}
                </button>
              ) : undefined}
            >
              {!image ? <PreviewEmpty message="Add an animation to split it into frames." /> : (
                <>
                  <div className="preview-stage checkerboard">
                    <img src={image.url} alt={image.name} />
                  </div>

                  {data && (
                    <div className="stat-row">
                      <div className="stat"><small>Frames</small><strong>{data.frames.length}</strong></div>
                      <div className="stat"><small>Size</small><strong>{formatBytes(image.size)}</strong></div>
                      <div className="stat"><small>Dimensions</small><strong>{data.width} × {data.height}</strong></div>
                      <div className="stat"><small>Duration</small><strong>{animationDuration(data.frames)} s</strong></div>
                    </div>
                  )}

                  {decoding && <p className="meta-empty">Decoding the animation…</p>}

                  {data && (
                    <div className="field">
                      <span className="field-label">
                        Extracted frames ({selected.length}{selected.length !== data.frames.length ? ` of ${data.frames.length}` : ""})
                      </span>
                      <div className="tile-grid" ref={gridRef} />
                    </div>
                  )}
                </>
              )}
            </StepCard>

            <StepCard step={3} title="Frame Settings" subtitle="Choose what to extract and how">
              {!data ? (
                <p className="meta-empty">Add an animation to configure the export.</p>
              ) : (
                <>
                  <RadioRow
                    label="Extract mode"
                    value={mode}
                    onChange={(value) => set("extractMode", value)}
                    options={[
                      { value: "all", label: `All frames (${data.frames.length})` },
                      { value: "nth", label: "Every Nth frame" },
                      { value: "range", label: "Custom range" }
                    ]}
                  />

                  {mode === "nth" && (
                    <RangeField
                      label="Keep every"
                      min={2}
                      max={Math.max(2, Math.min(24, data.frames.length))}
                      unit="th frame"
                      value={Number(options.nth ?? 2)}
                      onChange={(value) => set("nth", value)}
                    />
                  )}

                  {mode === "range" && (
                    <div className="split-row">
                      <NumberField
                        label="From"
                        min={1}
                        max={data.frames.length}
                        value={String(options.rangeFrom ?? 1)}
                        onChange={(value) => set("rangeFrom", Number(value) || 1)}
                      />
                      <NumberField
                        label="To"
                        min={1}
                        max={data.frames.length}
                        value={String(options.rangeTo ?? data.frames.length)}
                        onChange={(value) => set("rangeTo", Number(value) || data.frames.length)}
                      />
                    </div>
                  )}

                  <SelectField
                    label="Output format"
                    help={String(options.format) === "png" ? "PNG keeps transparency, which GIFs often use." : "Transparency is flattened in this format."}
                    value={String(options.format ?? "png")}
                    options={FORMATS}
                    onChange={(value) => set("format", value)}
                  />

                  {String(options.format ?? "png") !== "png" && (
                    <RangeField
                      label="Quality"
                      min={40}
                      max={100}
                      accent
                      unit="%"
                      value={Number(options.quality ?? 92)}
                      onChange={(value) => set("quality", value)}
                    />
                  )}

                  <div className="field">
                    <ToggleRow
                      label="Maintain original size"
                      note={`Keep every frame at ${data.width} × ${data.height}`}
                      checked={options.keepOriginalSize !== false}
                      onChange={(value) => set("keepOriginalSize", value)}
                    />
                  </div>

                  {options.keepOriginalSize === false && (
                    <NumberField
                      label="Frame width (px)"
                      help="Height follows automatically to keep the aspect ratio."
                      min={16}
                      max={4000}
                      value={String(options.frameWidth || data.width)}
                      onChange={(value) => set("frameWidth", Number(value) || data.width)}
                    />
                  )}

                  <span className="field-help">
                    Files are named frame_001, frame_002 … so they stay in order wherever you unzip them.
                  </span>
                </>
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={tone}
            title={error || (data
              ? `${selected.length} frame${selected.length === 1 ? "" : "s"} ready to export`
              : decoding ? "Decoding the animation…" : "Upload an animation to begin")}
            note={error
              ? "Fix the problem above and try again."
              : data
                ? `${data.format} · ${data.width} × ${data.height} · ${animationDuration(data.frames)} s${data.loopCount === 0 ? " · loops forever" : ""}`
                : "Drop a GIF or pick the sample to start."}
          >
            {data && selected.length > 0 && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOptions(defaultsFor(tool.id))}>
                  <RefreshCw size={15} /> Reset
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    const frame = selected[0];
                    const blob = await canvasToBlob(frameCanvas(frame), "image/png", 100);
                    downloadBlob(blob, `${baseName(image?.name ?? "frame")}-frame-${frame.index + 1}.png`);
                  }}
                >
                  <Download size={15} /> First frame
                </button>
                <DownloadSplit label={tool.action} busy={busy} onAction={exportFrames} />
              </>
            )}
          </StatusBar>
        </div>
      </div>

      <TipBar title="Animated WebP works too">
        GIF is decoded here in full, including frame disposal, so partial frames come out as complete
        pictures. Animated WebP and APNG go through the browser&rsquo;s own decoder where it has one.
      </TipBar>
    </>
  );
}
