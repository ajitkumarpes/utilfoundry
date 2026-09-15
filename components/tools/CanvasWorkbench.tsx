"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ComparePanes, PreviewEmpty, PreviewStage, ZoomBar } from "@/components/ui/PreviewFrame";
import { StepCard } from "@/components/ui/StepCard";
import { DownloadSplit, StatusBar } from "@/components/ui/StatusBar";
import { FileList, SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { OptionsRail } from "@/components/tools/OptionsRail";
import { InfoRail } from "@/components/ui/InfoRail";
import { useImageInput } from "@/components/tools/useImageInput";
import { PREVIEW_MAX, render } from "@/lib/canvas/render";
import { downloadBlob, encodeCanvas } from "@/lib/canvas/encode";
import { defaultsFor } from "@/lib/defaults";
import { baseName, formatBytes } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import { loadFile, releaseImage } from "@/lib/canvas/load";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";

const TRANSPARENT_TOOLS = new Set(["rounded-corners", "add-border", "background-removal"]);

/** Label for the right-hand pane when a tool shows a before/after comparison. */
const AFTER_LABEL: Record<string, string> = {
  "blur-image": "Blurred Image",
  "sharpen-image": "Sharpened Image",
  "grayscale-image": "Grayscale Image",
  "background-removal": "Background Removed",
  "image-upscaler": "Upscaled Image"
};

/** Formats that only the server can encode, kept out of the browser-only path. */
function resolveFormat(options: ToolOptions, fallback: string) {
  const format = String(options.format ?? "auto");
  return format === "auto" ? fallback : format;
}

export function CanvasWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;

  const [options, setOptions] = useState<ToolOptions>(() => defaultsFor(tool.id));
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [outputMeta, setOutputMeta] = useState<{ width: number; height: number } | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  // The watermark logo lives here rather than in options, which hold only plain values.
  const [overlay, setOverlay] = useState<SourceImage | null>(null);
  const overlayRef = useRef<SourceImage | null>(null);

  useEffect(() => () => releaseImage(overlayRef.current), []);

  const chooseOverlay = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    try {
      const next = await loadFile(files[0]);
      releaseImage(overlayRef.current);
      overlayRef.current = next;
      setOverlay(next);
      setRenderError("");
    } catch (cause) {
      setRenderError(cause instanceof Error ? cause.message : "The watermark image could not be read.");
    }
  }, []);

  const clearOverlay = useCallback(() => {
    releaseImage(overlayRef.current);
    overlayRef.current = null;
    setOverlay(null);
  }, []);

  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);
  const set = useCallback((key: string, value: string | number | boolean) => {
    setOptions((current) => ({ ...current, [key]: value }));
  }, []);

  // Live preview. Rendering is deferred a frame so dragging a slider stays smooth.
  useEffect(() => {
    if (!image || !holderRef.current) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const result = render(tool.id, image, options, PREVIEW_MAX, { overlay: overlay?.element });
        if (cancelled || !holderRef.current) return;
        result.canvas.style.maxWidth = "100%";
        result.canvas.style.height = "auto";
        result.canvas.setAttribute("role", "img");
        result.canvas.setAttribute("aria-label", `${tool.name} preview`);
        holderRef.current.replaceChildren(result.canvas);
        setOutputMeta({ width: Math.round(result.width / result.scale), height: Math.round(result.height / result.scale) });
        setRenderError("");
      } catch (cause) {
        setRenderError(cause instanceof Error ? cause.message : "The preview could not be rendered.");
      }
    }, 40);
    return () => { cancelled = true; window.clearTimeout(handle); };
  }, [image, options, tool.id, tool.name, overlay]);

  const fallbackFormat = image?.type === "image/png" ? "png" : image?.type === "image/webp" ? "webp" : "jpeg";
  const format = resolveFormat(options, fallbackFormat);

  const download = useCallback(async (overrideFormat?: string) => {
    if (!image) return;
    setBusy(true);
    setRenderError("");
    try {
      const result = render(tool.id, image, options, Infinity, { overlay: overlay?.element });
      const target = overrideFormat ?? format;
      const quality = Number(options.quality ?? 92);
      const { blob, extension } = await encodeCanvas(result.canvas, target, Number.isFinite(quality) ? quality : 92);
      downloadBlob(blob, `${baseName(image.name)}-${tool.id}.${extension}`);
    } catch (cause) {
      setRenderError(cause instanceof Error ? cause.message : "The image could not be exported.");
    } finally {
      setBusy(false);
    }
  }, [image, options, tool.id, format, overlay]);

  const error = input.error || renderError;
  const tone = error ? "error" : busy ? "busy" : image ? "ready" : "idle";
  const transparent = TRANSPARENT_TOOLS.has(tool.id) && format === "png";
  const needsOverlay = tool.id === "watermark-image" && options.mode === "image" && !overlay;

  const canvasHolder = <div ref={holderRef} style={{ display: "contents" }} />;

  return (
    <>
      <div className="workspace">
        <div className="workspace-main">
          <div className="step-grid">
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

            <StepCard
              step={2}
              title="Preview"
              subtitle={tool.preview === "compare" ? "Compare the original and the result" : "See how your image looks"}
            >
              {!image ? <PreviewEmpty /> : tool.preview === "compare" ? (
                <ComparePanes
                  beforeLabel="Original Image"
                  afterLabel={AFTER_LABEL[tool.id] ?? "Result"}
                  before={<img src={image.url} alt="Original" />}
                  after={canvasHolder}
                  transparentAfter={transparent}
                />
              ) : (
                <PreviewStage zoom={zoom} transparent={transparent}>{canvasHolder}</PreviewStage>
              )}

              {image && (
                <>
                  <ZoomBar zoom={zoom} onZoom={setZoom} onFit={() => setZoom(100)} />
                  {outputMeta && (
                    <p className="text-meta" style={{ justifyContent: "center" }}>
                      <span>Source {image.width} × {image.height} · {formatBytes(image.size)}</span>
                      <span>Output {outputMeta.width} × {outputMeta.height} · {format.toUpperCase()}</span>
                    </p>
                  )}
                </>
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={tone}
            title={error || (needsOverlay && image ? "Choose a watermark image" : image ? tool.readyTitle : "Upload an image to begin")}
            note={error ? "Fix the problem above and try again." : needsOverlay && image ? "Pick a logo or other image in the Watermark Options panel." : image ? tool.readyNote : "Drop a file or pick one of the samples to start."}
          >
            {image && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOptions(defaultsFor(tool.id))}>
                  <RefreshCw size={15} /> Reset
                </button>
                <DownloadSplit
                  label={tool.action}
                  busy={busy}
                  disabled={needsOverlay}
                  onAction={() => download()}
                  options={[
                    { value: "png", label: "Download as PNG" },
                    { value: "jpeg", label: "Download as JPG" },
                    { value: "webp", label: "Download as WebP" },
                    { value: "avif", label: "Download as AVIF" }
                  ]}
                  onPick={(value) => download(value)}
                />
              </>
            )}
          </StatusBar>
        </div>

        <aside className="rail" aria-label={`${tool.name} options`}>
          <OptionsRail tool={tool} options={options} set={set} zoom={zoom} onZoom={setZoom} overlay={overlay} onOverlay={chooseOverlay} onClearOverlay={clearOverlay} />
          <InfoRail tool={tool} />
        </aside>
      </div>
      <span className="sr-only" aria-live="polite">{busy ? "Preparing download" : ""}</span>
    </>
  );
}
