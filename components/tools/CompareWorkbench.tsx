"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsLeftRight, Download, ImageOff, RefreshCw } from "lucide-react";
import { RangeField } from "@/components/ui/Fields";
import { StepCard } from "@/components/ui/StepCard";
import { StatusBar } from "@/components/ui/StatusBar";
import { TipBar } from "@/components/ui/TipBar";
import { UploadZone } from "@/components/ui/UploadZone";
import { useImageInput } from "@/components/tools/useImageInput";
import { downloadBlob } from "@/lib/canvas/encode";
import { context, createCanvas } from "@/lib/canvas/effects";
import { compareImages, comparisonSize, summarise, type DiffResult } from "@/lib/diff";
import { baseName, formatBytes } from "@/lib/format";
import { COMPARE_PAIR } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import type { SourceImage } from "@/lib/canvas/types";

type View = "difference" | "side" | "slider";

const VIEWS: { id: View; label: string }[] = [
  { id: "difference", label: "Difference" },
  { id: "side", label: "Side by side" },
  { id: "slider", label: "Slider" }
];

/** Draws `image` into a fresh canvas at exactly `width` × `height`. */
function rasterise(image: SourceImage, width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image.element, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function Slot({ step, title, subtitle, tool, input, onSample }: {
  step: number;
  title: string;
  subtitle: string;
  tool: ToolDefinition;
  input: ReturnType<typeof useImageInput>;
  onSample: () => void;
}) {
  const image = input.images[0] ?? null;
  return (
    <StepCard step={step} title={title} subtitle={subtitle}>
      <UploadZone
        multiple={false}
        accept="image/*"
        label="Choose Image"
        hint={acceptedFormats(tool)}
        maxNote="Max 32 MB per file"
        onFiles={input.addFiles}
      />
      {image ? (
        <>
          <div className="preview-stage">
            <img src={image.url} alt={image.name} />
          </div>
          <p className="text-meta" style={{ justifyContent: "space-between" }}>
            <span title={image.name}>{image.name}</span>
            <span>{image.width} × {image.height} · {formatBytes(image.size)}</span>
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={input.clear}>
            <RefreshCw size={15} /> Replace image
          </button>
        </>
      ) : (
        <div className="slot-empty">
          <ImageOff size={26} strokeWidth={1.4} />
          <span>No image yet.</span>
          <button type="button" className="link-button" onClick={onSample}>Use the sample pair</button>
        </div>
      )}
    </StepCard>
  );
}

export function CompareWorkbench({ tool }: { tool: ToolDefinition }) {
  const first = useImageInput({ multiple: false });
  const second = useImageInput({ multiple: false });
  const left = first.images[0] ?? null;
  const right = second.images[0] ?? null;

  const [view, setView] = useState<View>("difference");
  const [sensitivity, setSensitivity] = useState(75);
  const [split, setSplit] = useState(50);
  const diffRef = useRef<HTMLCanvasElement>(null);

  const geometry = useMemo(() => (left && right ? comparisonSize(left, right) : null), [left, right]);

  const loadPair = useCallback(() => {
    first.addSample(COMPARE_PAIR[0]);
    second.addSample(COMPARE_PAIR[1]);
  }, [first, second]);

  // Derived during render: comparing is synchronous, so there is nothing to
  // synchronise and no reason to bounce it through state.
  const { result, compareError } = useMemo(() => {
    if (!left || !right || !geometry) return { result: null as DiffResult | null, compareError: "" };
    try {
      const a = rasterise(left, geometry.width, geometry.height);
      const b = rasterise(right, geometry.width, geometry.height);
      return {
        result: compareImages(a.data, b.data, geometry.width, geometry.height, sensitivity),
        compareError: ""
      };
    } catch (cause) {
      return {
        result: null,
        compareError: cause instanceof Error ? cause.message : "These images could not be compared."
      };
    }
  }, [left, right, geometry, sensitivity]);

  // Paint the difference map once it exists and the view is showing it.
  useEffect(() => {
    const canvas = diffRef.current;
    if (!canvas || !result || view !== "difference") return;
    canvas.width = result.width;
    canvas.height = result.height;
    context(canvas).putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0);
  }, [result, view]);

  const download = useCallback(() => {
    if (!result || !left) return;
    const canvas = createCanvas(result.width, result.height);
    context(canvas).putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${baseName(left.name)}-difference.png`);
    }, "image/png");
  }, [result, left]);

  const error = first.error || second.error || compareError;
  const ready = Boolean(left && right && result);

  return (
    <>
      <div className="workspace is-full">
        <div className="workspace-main">
          <div className="step-grid is-triple">
            <Slot step={1} title="Upload First Image" subtitle="The original to compare against" tool={tool} input={first} onSample={loadPair} />
            <Slot step={2} title="Upload Second Image" subtitle="The version you want to check" tool={tool} input={second} onSample={loadPair} />

            <StepCard
              step={3}
              title="Comparison Result"
              subtitle="See what changed between the two images"
            >
              {!ready || !result ? (
                <p className="meta-empty">
                  {left || right ? "Add the second image to run the comparison." : "Add two images to compare them."}
                </p>
              ) : (
                <>
                  <div className="meta-tabs" role="tablist" aria-label="Comparison view">
                    {VIEWS.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={view === entry.id}
                        onClick={() => setView(entry.id)}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>

                  {view === "difference" && (
                    <>
                      <div className="preview-stage">
                        <canvas ref={diffRef} role="img" aria-label="Difference map" />
                      </div>
                      <p className="diff-legend"><i aria-hidden /> Red marks the pixels that differ</p>
                    </>
                  )}

                  {view === "side" && left && right && (
                    <div className="compare-grid">
                      <div className="compare-pane">
                        <span>First image</span>
                        <div className="preview-stage"><img src={left.url} alt={left.name} /></div>
                      </div>
                      <div className="compare-pane">
                        <span>Second image</span>
                        <div className="preview-stage"><img src={right.url} alt={right.name} /></div>
                      </div>
                    </div>
                  )}

                  {view === "slider" && left && right && (
                    <>
                      <div className="slider-stage">
                        <img src={left.url} alt={left.name} />
                        <div className="slider-top" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                          <img src={right.url} alt={right.name} />
                        </div>
                        <span className="slider-handle" style={{ left: `${split}%` }} aria-hidden>
                          <i><ChevronsLeftRight size={16} /></i>
                        </span>
                        <input
                          className="slider-input"
                          type="range"
                          min={0}
                          max={100}
                          value={split}
                          aria-label="Comparison slider position"
                          onChange={(event) => setSplit(Number(event.target.value))}
                        />
                      </div>
                      <p className="text-meta" style={{ justifyContent: "center" }}>
                        <span>Second image on the left of the handle, first on the right</span>
                      </p>
                    </>
                  )}

                  <RangeField
                    label="Sensitivity"
                    min={0}
                    max={100}
                    accent
                    unit="%"
                    value={sensitivity}
                    onChange={setSensitivity}
                    help="Higher sensitivity flags smaller differences."
                  />

                  <div className="stat-row">
                    <div className="stat"><small>Different</small><strong>{result.percentage}%</strong></div>
                    <div className="stat"><small>Pixels</small><strong>{result.changed.toLocaleString("en-US")}</strong></div>
                    <div className="stat"><small>Compared at</small><strong>{result.width} × {result.height}</strong></div>
                  </div>
                </>
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={error ? "error" : ready ? "ready" : "idle"}
            title={error || (result ? tool.readyTitle : "Upload two images to begin")}
            note={error
              ? "Fix the problem above and try again."
              : result
                ? summarise(result)
                : "Both slots need an image before anything can be compared."}
          >
            {ready && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { first.clear(); second.clear(); }}
                >
                  <RefreshCw size={15} /> Compare again
                </button>
                <button type="button" className="btn btn-primary" onClick={download}>
                  <Download size={17} /> {tool.action}
                </button>
              </>
            )}
          </StatusBar>
        </div>
      </div>

      <TipBar title={geometry?.rescaled ? "The images are different sizes" : "Images look different?"}>
        {geometry?.rescaled
          ? "The second image was scaled to the first one's frame before comparing, so a size difference alone will not show up as a change."
          : "Adjust the sensitivity to detect more or fewer differences. Re-saved JPEGs always differ slightly, even when they look identical."}
      </TipBar>
    </>
  );
}
