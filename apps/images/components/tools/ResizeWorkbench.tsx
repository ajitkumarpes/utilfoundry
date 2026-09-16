"use client";

import { useState } from "react";
import { ArrowRight, Check, Facebook, Instagram, Link2, Linkedin, Loader2, Monitor, Printer, RefreshCw, Scaling, Settings2, Twitter, UploadCloud, Unlink2, Youtube } from "lucide-react";
import { RangeField } from "@/components/ui/Fields";
import { canShareFiles, ChipGroup, EditorAlert, OUTPUT_CHOICES, PanelTitle, ResultPanel, shareFile } from "@/components/ui/EditorParts";
import {
  EditorShell, EditorThumbs, FileCaption, ImageStage, PixelField, errorMessage, processAnother, sizeChange, useFinished
} from "@/components/tools/EditorShell";
import { useEditorImages } from "@/components/tools/useEditorImages";
import { downloadBlob } from "@/lib/canvas/encode";
import { encodeResult, FORMAT_NAME, resizeImage, resolveOutputFormat } from "@/lib/canvas/editor";
import { baseName, formatBytes } from "@/lib/format";
import { planResize, resolveResizeTarget, type FitMode } from "@/lib/geometry";
import { RESIZE_PRESETS } from "@/lib/tool-content";
import type { ToolDefinition } from "@/lib/tools";

const LOSSY = new Set(["jpeg", "webp", "avif"]);
type Mode = "pixels" | "percentage" | "preset";

const FIT_CHOICES: { value: FitMode; label: string }[] = [
  { value: "contain", label: "Contain" },
  { value: "cover", label: "Cover" },
  { value: "fill", label: "Fill" },
  { value: "inside", label: "Inside" }
];

const FIT_HELP: Record<FitMode, string> = {
  contain: "Fits the whole image inside the size and pads the rest (transparent, or white for JPG).",
  cover: "Fills the exact size and trims whatever overflows, from the centre.",
  fill: "Stretches to the exact size. Changes the proportions if the shapes differ.",
  inside: "Fits the whole image inside the size; the output shrinks to the image, with no padding."
};

const BRAND = {
  instagram: { icon: Instagram, color: "#d6249f" },
  facebook: { icon: Facebook, color: "#1877f2" },
  youtube: { icon: Youtube, color: "#ff0000" },
  linkedin: { icon: Linkedin, color: "#0a66c2" },
  x: { icon: Twitter, color: "#111827" },
  hd: { icon: Monitor, color: "#475569" },
  print: { icon: Printer, color: "var(--purple)" }
} as const;

function PresetList({ activeId, onPick, limit }: { activeId?: string; onPick: (id: string) => void; limit?: number }) {
  return (
    <div className="preset-list" role="listbox" aria-label="Preset sizes">
      {RESIZE_PRESETS.slice(0, limit).map((preset) => {
        const brand = BRAND[preset.brand];
        const Icon = brand.icon;
        return (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={activeId === preset.id}
            className="preset-item"
            onClick={() => onPick(preset.id)}
          >
            <i style={{ background: brand.color }} aria-hidden><Icon size={13} strokeWidth={2.4} /></i>
            <span>{preset.label}</span>
            <small>{preset.width} × {preset.height}</small>
          </button>
        );
      })}
    </div>
  );
}

function CheckButton({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" className="check" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)}>
      <i aria-hidden>{checked && <Check size={12} strokeWidth={3.2} />}</i>
      <span>{label}{note && <small>{note}</small>}</span>
    </button>
  );
}

export function ResizeWorkbench({ tool }: { tool: ToolDefinition }) {
  const images = useEditorImages();
  const image = images.active;
  const [mode, setMode] = useState<Mode>("pixels");
  const [dims, setDims] = useState<{ owner: string; width: number; height: number } | null>(null);
  const [percentage, setPercentage] = useState(50);
  const [presetId, setPresetId] = useState(RESIZE_PRESETS[0].id);
  const [keepAspect, setKeepAspect] = useState(true);
  const [preventEnlargement, setPreventEnlargement] = useState(true);
  const [fit, setFit] = useState<FitMode>("contain");
  const [choice, setChoice] = useState("auto");
  const [quality, setQuality] = useState(90);
  const [allPresets, setAllPresets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, replace] = useFinished();

  // A sensible first target: web width for large photos, the original size otherwise.
  const source = image ?? { width: 1, height: 1 };
  const ratio = source.width / source.height;
  const start = source.width > 1920 ? { width: 1920, height: Math.round(1920 / ratio) } : { width: source.width, height: source.height };
  const current = dims && image && dims.owner === image.id ? dims : start;
  const setSize = (width: number, height: number) => image && setDims({ owner: image.id, width, height });

  const preset = RESIZE_PRESETS.find((item) => item.id === presetId) ?? RESIZE_PRESETS[0];
  const requested = mode === "preset" ? preset
    : mode === "percentage" ? { width: Math.round((source.width * percentage) / 100), height: Math.round((source.height * percentage) / 100) }
      : current;
  const target = resolveResizeTarget(source, {
    mode,
    width: requested.width,
    height: requested.height,
    percentage,
    keepAspect: mode === "pixels" && keepAspect,
    preventEnlargement
  });
  // With the ratio locked the box already has the image's shape, so there is nothing to fit.
  const effectiveFit: FitMode = mode === "pixels" && keepAspect ? "fill" : fit;
  const plan = planResize(source, target, effectiveFit);

  const format = resolveOutputFormat(choice, image?.type ?? "");
  const background = effectiveFit === "contain" && format === "jpeg" ? "#ffffff" : null;
  const key = JSON.stringify([target, effectiveFit, format, quality]);
  const result = finished && image && finished.sourceId === image.id && finished.key === key ? finished : null;

  function pickPreset(id: string) {
    setMode("preset");
    setPresetId(id);
  }

  function reset() {
    setMode("pixels");
    setDims(null);
    setPercentage(50);
    setKeepAspect(true);
    setPreventEnlargement(true);
    setFit("contain");
    setChoice("auto");
    setQuality(90);
    setError("");
  }

  async function apply() {
    if (!image) return;
    setBusy(true);
    setError("");
    try {
      const canvas = resizeImage(image.element, image, target, effectiveFit, background);
      const encoded = await encodeResult(canvas, format, quality);
      replace({ ...encoded, name: `${baseName(image.name)}-${encoded.width}x${encoded.height}.${encoded.extension}`, key, sourceId: image.id });
    } catch (cause) {
      setError(errorMessage(cause, "The image could not be resized."));
    } finally {
      setBusy(false);
    }
  }

  const shrunk = Boolean(image) && preventEnlargement && (target.width < requested.width - 1 || target.height < requested.height - 1);
  const smaller = result && image ? result.blob.size < image.size : false;

  return (
    <EditorShell
      tool={tool}
      images={images}
      preview={image && (
        <>
          <PanelTitle icon={<UploadCloud size={18} />} title="Upload & Preview" />
          <ImageStage image={image} label="Original" meta={`${image.width} × ${image.height}`} />
          <FileCaption image={image} onRemove={() => images.remove(image.id)} />
          <EditorThumbs images={images} />
        </>
      )}
      settings={(
        <>
          <PanelTitle
            icon={<Settings2 size={18} />}
            title="Resize Settings"
            actions={<button type="button" className="ghost-button" onClick={reset}><RefreshCw size={14} /> Reset</button>}
          />

          <div className="field">
            <span className="field-label">Resize mode</span>
            <div className="seg-tabs" role="tablist" aria-label="Resize mode">
              {(["pixels", "percentage", "preset"] as Mode[]).map((value) => (
                <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}>
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {mode === "pixels" && (
            <>
              <div className="dimension-row">
                <PixelField label="Width (px)" min={1} value={current.width} onCommit={(width) => setSize(width, keepAspect ? Math.max(1, Math.round(width / ratio)) : current.height)} />
                <button
                  type="button"
                  className="lock-button"
                  aria-pressed={keepAspect}
                  aria-label={keepAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}
                  onClick={() => setKeepAspect((value) => !value)}
                >
                  {keepAspect ? <Link2 size={17} /> : <Unlink2 size={17} />}
                </button>
                <PixelField label="Height (px)" min={1} value={current.height} onCommit={(height) => setSize(keepAspect ? Math.max(1, Math.round(height * ratio)) : current.width, height)} />
              </div>
            </>
          )}

          {mode === "percentage" && (
            <RangeField label="Scale" min={1} max={400} accent unit="%" value={percentage} onChange={setPercentage} help="Percent of the original width and height." />
          )}

          {mode === "preset" && <PresetList activeId={presetId} onPick={setPresetId} />}

          <div className="check-pair">
            {mode === "pixels" && <CheckButton label="Maintain aspect ratio" checked={keepAspect} onChange={setKeepAspect} />}
            <CheckButton label="Prevent enlargement" note="Never upscale past the original" checked={preventEnlargement} onChange={setPreventEnlargement} />
          </div>

          {!(mode === "pixels" && keepAspect) && mode !== "percentage" && (
            <div className="field">
              <ChipGroup label="Fit mode" value={fit} choices={FIT_CHOICES} onChange={(value) => setFit(value as FitMode)} />
              <span className="field-help">{FIT_HELP[fit]}</span>
            </div>
          )}

          <ChipGroup label="Output format" value={choice} choices={OUTPUT_CHOICES} onChange={setChoice} />
          {LOSSY.has(format) && <RangeField label="Quality" min={40} max={100} accent unit="%" value={quality} onChange={setQuality} />}

          {image && (
            <p className="resize-summary" aria-live="polite">
              <span>{image.width} × {image.height}</span>
              <ArrowRight size={14} aria-hidden />
              <b>{plan.canvas.width} × {plan.canvas.height} px</b>
              {shrunk && <small>Scaled down to avoid enlarging</small>}
            </p>
          )}

          <EditorAlert message={error} />
          <button type="button" className="btn btn-primary btn-block-lg" disabled={!image || busy} onClick={apply}>
            {busy ? <Loader2 size={18} className="spin" aria-hidden /> : <Scaling size={18} aria-hidden />} Resize Image
          </button>
        </>
      )}
      below={result && image && (
        <ResultPanel
          title="Resized Image Preview"
          thumbUrl={result.url}
          thumbBadge={`${result.width} × ${result.height}`}
          transparent={!background && format !== "jpeg"}
          details={[
            { label: "Original", value: `${image.width} × ${image.height} · ${formatBytes(image.size)}` },
            { label: "New dimensions", value: `${result.width} × ${result.height}` },
            { label: "File size", value: formatBytes(result.blob.size) },
            { label: "Format", value: FORMAT_NAME[result.format] ?? result.format.toUpperCase() }
          ]}
          highlight={{ value: sizeChange(image.size, result.blob.size), label: smaller ? "smaller file size" : "larger than the original", tone: smaller ? "good" : "neutral" }}
          success="Your resized image is ready!"
          onDownload={() => downloadBlob(result.blob, result.name)}
          onProcessAnother={() => processAnother(images, () => replace(null))}
          onShare={canShareFiles() ? () => { shareFile(result.blob, result.name).catch((cause) => setError(errorMessage(cause, "Sharing failed."))); } : undefined}
        />
      )}
      railTop={(
        <section className="card rail-card">
          <h2>Popular Resolutions</h2>
          <PresetList activeId={mode === "preset" ? presetId : undefined} onPick={pickPreset} limit={allPresets ? undefined : 5} />
          <button type="button" className="link-button" style={{ marginTop: 10 }} aria-expanded={allPresets} onClick={() => setAllPresets((open) => !open)}>
            {allPresets ? "Show fewer" : "View all presets"} <ArrowRight size={13} aria-hidden />
          </button>
        </section>
      )}
    />
  );
}
