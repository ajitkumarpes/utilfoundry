"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Check, Download, FileArchive, Images, Loader2, RefreshCw, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { RangeField } from "@/components/ui/Fields";
import { ChipGroup, EditorAlert, PanelTitle, type Choice } from "@/components/ui/EditorParts";
import { ComparePanes } from "@/components/ui/PreviewFrame";
import { InfoRail } from "@/components/ui/InfoRail";
import { SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { errorMessage, sizeChange } from "@/components/tools/EditorShell";
import { useImageInput } from "@/components/tools/useImageInput";
import { downloadBlob } from "@/lib/canvas/encode";
import type { SourceImage } from "@/lib/canvas/types";
import { EXTENSION_BY_MIME, serverReadableFile, uniqueName } from "@/lib/batch";
import { formatBytes } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import { createZip } from "@/lib/zip";

const FORMAT_CHOICES: Choice[] = [
  { value: "auto", label: "Auto", icon: <span className="chip-dot" aria-hidden /> },
  { value: "jpeg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" }
];

const DEFAULTS = { quality: 70, format: "auto", keepFormat: true };
const CONCURRENCY = 3;

type Settings = { quality: number; format: string; keepFormat: boolean };
type Job =
  | { status: "working"; key: string }
  | { status: "error"; key: string; error: string }
  | { status: "done"; key: string; blob: Blob; url: string; kept: boolean };

const fingerprint = (settings: Settings) => `${settings.format}|${settings.quality}|${settings.keepFormat}`;

function JobPill({ job, before }: { job?: Job; before: number }) {
  if (!job) return <span className="job-pill">Ready</span>;
  if (job.status === "working") return <span className="job-pill is-working"><Loader2 size={12} className="spin" aria-hidden /> Compressing…</span>;
  if (job.status === "error") return <span className="job-pill is-error" title={job.error}>Failed</span>;
  if (job.kept) return <span className="job-pill is-kept" title="Re-encoding could not make this file smaller, so the original is kept.">Already optimized</span>;
  const smaller = job.blob.size < before;
  return (
    <span className={`job-pill ${smaller ? "is-done" : "is-larger"}`}>
      {smaller && <Check size={12} strokeWidth={3} aria-hidden />} {sizeChange(before, job.blob.size)} · {formatBytes(job.blob.size)}
    </span>
  );
}

export function CompressorWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: true, max: 20 });
  const { images } = input;
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [overrides, setOverrides] = useState<Record<string, Partial<Settings>>>({});
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const urls = useRef<Record<string, string>>({});

  useEffect(() => () => Object.values(urls.current).forEach((url) => URL.revokeObjectURL(url)), []);

  const settingsFor = (id: string): Settings => ({ ...settings, ...overrides[id] });
  // A job only counts while it matches the settings it would be run with now.
  const fresh = (image: SourceImage) => {
    const job = jobs[image.id];
    return job && job.key === fingerprint(settingsFor(image.id)) ? job : undefined;
  };
  const pending = images.filter((image) => fresh(image)?.status !== "done");
  const done = images.flatMap((image) => {
    const job = fresh(image);
    return job?.status === "done" ? [{ image, job }] : [];
  });

  function release(id: string) {
    if (urls.current[id]) URL.revokeObjectURL(urls.current[id]);
    delete urls.current[id];
  }

  function setJob(id: string, job: Job) {
    if (job.status !== "working") release(id);
    if (job.status === "done") urls.current[id] = job.url;
    setJobs((current) => ({ ...current, [id]: job }));
  }

  async function compressOne(image: SourceImage) {
    const chosen = settingsFor(image.id);
    const key = fingerprint(chosen);
    setJob(image.id, { status: "working", key });
    try {
      const body = new FormData();
      body.append("tool", "image-compressor");
      body.append("file", await serverReadableFile(image));
      body.append("quality", String(chosen.quality));
      body.append("format", chosen.format);
      body.append("keepFormat", String(chosen.keepFormat));
      const response = await fetch("/api/process", { method: "POST", body });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The server could not compress this image.");
      }
      const blob = await response.blob();
      setJob(image.id, { status: "done", key, blob, url: URL.createObjectURL(blob), kept: response.headers.get("x-compression") === "original" });
    } catch (cause) {
      setJob(image.id, { status: "error", key, error: errorMessage(cause, "Compression failed.") });
    }
  }

  async function run() {
    const queue = [...pending];
    if (!queue.length) return;
    setRunning(true);
    setError("");
    const worker = async () => {
      for (let image = queue.shift(); image; image = queue.shift()) await compressOne(image);
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
  }

  function remove(id: string) {
    release(id);
    setJobs(({ [id]: _gone, ...rest }) => rest);
    setOverrides(({ [id]: _gone, ...rest }) => rest);
    input.remove(id);
  }

  function clearAll() {
    Object.keys(urls.current).forEach(release);
    setJobs({});
    setOverrides({});
    setOpen(null);
    input.clear();
  }

  function outputName(image: SourceImage, blob: Blob, taken: Set<string>) {
    return uniqueName(image.name, "compressed", EXTENSION_BY_MIME[blob.type] ?? "img", taken);
  }

  async function downloadAll() {
    try {
      const taken = new Set<string>();
      const entries = await Promise.all(done.map(async ({ image, job }) => ({
        name: outputName(image, job.blob, taken),
        data: new Uint8Array(await job.blob.arrayBuffer())
      })));
      downloadBlob(createZip(entries), "compressed-images.zip");
    } catch (cause) {
      setError(errorMessage(cause, "The ZIP could not be created."));
    }
  }

  const before = done.reduce((sum, { image }) => sum + image.size, 0);
  const after = done.reduce((sum, { job }) => sum + job.blob.size, 0);
  const actionLabel = !images.length ? "Compress Images"
    : !pending.length ? "All Images Compressed"
      : pending.length === images.length ? `Compress ${images.length === 1 ? "Image" : `${images.length} Images`}`
        : `Compress ${pending.length} Remaining`;

  return (
    <div className="workspace">
      <div className="workspace-main">
        <section className="card editor-card" aria-label="Upload images">
          <UploadZone
            multiple
            accept="image/*"
            label="Choose Images"
            hint={acceptedFormats(tool)}
            maxNote="Max 32 MB each · Up to 20 images"
            onFiles={input.addFiles}
          />
          {!images.length && <SampleStrip samples={samplesFor(tool.id)} activeSrc={input.sampleSrc} onPick={input.addSample} />}
          <EditorAlert message={input.error} />
        </section>

        <section className="card editor-card" aria-label="Compression settings">
          <PanelTitle
            icon={<Settings2 size={18} />}
            title="Compression Settings"
            actions={<button type="button" className="ghost-button" onClick={() => setSettings(DEFAULTS)}><RefreshCw size={14} /> Reset</button>}
          />
          <div className="compress-settings">
            <RangeField
              label="Compression level"
              min={20}
              max={100}
              accent
              unit="%"
              value={settings.quality}
              onChange={(quality) => setSettings((current) => ({ ...current, quality }))}
              scale={["Smaller size", "Balanced", "Higher quality"]}
            />
            <div className="field">
              <ChipGroup label="Output format" value={settings.format} choices={FORMAT_CHOICES} onChange={(format) => setSettings((current) => ({ ...current, format }))} />
              <button
                type="button"
                className="check"
                role="checkbox"
                aria-checked={settings.keepFormat}
                disabled={settings.format !== "auto"}
                style={{ marginTop: 12 }}
                onClick={() => setSettings((current) => ({ ...current, keepFormat: !current.keepFormat }))}
              >
                <i aria-hidden>{settings.keepFormat && <Check size={12} strokeWidth={3.2} />}</i>
                <span>Keep original format when possible <small>Otherwise Auto picks WebP, usually the smallest</small></span>
              </button>
            </div>
          </div>
          <EditorAlert message={error} />
          <button type="button" className="btn btn-primary btn-block-lg" disabled={!pending.length || running} onClick={run}>
            {running ? <Loader2 size={18} className="spin" aria-hidden /> : <Sparkles size={18} aria-hidden />} {actionLabel}
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
                const own = overrides[image.id];
                const chosen = settingsFor(image.id);
                const expanded = open === image.id;
                return (
                  <li key={image.id} className="queue-item">
                    <div className="queue-row">
                      <img src={image.url} alt="" />
                      <span className="queue-name">
                        <b title={image.name}>{image.name}</b>
                        <small>{formatBytes(image.size)} · {image.width} × {image.height}{own ? " · custom settings" : ""}</small>
                      </span>
                      <JobPill job={job} before={image.size} />
                      {job?.status === "done" ? (
                        <button type="button" className="row-icon" aria-label={`Download ${image.name}`} onClick={() => downloadBlob(job.blob, outputName(image, job.blob, new Set()))}>
                          <Download size={16} />
                        </button>
                      ) : <span className="row-icon" aria-hidden />}
                      <button type="button" className="row-icon" aria-label={`Settings for ${image.name}`} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : image.id)}>
                        <Settings2 size={16} />
                      </button>
                      <button type="button" className="row-icon" aria-label={`Remove ${image.name}`} onClick={() => remove(image.id)}>
                        <X size={16} />
                      </button>
                    </div>

                    {job?.status === "error" && <p className="editor-alert queue-error" role="alert">{job.error}</p>}

                    {expanded && (
                      <div className="queue-detail">
                        <div className="compress-settings">
                          <RangeField
                            label="Quality for this image"
                            min={20}
                            max={100}
                            unit="%"
                            value={chosen.quality}
                            onChange={(quality) => setOverrides((current) => ({ ...current, [image.id]: { ...current[image.id], quality } }))}
                          />
                          <ChipGroup
                            label="Format for this image"
                            value={chosen.format}
                            choices={FORMAT_CHOICES}
                            onChange={(format) => setOverrides((current) => ({ ...current, [image.id]: { ...current[image.id], format } }))}
                          />
                        </div>
                        {own && (
                          <button type="button" className="link-button" onClick={() => setOverrides(({ [image.id]: _gone, ...rest }) => rest)}>
                            Use the shared settings again
                          </button>
                        )}
                        {job?.status === "done" && (
                          <ComparePanes
                            beforeLabel={`Original · ${formatBytes(image.size)}`}
                            afterLabel={`Compressed · ${formatBytes(job.blob.size)}`}
                            before={<img src={image.url} alt={`${image.name}, original`} />}
                            after={<img src={job.url} alt={`${image.name}, compressed`} />}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {done.length > 0 && (
              <div className="queue-summary" aria-live="polite">
                <span>
                  <strong>{before > after ? `${formatBytes(before - after)} saved` : "No savings"}</strong>
                  {" "}{sizeChange(before, after)} across {done.length} image{done.length === 1 ? "" : "s"} · {formatBytes(before)} → {formatBytes(after)}
                </span>
                {done.length > 1 ? (
                  <button type="button" className="btn btn-success" onClick={downloadAll}><FileArchive size={16} aria-hidden /> Download All (ZIP)</button>
                ) : (
                  <button type="button" className="btn btn-success" onClick={() => downloadBlob(done[0].job.blob, outputName(done[0].image, done[0].job.blob, new Set()))}>
                    <Download size={16} aria-hidden /> Download Image
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
