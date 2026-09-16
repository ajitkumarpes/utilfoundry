"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, RefreshCw, Sparkles } from "lucide-react";
import { CompareSlider } from "@/components/ui/CompareSlider";
import { ComparePanes, PreviewEmpty } from "@/components/ui/PreviewFrame";
import { StepCard } from "@/components/ui/StepCard";
import { DownloadSplit, StatusBar } from "@/components/ui/StatusBar";
import { FileList, SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { OptionsRail } from "@/components/tools/OptionsRail";
import { useCopy } from "@/components/tools/useCopy";
import { useImageInput } from "@/components/tools/useImageInput";
import { FORMAT_NAME, resizeImage } from "@/lib/canvas/editor";
import { downloadBlob, encodeCanvas } from "@/lib/canvas/encode";
import { loadImageElement } from "@/lib/canvas/load";
import { defaultsFor } from "@/lib/defaults";
import { baseName, formatBytes, formatNumber } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { reflow } from "@/lib/text";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import type { ToolOptions } from "@/lib/canvas/types";

type TextResult = { kind: "text"; text: string; confidence: number | null; raw: unknown };
type ImageResult = { kind: "image"; url: string; blob: Blob; width: number; height: number };
/** `key` fingerprints the worker settings; changing them retires the result. */
type Result = (TextResult | ImageResult) & { sourceId: string; key: string };

/** Option keys the Python worker understands, per tool. */
const WORKER_FIELDS: Record<string, string[]> = {
  "ocr-image": ["language", "psm"],
  "screenshot-to-text": ["language", "psm"],
  "image-upscaler": ["scale"],
  "background-removal": []
};

const ANOTHER: Record<string, string> = {
  "image-upscaler": "Upscale Another Image",
  "background-removal": "Process Another Image"
};

export function WorkerWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;

  const [options, setOptions] = useState<ToolOptions>(() => defaultsFor(tool.id));
  const [stored, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [tab, setTab] = useState<"text" | "raw">("text");
  const { copy, copied } = useCopy();

  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);
  const set = useCallback((key: string, value: string | number | boolean) => {
    setOptions((current) => ({ ...current, [key]: value }));
  }, []);

  const fields = useMemo(() => WORKER_FIELDS[tool.id] ?? [], [tool.id]);
  const key = JSON.stringify(fields.map((field) => options[field] ?? ""));
  // A result belongs to one upload and one set of settings. Anything else simply
  // stops matching, which is cheaper and safer than clearing state from an effect.
  const result = stored && stored.sourceId === image?.id && stored.key === key ? stored : null;
  const preserve = options.preserveFormatting !== false && options.preserveFormatting !== "false";
  const textValue = result?.kind === "text"
    ? (tab === "raw" ? JSON.stringify(result.raw, null, 2) : preserve ? result.text : reflow(result.text))
    : "";
  const outputFormat = String(options.format ?? "png");

  useEffect(() => () => { if (stored?.kind === "image") URL.revokeObjectURL(stored.url); }, [stored]);

  const run = useCallback(async () => {
    if (!image?.file) return;
    setBusy(true);
    setRunError("");
    try {
      const body = new FormData();
      body.append("tool", tool.id);
      body.append("file", image.file);
      for (const field of fields) body.append(field, String(options[field] ?? ""));

      const response = await fetch("/api/process", { method: "POST", body });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The image could not be processed.");
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = await response.json() as { text?: string; confidence?: number | null };
        setResult({ kind: "text", sourceId: image.id, key, text: payload.text ?? "", confidence: payload.confidence ?? null, raw: payload });
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const probe = await loadImageElement(url).catch(() => null);
        setResult({ kind: "image", sourceId: image.id, key, url, blob, width: probe?.naturalWidth ?? 0, height: probe?.naturalHeight ?? 0 });
      }
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : "The image could not be processed.");
    } finally {
      setBusy(false);
    }
  }, [image, options, tool.id, fields, key]);

  const download = useCallback(async () => {
    if (!result || !image) return;
    if (result.kind === "text") {
      downloadBlob(new Blob([textValue], { type: "text/plain;charset=utf-8" }), `${baseName(image.name)}.${tab === "raw" ? "json" : "txt"}`);
      return;
    }
    // The worker always returns PNG; the chosen format and size are applied here.
    const maxSide = Number(options.outputSize) || 0;
    try {
      if (outputFormat === "png" && !maxSide) {
        downloadBlob(result.blob, `${baseName(image.name)}-${tool.id}.png`);
        return;
      }
      const bitmap = await createImageBitmap(result.blob);
      const size = { width: bitmap.width, height: bitmap.height };
      const shrink = maxSide ? Math.min(1, maxSide / Math.max(size.width, size.height)) : 1;
      const target = { width: Math.round(size.width * shrink), height: Math.round(size.height * shrink) };
      const canvas = resizeImage(bitmap, size, target, "fill", outputFormat === "jpeg" ? "#ffffff" : null);
      bitmap.close();
      const { blob, extension } = await encodeCanvas(canvas, outputFormat, Number(options.quality ?? 92));
      downloadBlob(blob, `${baseName(image.name)}-${tool.id}.${extension}`);
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : "The image could not be saved.");
    }
  }, [result, image, tool.id, tab, textValue, options.outputSize, options.quality, outputFormat]);

  const copyText = useCallback(async () => {
    if (result?.kind !== "text") return;
    if (!(await copy(textValue, "text"))) {
      setRunError("Copying is blocked in this browser. Select the text and copy it manually.");
    }
  }, [result, copy, textValue]);

  const error = input.error || runError;
  const tone = error ? "error" : busy ? "busy" : result ? "ready" : "idle";
  const stats = result?.kind === "text"
    ? {
      characters: result.text.trim().length,
      words: result.text.trim() ? result.text.trim().split(/\s+/).length : 0,
      lines: result.text.trim() ? result.text.trim().split(/\r?\n/).length : 0
    }
    : null;
  const emptyText = stats?.characters === 0;

  const statusTitle = error
    || (busy ? "Processing on the local worker…" : "")
    || (result
      ? (emptyText ? "No text was found in this image." : tool.readyTitle)
      : image ? "Ready to process" : "Upload an image to begin");
  const statusNote = error
    ? "The worker service must be running for this tool. Start it with docker compose up."
    : busy
      ? "Large images, and 4× or 8× upscales, take a little longer."
      : result
      ? (stats ? (emptyText ? "Try the “Sparse / screenshot” mode, pick the right language, or use a sharper image." : `Found ${formatNumber(stats.characters)} characters in the image.`) : tool.readyNote)
      : image
        ? `Click “Run ${tool.name}” to process this image on the local worker.`
        : "Drop a file or pick a sample to start.";

  const scale = String(options.scale ?? "2");

  return (
    <div className="workspace">
      <div className="workspace-main">
        <div className={`step-grid ${result ? "is-result" : ""}`}>
          <StepCard step={1} title="Upload Image" subtitle={tool.uploadNote}>
            <UploadZone compact={Boolean(image)} multiple={false} accept="image/*" label="Choose Image" hint={acceptedFormats(tool)} maxNote="Max 32 MB per file" onFiles={input.addFiles} />
            {image
              ? <FileList items={input.images} onRemove={input.remove} onClear={input.clear} />
              : <SampleStrip samples={samples} activeSrc={input.sampleSrc} onPick={input.addSample} />}
          </StepCard>

          <StepCard
            step={2}
            title={tool.output === "text" ? "Preview & Extracted Text" : tool.id === "image-upscaler" ? "Preview & Compare" : "Result"}
            subtitle={tool.output === "text"
              ? "Review the image and copy the extracted text"
              : tool.id === "image-upscaler" ? "Drag the handle to compare the original and the upscaled image" : "Original on the left, background removed on the right"}
            actions={image ? <button type="button" className="btn btn-outline btn-sm" onClick={input.clear}><RefreshCw size={14} /> Change Image</button> : undefined}
          >
            {!image && <PreviewEmpty message={tool.output === "text" ? "Add an image to extract its text." : "Add an image to get started."} />}

            {image && !result && (
              <div className="preview-stage">
                <img src={image.url} alt={image.name} />
              </div>
            )}

            {result?.kind === "image" && image && tool.id === "image-upscaler" && (
              <CompareSlider
                before={{ src: image.url, alt: "Original", label: `Original (${image.width} × ${image.height})`, meta: formatBytes(image.size) }}
                after={{ src: result.url, alt: "Upscaled", label: `Upscaled (${scale}×)`, meta: `${result.width} × ${result.height} · ${formatBytes(result.blob.size)}` }}
              />
            )}

            {result?.kind === "image" && image && tool.id !== "image-upscaler" && (
              <ComparePanes
                beforeLabel="Original Image"
                afterLabel="Background Removed"
                before={<img src={image.url} alt="Original" />}
                after={<img src={result.url} alt="Result" />}
                transparentAfter
              />
            )}

            {result?.kind === "text" && image && (
              <div className="ocr-split">
                <div className="ocr-pane">
                  <span className="ocr-pane-title">Image Preview</span>
                  <div className="preview-stage"><img src={image.url} alt={image.name} /></div>
                </div>
                <div className="ocr-pane">
                  <div className="ocr-pane-head">
                    <span className="ocr-pane-title">Extracted Text</span>
                    <div className="tab-row" role="tablist" aria-label="Output format">
                      <button type="button" role="tab" aria-selected={tab === "text"} onClick={() => setTab("text")}>Text</button>
                      <button type="button" role="tab" aria-selected={tab === "raw"} onClick={() => setTab("raw")}>Raw</button>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={copyText}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <textarea className="text-output code-output" readOnly value={textValue} aria-label="Extracted text" />
                  {stats && (
                    <p className="text-meta">
                      <span>Characters: {formatNumber(stats.characters)}</span>
                      <span>Words: {formatNumber(stats.words)}</span>
                      <span>Lines: {formatNumber(stats.lines)}</span>
                      {result.confidence !== null && <span>Confidence: {result.confidence}%</span>}
                    </p>
                  )}
                </div>
              </div>
            )}

            {result?.kind === "image" && tool.id !== "image-upscaler" && (
              <p className="text-meta" style={{ justifyContent: "center" }}>
                <span>Original {image?.width} × {image?.height} · {formatBytes(image?.size ?? 0)}</span>
                <span>Result {result.width} × {result.height} · {formatBytes(result.blob.size)}</span>
              </p>
            )}
          </StepCard>
        </div>

        <StatusBar tone={tone} title={statusTitle} note={statusNote}>
          {image && (!result || busy) && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>
              <Sparkles size={17} /> {busy ? "Processing…" : stored && stored.sourceId === image.id ? "Run again with new settings" : `Run ${tool.name}`}
            </button>
          )}
          {result && !busy && result.kind === "text" && (
            <>
              <button type="button" className="btn btn-outline" onClick={input.clear}><RefreshCw size={15} /> Try Another Image</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={download}><Download size={15} /> {tab === "raw" ? ".json" : ".txt"}</button>
              <button type="button" className="btn btn-primary" disabled={emptyText} onClick={copyText}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy Text"}
              </button>
            </>
          )}
          {result && !busy && result.kind === "image" && (
            <>
              <button type="button" className="btn btn-outline" onClick={input.clear}><RefreshCw size={15} /> {ANOTHER[tool.id] ?? "Process Another Image"}</button>
              <DownloadSplit label={`Download ${FORMAT_NAME[outputFormat] ?? "PNG"}`} onAction={download} />
            </>
          )}
        </StatusBar>
      </div>

      <aside className="rail" aria-label={`${tool.name} options`}>
        <OptionsRail tool={tool} options={options} set={set} />
      </aside>
    </div>
  );
}
