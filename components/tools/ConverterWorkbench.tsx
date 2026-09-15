"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download, FileArchive, FileText, Film, Globe, ImageIcon, Images, LayoutGrid, Loader2, PaintBucket, Repeat, Settings2, Sparkles, Target, Trash2, UploadCloud, X
} from "lucide-react";
import { RangeField, SelectField } from "@/components/ui/Fields";
import { EditorAlert, PanelTitle } from "@/components/ui/EditorParts";
import { InfoRail } from "@/components/ui/InfoRail";
import { SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { errorMessage, PixelField } from "@/components/tools/EditorShell";
import { useImageInput } from "@/components/tools/useImageInput";
import { EXTENSION_BY_MIME, serverReadableFile, uniqueName } from "@/lib/batch";
import { encodeBmp } from "@/lib/bmp";
import { resizeImage } from "@/lib/canvas/editor";
import { context, createCanvas } from "@/lib/canvas/effects";
import { canvasToBlob, downloadBlob } from "@/lib/canvas/encode";
import type { SourceImage } from "@/lib/canvas/types";
import { formatBytes } from "@/lib/format";
import { createIco, type IconSource } from "@/lib/ico";
import { samplesFor } from "@/lib/samples";
import { FORMAT_INFO, type FormatId } from "@/lib/tool-content";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import { createZip } from "@/lib/zip";

type Target = "jpeg" | "png" | "webp" | "avif" | "bmp" | "tiff" | "gif" | "ico";

const TARGETS: { value: Target; label: string; id: FormatId; icon: ReactNode }[] = [
  { value: "jpeg", label: "JPG", id: "jpg", icon: <ImageIcon size={20} /> },
  { value: "png", label: "PNG", id: "png", icon: <LayoutGrid size={20} /> },
  { value: "webp", label: "WebP", id: "webp", icon: <Globe size={20} /> },
  { value: "avif", label: "AVIF", id: "avif", icon: <Sparkles size={20} /> },
  { value: "bmp", label: "BMP", id: "bmp", icon: <PaintBucket size={20} /> },
  { value: "tiff", label: "TIFF", id: "tiff", icon: <FileText size={20} /> },
  { value: "gif", label: "GIF", id: "gif", icon: <Film size={20} /> },
  { value: "ico", label: "ICO", id: "ico", icon: <Target size={20} /> }
];

const LOSSY = new Set<Target>(["jpeg", "webp", "avif"]);
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const CONCURRENCY = 3;

const RESIZE_CHOICES = [
  { value: "none", label: "Keep original size" },
  { value: "3840", label: "Fit within 3840 px (4K)" },
  { value: "1920", label: "Fit within 1920 px (Full HD)" },
  { value: "1280", label: "Fit within 1280 px" },
  { value: "800", label: "Fit within 800 px" },
  { value: "custom", label: "Custom size…" }
];

const EXTRA_NOTE: Partial<Record<Target, string>> = {
  jpeg: "JPG has no transparency: transparent areas become white.",
  gif: "Animated GIF and WebP sources keep every frame.",
  webp: "Animated GIF and WebP sources keep every frame.",
  ico: "Each icon size is squared, with transparent padding, and packed into one .ico file."
};

type Settings = { target: Target; quality: number; resize: string; width: number; height: number; stretch: boolean; icons: number[] };
const DEFAULTS: Settings = { target: "webp", quality: 85, resize: "none", width: 1920, height: 0, stretch: false, icons: [16, 32, 48, 256] };

type Job =
  | { status: "working"; key: string }
  | { status: "error"; key: string; error: string }
  | { status: "done"; key: string; blob: Blob; width: number; height: number };

const fingerprint = (settings: Settings) => JSON.stringify(settings);

async function decode(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  return { bitmap, size: { width: bitmap.width, height: bitmap.height } };
}

/** PNG from the server → BMP, keeping alpha when there is any. */
async function toBmp(png: Blob) {
  const { bitmap, size } = await decode(png);
  const canvas = createCanvas(size.width, size.height);
  const ctx = context(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, size.width, size.height);
  return new Blob([encodeBmp(data, size.width, size.height) as BlobPart], { type: "image/bmp" });
}

/** PNG from the server → a multi-size .ico, each size fitted into its square. */
async function toIco(png: Blob, sizes: number[]) {
  const { bitmap, size } = await decode(png);
  const sources: IconSource[] = [];
  for (const side of sizes) {
    const canvas = resizeImage(bitmap, size, { width: side, height: side }, "contain");
    const pixels = context(canvas).getImageData(0, 0, side, side).data;
    const encoded = new Uint8Array(await (await canvasToBlob(canvas, "image/png", 100)).arrayBuffer());
    sources.push({ size: side, pixels, png: encoded });
  }
  bitmap.close();
  return createIco(sources);
}

function StatusPill({ job, target }: { job?: Job; target: string }) {
  if (!job) return <span className="job-pill">Ready</span>;
  if (job.status === "working") return <span className="job-pill is-working"><Loader2 size={12} className="spin" aria-hidden /> Converting…</span>;
  if (job.status === "error") return <span className="job-pill is-error" title={job.error}>Failed</span>;
  return <span className="job-pill is-done">{target} · {formatBytes(job.blob.size)}</span>;
}

export function ConverterWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: true, max: 20 });
  const { images } = input;
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const urls = useRef<Record<string, string>>({});

  useEffect(() => () => Object.values(urls.current).forEach((url) => URL.revokeObjectURL(url)), []);

  const update = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }));
  const key = fingerprint(settings);
  const active = TARGETS.find((item) => item.value === settings.target) ?? TARGETS[0];
  const fresh = (image: SourceImage) => (jobs[image.id]?.key === key ? jobs[image.id] : undefined);
  const pending = images.filter((image) => fresh(image)?.status !== "done");
  const done = images.flatMap((image) => {
    const job = fresh(image);
    return job?.status === "done" ? [{ image, job }] : [];
  });

  function setJob(id: string, job: Job) {
    setJobs((current) => ({ ...current, [id]: job }));
  }

  /** The box sent to the server; zeros mean "leave that side alone". */
  function box() {
    if (settings.target === "ico" || settings.resize === "none") return null;
    if (settings.resize === "custom") return { width: settings.width, height: settings.height, keepAspect: !settings.stretch };
    const side = Number(settings.resize);
    return { width: side, height: side, keepAspect: true };
  }

  async function convertOne(image: SourceImage) {
    const chosen = settings;
    const jobKey = key;
    setJob(image.id, { status: "working", key: jobKey });
    try {
      const body = new FormData();
      body.append("tool", "image-converter");
      body.append("file", await serverReadableFile(image));
      // BMP and ICO have no server encoder; they are wrapped here from a lossless PNG.
      body.append("format", chosen.target === "bmp" || chosen.target === "ico" ? "png" : chosen.target);
      body.append("quality", String(chosen.quality));
      const resize = box();
      if (resize) {
        if (resize.width) body.append("width", String(resize.width));
        if (resize.height) body.append("height", String(resize.height));
        body.append("keepAspect", String(resize.keepAspect));
      }
      const response = await fetch("/api/process", { method: "POST", body });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The server could not convert this image.");
      }
      let blob = await response.blob();
      let width = Number(response.headers.get("x-image-width")) || image.width;
      let height = Number(response.headers.get("x-image-height")) || image.height;
      if (chosen.target === "bmp") blob = await toBmp(blob);
      if (chosen.target === "ico") {
        const sizes = chosen.icons.length ? chosen.icons : DEFAULTS.icons;
        blob = await toIco(blob, sizes);
        width = height = Math.max(...sizes);
      }
      setJob(image.id, { status: "done", key: jobKey, blob, width, height });
    } catch (cause) {
      setJob(image.id, { status: "error", key: jobKey, error: errorMessage(cause, "Conversion failed.") });
    }
  }

  async function run() {
    const queue = [...pending];
    if (!queue.length) return;
    setRunning(true);
    setError("");
    const worker = async () => {
      for (let image = queue.shift(); image; image = queue.shift()) await convertOne(image);
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
  }

  function remove(id: string) {
    setJobs(({ [id]: _gone, ...rest }) => rest);
    input.remove(id);
  }

  function clearAll() {
    setJobs({});
    input.clear();
  }

  const nameFor = (image: SourceImage, blob: Blob, taken: Set<string>) =>
    uniqueName(image.name, "converted", EXTENSION_BY_MIME[blob.type] ?? active.label.toLowerCase(), taken);

  async function downloadAll() {
    try {
      const taken = new Set<string>();
      const entries = await Promise.all(done.map(async ({ image, job }) => ({
        name: nameFor(image, job.blob, taken),
        data: new Uint8Array(await job.blob.arrayBuffer())
      })));
      downloadBlob(createZip(entries), `converted-${active.label.toLowerCase()}.zip`);
    } catch (cause) {
      setError(errorMessage(cause, "The ZIP could not be created."));
    }
  }

  const toggleIcon = (side: number) => update({
    icons: settings.icons.includes(side) ? settings.icons.filter((value) => value !== side) : [...settings.icons, side].sort((a, b) => a - b)
  });

  const actionLabel = !images.length ? "Convert Images"
    : !pending.length ? `All Converted to ${active.label}`
      : `Convert ${pending.length === 1 ? "1 Image" : `${pending.length} Images`} to ${active.label}`;

  return (
    <div className="workspace">
      <div className="workspace-main">
        <section className="card editor-card" aria-label="Upload images">
          <PanelTitle icon={<UploadCloud size={18} />} title="Upload Images" />
          <UploadZone multiple accept="image/*" label="Choose Images" hint={acceptedFormats(tool)} maxNote="Max 32 MB each · Up to 20 images" onFiles={input.addFiles} />
          {!images.length && <SampleStrip samples={samplesFor(tool.id)} activeSrc={input.sampleSrc} onPick={input.addSample} />}
          <EditorAlert message={input.error} />
        </section>

        <section className="card editor-card" aria-label="Output format">
          <PanelTitle icon={<Settings2 size={18} />} title="Select Output Format" />
          <div className="format-tiles" role="radiogroup" aria-label="Output format">
            {TARGETS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={settings.target === item.value}
                className="format-tile"
                title={FORMAT_INFO[item.id].note}
                onClick={() => update({ target: item.value })}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          <p className="editor-note">
            <b>{active.label}:</b> {FORMAT_INFO[active.id].note} {EXTRA_NOTE[settings.target] ?? ""}
          </p>
        </section>

        <section className="card editor-card" aria-label="Conversion settings">
          <PanelTitle
            icon={<Settings2 size={18} />}
            title="Conversion Settings"
            actions={<button type="button" className="ghost-button" onClick={() => setSettings({ ...DEFAULTS, target: settings.target })}><Repeat size={14} /> Reset</button>}
          />
          <div className="compress-settings">
            {LOSSY.has(settings.target)
              ? <RangeField label="Image Quality" min={20} max={100} accent unit="%" value={settings.quality} onChange={(quality) => update({ quality })} scale={["Smaller file", "Balanced", "Best quality"]} />
              : <div className="field"><span className="field-label">Image Quality</span><p className="editor-note">{active.label} is written losslessly{settings.target === "gif" ? " with a 256-colour palette" : ""}, so there is no quality setting.</p></div>}

            {settings.target === "ico" ? (
              <div className="field">
                <span className="field-label">Icon sizes</span>
                <div className="icon-size-row" role="group" aria-label="Icon sizes">
                  {ICON_SIZES.map((side) => (
                    <button key={side} type="button" className="chip" aria-pressed={settings.icons.includes(side)} onClick={() => toggleIcon(side)}>{side}</button>
                  ))}
                </div>
                <span className="field-help">{settings.icons.length ? `${settings.icons.join(", ")} px` : "Pick at least one size (16, 32, 48 and 256 are used otherwise)."}</span>
              </div>
            ) : (
              <div className="field">
                <SelectField label="Resize (optional)" value={settings.resize} options={RESIZE_CHOICES} onChange={(resize) => update({ resize })} />
                {settings.resize === "custom" && (
                  <>
                    <div className="split-row">
                      <PixelField label="Width (px)" value={settings.width} onCommit={(width) => update({ width })} />
                      <PixelField label="Height (px)" value={settings.height} onCommit={(height) => update({ height })} />
                    </div>
                    <button type="button" className="check" role="checkbox" aria-checked={settings.stretch} style={{ marginTop: 10 }} onClick={() => update({ stretch: !settings.stretch })}>
                      <i aria-hidden>{settings.stretch && "✓"}</i>
                      <span>Stretch to the exact size <small>Otherwise the image fits inside, keeping its shape. 0 means automatic.</small></span>
                    </button>
                  </>
                )}
                {settings.resize !== "none" && <span className="field-help">Images are never enlarged past their original size.</span>}
              </div>
            )}
          </div>

          <EditorAlert message={error} />
          <button type="button" className="btn btn-primary btn-block-lg" disabled={!pending.length || running} onClick={run}>
            {running ? <Loader2 size={18} className="spin" aria-hidden /> : <Repeat size={18} aria-hidden />} {actionLabel}
          </button>
        </section>

        {images.length > 0 && (
          <section className="card editor-card" aria-label="Your images">
            <PanelTitle
              icon={<Images size={18} />}
              title={`Your Images (${images.length})`}
              actions={<button type="button" className="btn btn-outline btn-sm" onClick={clearAll}><Trash2 size={14} /> Clear all</button>}
            />
            <ul className="queue-list">
              {images.map((image) => {
                const job = fresh(image);
                return (
                  <li key={image.id} className="queue-item">
                    <div className="queue-row">
                      <img src={image.url} alt="" />
                      <span className="queue-name">
                        <b title={image.name}>{image.name}</b>
                        <small>
                          {formatBytes(image.size)} · {image.width} × {image.height}
                          {job?.status === "done" ? ` → ${job.width} × ${job.height}` : ""}
                        </small>
                      </span>
                      <StatusPill job={job} target={active.label} />
                      {job?.status === "done" ? (
                        <button type="button" className="row-icon" aria-label={`Download ${image.name}`} onClick={() => downloadBlob(job.blob, nameFor(image, job.blob, new Set()))}>
                          <Download size={16} />
                        </button>
                      ) : <span className="row-icon" aria-hidden />}
                      <span className="row-icon" aria-hidden />
                      <button type="button" className="row-icon" aria-label={`Remove ${image.name}`} onClick={() => remove(image.id)}>
                        <X size={16} />
                      </button>
                    </div>
                    {job?.status === "error" && <p className="editor-alert queue-error" role="alert">{job.error}</p>}
                  </li>
                );
              })}
            </ul>

            {done.length > 0 && (
              <div className="queue-summary" aria-live="polite">
                <span>
                  <strong>{done.length} converted</strong> to {active.label} · {formatBytes(done.reduce((sum, { job }) => sum + job.blob.size, 0))} in total
                </span>
                {done.length > 1 ? (
                  <button type="button" className="btn btn-success" onClick={downloadAll}><FileArchive size={16} aria-hidden /> Download All (ZIP)</button>
                ) : (
                  <button type="button" className="btn btn-success" onClick={() => downloadBlob(done[0].job.blob, nameFor(done[0].image, done[0].job.blob, new Set()))}>
                    <Download size={16} aria-hidden /> Download {active.label}
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="rail" aria-label={`About ${tool.name}`}>
        <InfoRail tool={tool} include={["reasons", "formats", "tips", "feedback"]} />
      </aside>
    </div>
  );
}
