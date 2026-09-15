"use client";

import { useEffect, useState } from "react";
import { Aperture, CalendarDays, Camera, Check, ImageIcon, Info, Laptop, Loader2, MapPin, Maximize, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { EditorAlert, PanelTitle, ResultPanel } from "@/components/ui/EditorParts";
import {
  EditorShell, EditorThumbs, ImageStage, describeImage, errorMessage, formatLabel, processAnother, sizeChange, useFinished
} from "@/components/tools/EditorShell";
import { useEditorImages } from "@/components/tools/useEditorImages";
import { createCanvas, context } from "@/lib/canvas/effects";
import { canvasToBlob, downloadBlob } from "@/lib/canvas/encode";
import type { SourceImage } from "@/lib/canvas/types";
import { baseName, formatBytes } from "@/lib/format";
import { readMetadata, type ImageMetadata, type MetadataField } from "@/lib/metadata";
import { STRIP_MODES, stripMetadata, type StripMode } from "@/lib/strip-metadata";
import type { ToolDefinition } from "@/lib/tools";

async function sourceBytes(image: SourceImage) {
  const buffer = image.file ? await image.file.arrayBuffer() : await (await fetch(image.url)).arrayBuffer();
  return new Uint8Array(buffer);
}

function inspect(image: { name: string; size: number; type: string }, bytes: Uint8Array, fallback?: { width: number; height: number }) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return readMetadata({ name: image.name, size: bytes.byteLength, type: image.type, bytes: buffer }, fallback);
}

function formatGps(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

const HEADLINE: { label: string; icon: typeof Camera }[] = [
  { label: "Camera Make", icon: Camera },
  { label: "Camera Model", icon: Camera },
  { label: "Lens Model", icon: Aperture },
  { label: "Date Taken", icon: CalendarDays },
  { label: "Software", icon: Laptop }
];

function MetadataSummary({ data }: { data: ImageMetadata }) {
  const [showAll, setShowAll] = useState(false);
  const fields: MetadataField[] = [...data.exif, ...data.iptc, ...data.xmp];
  const byLabel = new Map(fields.map((field) => [field.label, field.value]));
  const rows = HEADLINE.filter((row) => byLabel.has(row.label));
  const shown = new Set(rows.map((row) => row.label));
  const others = fields.filter((field) => !shown.has(field.label) && !/^GPS/i.test(field.label));

  if (!data.count) {
    return (
      <div className="meta-summary">
        <div className="meta-summary-head"><b>Metadata found in this image</b><span className="count-pill">0 items</span></div>
        <p className="meta-clean">No EXIF, GPS, IPTC or XMP data was found. This image is already clean; removing metadata will leave it unchanged.</p>
      </div>
    );
  }

  return (
    <div className="meta-summary">
      <div className="meta-summary-head">
        <b>Metadata found in this image</b>
        <span className="count-pill">{data.count} item{data.count === 1 ? "" : "s"}</span>
      </div>
      <ul>
        {rows.map(({ label, icon: Icon }) => (
          <li key={label}><Icon size={14} aria-hidden /><span>{label}</span><b title={byLabel.get(label)}>{byLabel.get(label)}</b></li>
        ))}
        {data.gps && (
          <li className="is-risk"><MapPin size={14} aria-hidden /><span>GPS Location</span><b>{formatGps(data.gps.latitude, data.gps.longitude)}</b></li>
        )}
        <li><Maximize size={14} aria-hidden /><span>Image Dimensions</span><b>{data.facts.width} × {data.facts.height}</b></li>
        {others.length > 0 && (
          <li><Info size={14} aria-hidden /><span>Additional info</span><b>{others.slice(0, 3).map((field) => field.label).join(", ")}{others.length > 3 ? ", etc." : ""}</b></li>
        )}
      </ul>
      {showAll && (
        <ul className="meta-all">
          {fields.map((field) => (
            <li key={`${field.key}-${field.label}`}><SlidersHorizontal size={13} aria-hidden /><span>{field.label}</span><b title={field.value}>{field.value}</b></li>
          ))}
        </ul>
      )}
      <button type="button" className="show-all" aria-expanded={showAll} onClick={() => setShowAll((open) => !open)}>
        {showAll ? "Hide the full list" : `Show all ${fields.length} fields`}
      </button>
    </div>
  );
}

type Report = { removed: string[]; before: number; after: number; lossless: boolean };

export function MetadataWorkbench({ tool }: { tool: ToolDefinition }) {
  const images = useEditorImages();
  const image = images.active;
  const [scan, setScan] = useState<{ id: string; data: ImageMetadata | null; error: string } | null>(null);
  const [mode, setMode] = useState<StripMode>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, replace] = useFinished();
  const [report, setReport] = useState<Report | null>(null);

  // Read the active image's metadata once per image; the result is keyed by id,
  // so a slow read for an image the user has already left is simply ignored.
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    sourceBytes(image)
      .then((bytes) => inspect(image, bytes, image))
      .then((data) => { if (!cancelled) setScan({ id: image.id, data, error: "" }); })
      .catch((cause) => { if (!cancelled) setScan({ id: image.id, data: null, error: errorMessage(cause, "The metadata could not be read.") }); });
    return () => { cancelled = true; };
  }, [image]);

  const current = scan && image && scan.id === image.id ? scan : null;
  const lossless = image ? /jpe?g|png|webp/i.test(image.type) : true;
  const result = finished && image && finished.sourceId === image.id && finished.key === mode ? finished : null;

  async function apply() {
    if (!image) return;
    setBusy(true);
    setError("");
    try {
      const bytes = await sourceBytes(image);
      const before = inspect(image, bytes, image).count;
      const stripped = stripMetadata(bytes, mode);
      let blob: Blob;
      let extension: string;
      let removed: string[];
      if (stripped) {
        blob = new Blob([stripped.bytes as BlobPart], { type: stripped.mime });
        extension = stripped.mime === "image/png" ? "png" : stripped.mime === "image/webp" ? "webp" : "jpg";
        removed = stripped.removed;
      } else {
        // Containers that cannot be edited in place are redrawn as PNG, which
        // keeps every pixel and carries nothing else across.
        if (mode !== "all") throw new Error(`${formatLabel(image.type)} files can only be cleaned completely. Choose “Remove all metadata”.`);
        const canvas = createCanvas(image.width, image.height);
        context(canvas).drawImage(image.element, 0, 0);
        blob = await canvasToBlob(canvas, "image/png", 100);
        extension = "png";
        removed = ["All metadata"];
      }
      // Re-read the output rather than trusting the edit: the report says what is actually left.
      const after = inspect({ name: image.name, size: blob.size, type: blob.type }, new Uint8Array(await blob.arrayBuffer()), image).count;
      replace({
        blob,
        url: URL.createObjectURL(blob),
        width: image.width,
        height: image.height,
        extension,
        format: extension === "jpg" ? "jpeg" : extension,
        name: `${baseName(image.name)}-clean.${extension}`,
        key: mode,
        sourceId: image.id
      });
      setReport({ removed, before, after, lossless: Boolean(stripped) });
    } catch (cause) {
      setError(errorMessage(cause, "The metadata could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  const count = current?.data?.count ?? 0;

  return (
    <EditorShell
      tool={tool}
      images={images}
      preview={image && (
        <>
          <PanelTitle icon={<ImageIcon size={18} />} title="Image Preview" />
          <ImageStage image={image} label={count ? "Original (with metadata)" : "Original"} meta={describeImage(image)} />
          <EditorThumbs images={images} />
        </>
      )}
      settings={(
        <>
          <PanelTitle icon={<Info size={18} />} title="Metadata Information" />
          {!image && <p className="editor-note">Upload an image to see the camera, location and software details it carries.</p>}
          {image && !current && <p className="editor-note"><Loader2 size={13} className="spin" aria-hidden /> Reading metadata…</p>}
          {current?.error && <EditorAlert message={current.error} />}
          {current?.data && <MetadataSummary key={image?.id} data={current.data} />}

          <PanelTitle icon={<ShieldCheck size={18} />} title="Removal Options" />
          <div className="check-stack" role="radiogroup" aria-label="What to remove">
            {STRIP_MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                className="check"
                role="radio"
                aria-checked={mode === option.value}
                disabled={!lossless && option.value !== "all"}
                onClick={() => setMode(option.value)}
              >
                <i aria-hidden>{mode === option.value && <Check size={12} strokeWidth={3.2} />}</i>
                <span>{option.label} <small>{option.note}</small></span>
              </button>
            ))}
          </div>
          <p className="editor-note">
            {lossless
              ? "JPG, PNG and WebP are cleaned in place: the image data is copied byte for byte, so quality is untouched. Colour profiles stay, so colours stay accurate."
              : `${formatLabel(image?.type ?? "")} cannot be edited in place, so it is redrawn as a PNG with no metadata at all.`}
          </p>

          <EditorAlert message={error} />
          <button type="button" className="btn btn-primary btn-block-lg" disabled={!image || busy} onClick={apply}>
            {busy ? <Loader2 size={18} className="spin" aria-hidden /> : <ShieldCheck size={18} aria-hidden />} Remove Metadata
          </button>
        </>
      )}
      below={result && image && report && (
        <ResultPanel
          title="Result"
          thumbUrl={result.url}
          thumbBadge="Metadata Removed"
          details={[
            { label: "Original size", value: formatBytes(image.size) },
            { label: "New size", value: `${formatBytes(result.blob.size)} (${sizeChange(image.size, result.blob.size)})` },
            { label: "Dimensions", value: `${result.width} × ${result.height}` },
            { label: "Format", value: formatLabel(result.blob.type) },
            { label: "Metadata", value: report.after ? `${report.before - report.after} removed, ${report.after} kept` : `Removed (${report.after} items left)` }
          ]}
          highlight={report.lossless
            ? { value: "Lossless", label: "image data copied byte for byte", tone: "good" }
            : { value: "PNG", label: "redrawn without metadata", tone: "neutral" }}
          success={report.before === 0 ? "No metadata was found to remove." : "Metadata removed successfully!"}
          onDownload={() => downloadBlob(result.blob, result.name)}
          onProcessAnother={() => processAnother(images, () => replace(null))}
          extra={report.removed.length > 0 && <p className="editor-note">Removed: {report.removed.join(", ")}.</p>}
        />
      )}
    />
  );
}
