"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Aperture, Camera, Copy, FileDown, FileText, Gauge, HardDrive, Image as ImageIcon, Layers,
  MapPin, Maximize2, Move3d, Palette, Ratio, RefreshCw, Ruler, ScanLine, Timer
} from "lucide-react";
import { PreviewEmpty } from "@/components/ui/PreviewFrame";
import { StepCard } from "@/components/ui/StepCard";
import { DownloadSplit, StatusBar } from "@/components/ui/StatusBar";
import { TipBar } from "@/components/ui/TipBar";
import { FileList, SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { useCopy } from "@/components/tools/useCopy";
import { useImageInput } from "@/components/tools/useImageInput";
import { downloadBlob } from "@/lib/canvas/encode";
import { baseName, formatBytes } from "@/lib/format";
import {
  metadataToJson, metadataToText, readMetadata, type ImageMetadata, type MetadataField
} from "@/lib/metadata";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";

type TabId = "exif" | "iptc" | "xmp" | "file";

const TABS: { id: TabId; label: string }[] = [
  { id: "exif", label: "EXIF" },
  { id: "iptc", label: "IPTC" },
  { id: "xmp", label: "XMP" },
  { id: "file", label: "File info" }
];

/** Row glyphs, chosen from the field label so the tables stay plain data. */
function rowIcon(label: string): ReactNode {
  const value = label.toLowerCase();
  if (value.includes("gps") || value.includes("location")) return <MapPin size={14} />;
  if (value.includes("camera") || value.includes("make") || value.includes("model")) return <Camera size={14} />;
  if (value.includes("lens") || value.includes("focal") || value.includes("f number") || value.includes("aperture")) return <Aperture size={14} />;
  if (value.includes("date") || value.includes("time")) return <Timer size={14} />;
  if (value.includes("width") || value.includes("height") || value.includes("dimension")) return <Maximize2 size={14} />;
  if (value.includes("aspect")) return <Ratio size={14} />;
  if (value.includes("resolution") || value.includes("dpi")) return <Ruler size={14} />;
  if (value.includes("size")) return <HardDrive size={14} />;
  if (value.includes("format") || value.includes("encoding")) return <FileText size={14} />;
  if (value.includes("color") || value.includes("colour")) return <Palette size={14} />;
  if (value.includes("bit") || value.includes("megapixel")) return <Layers size={14} />;
  if (value.includes("orientation")) return <Move3d size={14} />;
  if (value.includes("iso") || value.includes("exposure") || value.includes("metering")) return <Gauge size={14} />;
  if (value.includes("frame")) return <ScanLine size={14} />;
  return <ImageIcon size={14} />;
}

function FieldTable({ fields, empty, gpsLink }: { fields: MetadataField[]; empty: string; gpsLink?: string }) {
  if (!fields.length) return <p className="meta-empty">{empty}</p>;
  return (
    <dl className="meta-table">
      {fields.map((field) => (
        <div className="meta-row" key={field.key}>
          <dt>{rowIcon(field.label)}<span title={field.label}>{field.label}</span></dt>
          <dd>
            {field.value}
            {gpsLink && field.key === "gps.location" && (
              <a className="map-link" href={gpsLink} target="_blank" rel="noopener noreferrer">
                <MapPin size={11} /> View on map
              </a>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function InspectWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;
  const showTabs = tool.id === "image-metadata-viewer";

  const [report, setReport] = useState<{ id: string; data: ImageMetadata } | null>(null);
  const [tab, setTab] = useState<{ id: string; value: TabId } | null>(null);
  const [readError, setReadError] = useState<{ id: string; message: string } | null>(null);
  const { copy, copied, copyError } = useCopy();

  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);

  // Every piece of async state is keyed by image id, so swapping the file simply
  // stops matching — nothing has to be reset, and nothing is set during render.
  useEffect(() => {
    if (!image?.file) return;
    const id = image.id;
    let cancelled = false;

    image.file.arrayBuffer()
      .then((bytes) => {
        if (cancelled) return;
        const data = readMetadata(
          { name: image.name, size: image.size, type: image.type, bytes },
          { width: image.width, height: image.height }
        );
        setReport({ id, data });
        // Land on a tab that actually has something in it.
        setTab({ id, value: data.exif.length ? "exif" : data.iptc.length ? "iptc" : data.xmp.length ? "xmp" : "file" });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setReadError({ id, message: cause instanceof Error ? cause.message : "This file could not be read." });
      });

    return () => { cancelled = true; };
  }, [image]);

  const data = image && report?.id === image.id ? report.data : null;
  const failure = image && readError?.id === image.id ? readError.message : "";
  const activeTab: TabId = image && tab?.id === image.id ? tab.value : "exif";
  const busy = Boolean(image) && !data && !failure;
  const fields = !data ? [] : showTabs
    ? (activeTab === "exif" ? data.exif : activeTab === "iptc" ? data.iptc : activeTab === "xmp" ? data.xmp : data.file)
    : data.file;

  const gpsLink = data?.gps
    ? `https://www.openstreetmap.org/?mlat=${data.gps.latitude}&mlon=${data.gps.longitude}#map=14/${data.gps.latitude}/${data.gps.longitude}`
    : undefined;

  const downloadJson = useCallback(() => {
    if (!data || !image) return;
    downloadBlob(
      new Blob([metadataToJson(data)], { type: "application/json" }),
      `${baseName(image.name)}-metadata.json`
    );
  }, [data, image]);

  const copyAll = useCallback(() => {
    if (!data) return;
    copy(showTabs ? metadataToText(data) : data.file.map((field) => `${field.label}: ${field.value}`).join("\n"), "report");
  }, [copy, data, showTabs]);

  const error = input.error || failure || copyError;
  const tone = error ? "error" : busy ? "busy" : data ? "ready" : "idle";

  const emptyFor: Record<TabId, string> = {
    exif: "No EXIF data. Most images shared through social networks or exported for the web have it stripped.",
    iptc: "No IPTC records. These are written by photo desks and asset managers rather than cameras.",
    xmp: "No XMP packet. Editors such as Lightroom and Photoshop add one when they save.",
    file: "Nothing could be read from this file."
  };

  return (
    <>
      <div className="workspace is-full">
        <div className="workspace-main">
          <div className="step-grid is-triple">
            <StepCard step={1} title="Upload Image" subtitle={tool.uploadNote}>
              <UploadZone compact={Boolean(image)}
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

            <StepCard step={2} title="Image Preview" subtitle="The image you uploaded">
              {!image ? <PreviewEmpty /> : (
                <>
                  <div className="preview-stage">
                    <img src={image.url} alt={image.name} />
                  </div>
                  <p className="text-meta" style={{ justifyContent: "center" }}>
                    <span>{image.width} × {image.height} px</span>
                    <span>{formatBytes(image.size)}</span>
                    {data && <span>{data.facts.format}</span>}
                  </p>
                </>
              )}
            </StepCard>

            <StepCard
              step={3}
              title={showTabs ? "Metadata Information" : "Image Dimensions"}
              subtitle={showTabs ? "Everything embedded in this file" : "Detailed dimension and resolution information"}
            >
              {!data ? (
                <p className="meta-empty">
                  {busy ? "Reading the file…" : "Add an image to read what is inside it."}
                </p>
              ) : (
                <>
                  {showTabs && (
                    <div className="meta-tabs" role="tablist" aria-label="Metadata group">
                      {TABS.map((entry) => {
                        const count = entry.id === "file" ? data.file.length
                          : entry.id === "exif" ? data.exif.length
                            : entry.id === "iptc" ? data.iptc.length : data.xmp.length;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === entry.id}
                            onClick={() => image && setTab({ id: image.id, value: entry.id })}
                          >
                            {entry.label}{count > 0 && entry.id !== "file" ? ` (${count})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <FieldTable fields={fields} empty={emptyFor[showTabs ? activeTab : "file"]} gpsLink={gpsLink} />
                </>
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={tone}
            title={error || (data
              ? showTabs
                ? data.count
                  ? `${data.count} metadata field${data.count === 1 ? "" : "s"} found`
                  : "No embedded metadata in this image"
                : tool.readyTitle
              : "Upload an image to begin")}
            note={error
              ? "Fix the problem above and try again."
              : data
                ? showTabs
                  ? data.gps
                    ? "This image records where it was taken — worth removing before sharing."
                    : tool.readyNote
                  : tool.readyNote
                : "Drop a file or pick one of the samples to start."}
          >
            {data && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={input.clear}>
                  <RefreshCw size={15} /> Clear
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyAll}>
                  <Copy size={15} /> {copied === "report" ? "Copied" : showTabs ? "Copy all metadata" : "Copy all information"}
                </button>
                {showTabs && (
                  <DownloadSplit label={tool.action} onAction={downloadJson} />
                )}
              </>
            )}
          </StatusBar>
        </div>
      </div>

      {showTabs ? (
        <TipBar title="Your privacy matters">
          Every byte is read in your browser — the file is never uploaded. If an image carries GPS
          coordinates, the Remove Metadata tool will strip them before you share it.
        </TipBar>
      ) : (
        <TipBar
          title="Need to change the dimensions?"
          action={<Link className="btn btn-secondary btn-sm" href="/resize-image"><FileDown size={15} /> Go to Resize Image</Link>}
        >
          These values come straight from the file header, so they are what any other program will
          read too.
        </TipBar>
      )}
    </>
  );
}
