"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileJson, RefreshCw } from "lucide-react";
import { PreviewEmpty } from "@/components/ui/PreviewFrame";
import { SelectField } from "@/components/ui/Fields";
import { StepCard } from "@/components/ui/StepCard";
import { DownloadSplit, StatusBar } from "@/components/ui/StatusBar";
import { TipBar } from "@/components/ui/TipBar";
import { FileList, SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { useCopy } from "@/components/tools/useCopy";
import { useImageInput } from "@/components/tools/useImageInput";
import { downloadBlob } from "@/lib/canvas/encode";
import { context, createCanvas } from "@/lib/canvas/effects";
import {
  describeColor, extractPalette, formatColor, paletteToJson, paletteToText, prefersDarkText,
  relatedColors, samplePixels, toCmyk, toHex, toHsl, toHsv, type ColorFormat, type Rgb, type Swatch
} from "@/lib/color";
import { baseName } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import type { SourceImage } from "@/lib/canvas/types";

/** Working resolution for sampling: plenty of detail, bounded memory. */
const SAMPLE_MAX = 1400;

/**
 * Decodes the image into an ImageData the pickers can read pixels from.
 * Drawing to a canvas is synchronous, so this is derived during render rather
 * than pushed through state.
 */
function useImageData(image: SourceImage | null) {
  return useMemo(() => {
    if (!image) return { data: null as ImageData | null, error: "" };
    try {
      const scale = Math.min(1, SAMPLE_MAX / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = createCanvas(width, height);
      const ctx = context(canvas);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image.element, 0, 0, width, height);
      return { data: ctx.getImageData(0, 0, width, height), error: "" };
    } catch (cause) {
      return { data: null, error: cause instanceof Error ? cause.message : "This image could not be read." };
    }
  }, [image]);
}

function pixelAt(data: ImageData, x: number, y: number): Rgb {
  const cx = Math.min(data.width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(data.height - 1, Math.max(0, Math.round(y)));
  const at = (cy * data.width + cx) * 4;
  return { r: data.data[at], g: data.data[at + 1], b: data.data[at + 2] };
}

/* -------------------------------------------------------------------------- */
/* Colour picker                                                              */
/* -------------------------------------------------------------------------- */

export function ColorPickerWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;
  const { data, error: decodeError } = useImageData(image);
  const { copy, copied, copyError } = useCopy();

  const stageRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keyed by image id: picking a new file falls back to the centre without an
  // effect having to reset anything.
  const [pick, setPick] = useState<{ id: string; x: number; y: number } | null>(null);

  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);

  const point = !data ? null
    : pick && pick.id === image?.id
      ? { x: pick.x, y: pick.y }
      : { x: Math.round(data.width / 2), y: Math.round(data.height / 2) };

  // Paint the working image into the visible canvas whenever it changes.
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = data.width;
    canvas.height = data.height;
    context(canvas).putImageData(data, 0, 0);
  }, [data]);

  const color = data && point ? pixelAt(data, point.x, point.y) : null;

  const pickFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!data || !image || !stageRef.current) return;
    const box = stageRef.current.getBoundingClientRect();
    if (!box.width || !box.height) return;
    setPick({
      id: image.id,
      x: ((clientX - box.left) / box.width) * data.width,
      y: ((clientY - box.top) / box.height) * data.height
    });
  }, [data, image]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (!data || !image) return;
    setPick((current) => {
      // Falls back to the centre, matching what the lens is already showing.
      const from = current && current.id === image.id
        ? current
        : { id: image.id, x: data.width / 2, y: data.height / 2 };
      return {
        id: image.id,
        x: Math.min(data.width - 1, Math.max(0, from.x + dx)),
        y: Math.min(data.height - 1, Math.max(0, from.y + dy))
      };
    });
  }, [data, image]);

  const rows = color ? [
    { label: "HEX", value: toHex(color) },
    { label: "RGB", value: formatColor(color, "rgb") },
    { label: "HSL", value: formatColor(color, "hsl") },
    { label: "HSV", value: `hsv(${toHsv(color).h}, ${toHsv(color).s}%, ${toHsv(color).v}%)` },
    { label: "CMYK", value: (({ c, m, y, k }) => `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`)(toCmyk(color)) }
  ] : [];

  const error = input.error || decodeError || copyError;

  return (
    <>
      <div className="workspace is-full">
        <div className="workspace-main">
          <div className="step-grid is-triple">
            <StepCard step={1} title="Upload Image" subtitle={tool.uploadNote}>
              <UploadZone
                multiple={false}
                accept="image/*"
                label="Choose Image"
                hint={acceptedFormats(tool)}
                maxNote="Max 32 MB per file"
                onFiles={input.addFiles}
              />
              {image
                ? <FileList items={input.images} onRemove={input.remove} onClear={input.clear} />
                : <SampleStrip samples={samples} activeSrc={input.sampleSrc} onPick={input.addSample} />}
            </StepCard>

            <StepCard step={2} title="Pick a Color" subtitle="Click the image, or use the arrow keys">
              {!image ? <PreviewEmpty message="Add an image to start sampling colours." /> : (
                <>
                  <button
                    type="button"
                    ref={stageRef}
                    className="picker-stage"
                    aria-label="Pick a colour from the image. Use the arrow keys for single-pixel steps."
                    onClick={(event) => pickFromEvent(event.clientX, event.clientY)}
                    onPointerMove={(event) => { if (event.buttons === 1) pickFromEvent(event.clientX, event.clientY); }}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 10 : 1;
                      const moves: Record<string, [number, number]> = {
                        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]
                      };
                      const move = moves[event.key];
                      if (!move) return;
                      event.preventDefault();
                      nudge(move[0], move[1]);
                    }}
                  >
                    <canvas ref={canvasRef} />
                    {data && point && color && (
                      <span
                        className="picker-lens"
                        style={{
                          left: `${(point.x / data.width) * 100}%`,
                          top: `${(point.y / data.height) * 100}%`,
                          background: toHex(color)
                        }}
                      >
                        <i />
                        <b>{toHex(color)}</b>
                      </span>
                    )}
                  </button>
                  {point && (
                    <p className="text-meta" style={{ justifyContent: "center" }}>
                      <span>x {Math.round(point.x)} · y {Math.round(point.y)}</span>
                      <span>Shift + arrow moves 10 px</span>
                    </p>
                  )}
                </>
              )}
            </StepCard>

            <StepCard step={3} title="Color Information" subtitle="The same colour in every notation">
              {!color ? <p className="meta-empty">Pick a point on the image to read its colour.</p> : (
                <>
                  <div className="color-hero">
                    <i style={{ background: toHex(color) }} aria-hidden />
                    <div>
                      <small>Selected colour</small>
                      <strong>{toHex(color)}</strong>
                      <span>{describeColor(color)}</span>
                    </div>
                  </div>

                  <dl className="code-list">
                    {rows.map((row) => (
                      <div className="code-row" key={row.label}>
                        <dt>{row.label}</dt>
                        <dd title={row.value}>{row.value}</dd>
                        <button
                          type="button"
                          aria-label={`Copy ${row.label} value`}
                          onClick={() => copy(row.value, row.label)}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    ))}
                  </dl>

                  <div className="field">
                    <span className="field-label">Similar colours</span>
                    <div className="swatch-row">
                      {relatedColors(color).map((related, index) => (
                        <button
                          key={`${toHex(related)}-${index}`}
                          type="button"
                          style={{ background: toHex(related) }}
                          aria-label={`Copy ${toHex(related)}`}
                          title={toHex(related)}
                          onClick={() => copy(toHex(related), toHex(related))}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={error ? "error" : color ? "ready" : "idle"}
            title={error || (color ? `${describeColor(color)} — ${toHex(color)}` : "Upload an image to begin")}
            note={error
              ? "Fix the problem above and try again."
              : color
                ? copied ? `${copied} copied to the clipboard.` : tool.readyNote
                : "Drop a file or pick one of the samples to start."}
          >
            {color && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={input.clear}>
                  <RefreshCw size={15} /> Clear
                </button>
                <DownloadSplit
                  label={copied === "all codes" ? "Copied" : tool.action}
                  onAction={() => copy(rows.map((row) => `${row.label}: ${row.value}`).join("\n"), "all codes")}
                />
              </>
            )}
          </StatusBar>
        </div>
      </div>

      <TipBar title="Zoom in for precision">
        The image is sampled at up to {SAMPLE_MAX} px on its longest side. Click and drag to sweep
        across the picture, or use the arrow keys to step one pixel at a time.
      </TipBar>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Palette extractor                                                          */
/* -------------------------------------------------------------------------- */

const COUNTS = ["4", "5", "6", "8", "10", "12", "16"].map((value) => ({ value, label: `${value} colours` }));
const NOTATIONS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" }
];

/** Draws the palette as a shareable strip of labelled blocks. */
function paletteImage(swatches: Swatch[], name: string) {
  const blockWidth = 260;
  const height = 320;
  const canvas = createCanvas(blockWidth * swatches.length, height);
  const ctx = context(canvas);

  swatches.forEach((swatch, index) => {
    const x = index * blockWidth;
    ctx.fillStyle = swatch.hex;
    ctx.fillRect(x, 0, blockWidth, height);

    ctx.fillStyle = prefersDarkText(swatch.color) ? "rgba(17,28,61,.88)" : "rgba(255,255,255,.94)";
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(swatch.hex, x + 24, height - 62);
    ctx.font = "400 16px Inter, system-ui, sans-serif";
    ctx.fillText(`${swatch.name} · ${Math.round(swatch.share * 100)}%`, x + 24, height - 34);
  });

  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${name}-palette.png`);
      resolve();
    }, "image/png");
  });
}

export function PaletteWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;
  const { data, error: decodeError } = useImageData(image);
  const { copy, copied, copyError } = useCopy();

  const [count, setCount] = useState("10");
  const [notation, setNotation] = useState<ColorFormat>("hex");
  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);

  const swatches = useMemo(
    () => (data ? extractPalette(samplePixels(data.data), Number(count)) : []),
    [data, count]
  );

  const error = input.error || decodeError || copyError;

  return (
    <>
      <div className="workspace is-full">
        <div className="workspace-main">
          <div className="step-grid is-triple">
            <StepCard step={1} title="Upload Image" subtitle={tool.uploadNote}>
              <UploadZone
                multiple={false}
                accept="image/*"
                label="Choose Image"
                hint={acceptedFormats(tool)}
                maxNote="Max 32 MB per file"
                onFiles={input.addFiles}
              />
              {image
                ? <FileList items={input.images} onRemove={input.remove} onClear={input.clear} />
                : <SampleStrip samples={samples} activeSrc={input.sampleSrc} onPick={input.addSample} />}
            </StepCard>

            <StepCard step={2} title="Image Preview" subtitle="The image being analysed">
              {!image ? <PreviewEmpty /> : (
                <>
                  <div className="preview-stage">
                    <img src={image.url} alt={image.name} />
                  </div>
                  {swatches.length > 0 && (
                    <div className="field">
                      <span className="field-label">Palette preview</span>
                      <div className="palette-bar">
                        {swatches.map((swatch) => (
                          <span
                            key={swatch.hex}
                            style={{ background: swatch.hex, flex: Math.max(0.04, swatch.share) }}
                            title={`${swatch.hex} — ${Math.round(swatch.share * 100)}%`}
                          />
                        ))}
                      </div>
                      <span className="field-help">Block width follows how much of the image each colour covers.</span>
                    </div>
                  )}
                </>
              )}
            </StepCard>

            <StepCard
              step={3}
              title="Extracted Color Palette"
              subtitle="Dominant colours found in your image"
            >
              {!image ? (
                <p className="meta-empty">Add an image to pull its palette out.</p>
              ) : (
                <>
                  <SelectField
                    label="Number of colours"
                    help="More colours pick up subtler tones; fewer give you the broad strokes."
                    value={count}
                    options={COUNTS}
                    onChange={setCount}
                  />
                  {swatches.length === 0 ? (
                    <p className="meta-empty">This image is fully transparent, so there is nothing to sample.</p>
                  ) : (
                    <>
                    <div className="meta-tabs" role="tablist" aria-label="Colour notation">
                      {NOTATIONS.map((entry) => (
                        <button
                          key={entry.value}
                          type="button"
                          role="tab"
                          aria-selected={notation === entry.value}
                          onClick={() => setNotation(entry.value)}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                    <div className="swatch-grid">
                      {swatches.map((swatch) => {
                        const value = formatColor(swatch.color, notation);
                        return (
                          <button
                            key={swatch.hex}
                            type="button"
                            className="swatch"
                            title={`Copy ${value}`}
                            aria-label={`Copy ${swatch.name}, ${value}`}
                            onClick={() => copy(value, swatch.hex)}
                          >
                            <i style={{ background: swatch.hex, color: prefersDarkText(swatch.color) ? "rgba(17,28,61,.7)" : "rgba(255,255,255,.85)" }}>
                              {copied === swatch.hex ? "Copied" : `${Math.round(swatch.share * 100)}%`}
                            </i>
                            <b>{value}</b>
                            <small>{swatch.name}</small>
                          </button>
                        );
                      })}
                    </div>
                    </>
                  )}
                </>
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={error ? "error" : swatches.length ? "ready" : "idle"}
            title={error || (swatches.length ? tool.readyTitle : "Upload an image to begin")}
            note={error
              ? "Fix the problem above and try again."
              : swatches.length
                ? `${swatches.length} colours cover ${Math.round(swatches.reduce((total, swatch) => total + swatch.share, 0) * 100)}% of the image.`
                : "Drop a file or pick one of the samples to start."}
          >
            {swatches.length > 0 && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => paletteImage(swatches, baseName(image?.name ?? "palette"))}>
                  <Download size={15} /> PNG
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => downloadBlob(
                    new Blob([paletteToJson(swatches)], { type: "application/json" }),
                    `${baseName(image?.name ?? "palette")}-palette.json`
                  )}
                >
                  <FileJson size={15} /> JSON
                </button>
                <DownloadSplit
                  label={copied === "palette" ? "Copied" : tool.action}
                  onAction={() => copy(paletteToText(swatches, notation), "palette")}
                />
              </>
            )}
          </StatusBar>
        </div>
      </div>

      <TipBar title="Use high-quality images for better results">
        Colours are clustered with median cut and refined with k-means, so the same image always
        produces the same palette. Photographs with clear subjects give the most usable results.
      </TipBar>
    </>
  );
}
