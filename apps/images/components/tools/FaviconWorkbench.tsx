"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Lock, RefreshCw } from "lucide-react";
import { ColorField, RangeField, TextField, ToggleRow } from "@/components/ui/Fields";
import { PreviewEmpty } from "@/components/ui/PreviewFrame";
import { StepCard } from "@/components/ui/StepCard";
import { DownloadSplit, StatusBar } from "@/components/ui/StatusBar";
import { TipBar } from "@/components/ui/TipBar";
import { FileList, SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { useCopy } from "@/components/tools/useCopy";
import { useImageInput } from "@/components/tools/useImageInput";
import { downloadBlob } from "@/lib/canvas/encode";
import { context, createCanvas, roundedPath } from "@/lib/canvas/effects";
import { createIco, headSnippet, webManifest, type IconSource } from "@/lib/ico";
import { defaultsFor } from "@/lib/defaults";
import { formatBytes } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { createZip, type ZipEntry } from "@/lib/zip";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";

/** Sizes shown in the preview strip, largest first. */
const PREVIEW_SIZES = [256, 128, 64, 32, 16];

/** The sizes packed inside favicon.ico. */
const ICO_SIZES = [16, 32, 48, 256];

type Deliverable = {
  id: string;
  name: string;
  detail: string;
  /** Which option switches this file off. */
  toggle?: "includeIco" | "includeApple" | "includeAndroid" | "includeManifest";
  size?: number;
  kind: "png" | "ico" | "manifest";
};

const FILES: Deliverable[] = [
  { id: "ico", name: "favicon.ico", detail: "16 × 16, 32 × 32, 48 × 48, 256 × 256", kind: "ico", toggle: "includeIco" },
  { id: "png16", name: "favicon-16x16.png", detail: "16 × 16 (PNG)", kind: "png", size: 16 },
  { id: "png32", name: "favicon-32x32.png", detail: "32 × 32 (PNG)", kind: "png", size: 32 },
  { id: "apple", name: "apple-touch-icon.png", detail: "180 × 180 (PNG)", kind: "png", size: 180, toggle: "includeApple" },
  { id: "android192", name: "android-chrome-192x192.png", detail: "192 × 192 (PNG)", kind: "png", size: 192, toggle: "includeAndroid" },
  { id: "android512", name: "android-chrome-512x512.png", detail: "512 × 512 (PNG)", kind: "png", size: 512, toggle: "includeAndroid" },
  { id: "manifest", name: "site.webmanifest", detail: "Web app manifest (JSON)", kind: "manifest", toggle: "includeManifest" }
];

/**
 * Draws the source into a square of `size`, honouring the padding, corner and
 * background choices. Non-square sources are centred rather than stretched.
 */
function renderIcon(image: SourceImage, size: number, options: ToolOptions) {
  const canvas = createCanvas(size, size);
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = "high";

  const padding = (Math.max(0, Math.min(40, Number(options.padding ?? 0))) / 100) * size;
  const inner = Math.max(1, size - padding * 2);
  const radius = options.roundCorners === true ? size * 0.22 : 0;

  ctx.save();
  if (radius > 0) {
    roundedPath(ctx, 0, 0, size, size, [radius, radius, radius, radius]);
    ctx.clip();
  }

  if (options.fillBackground === true) {
    ctx.fillStyle = String(options.backgroundColor ?? "#FFFFFF");
    ctx.fillRect(0, 0, size, size);
  }

  const scale = Math.min(inner / image.width, inner / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image.element, (size - width) / 2, (size - height) / 2, width, height);
  ctx.restore();

  return canvas;
}

function toPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("The browser could not encode this icon.")); return; }
      blob.arrayBuffer().then((bytes) => resolve(new Uint8Array(bytes))).catch(reject);
    }, "image/png");
  });
}

export function FaviconWorkbench({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;
  const [options, setOptions] = useState<ToolOptions>(() => defaultsFor(tool.id));
  const [busy, setBusy] = useState(false);
  const [buildError, setBuildError] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const tabIconRef = useRef<HTMLCanvasElement>(null);
  const { copy, copied, copyError } = useCopy();

  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);
  const set = useCallback((key: string, value: string | number | boolean) => {
    setOptions((current) => ({ ...current, [key]: value }));
  }, []);

  const included = useMemo(
    () => FILES.filter((file) => !file.toggle || options[file.toggle] !== false),
    [options]
  );

  // Redraw the preview strip and the mock browser tab on every option change.
  useEffect(() => {
    if (!image || !previewRef.current) return;
    const figures = PREVIEW_SIZES.map((size) => {
      const figure = document.createElement("figure");
      const canvas = renderIcon(image, size, options);
      canvas.style.width = `${size > 96 ? 96 : size}px`;
      canvas.style.height = `${size > 96 ? 96 : size}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `${size} by ${size} pixel preview`);
      const caption = document.createElement("figcaption");
      caption.textContent = `${size} × ${size}`;
      figure.append(canvas, caption);
      return figure;
    });
    previewRef.current.replaceChildren(...figures);

    if (tabIconRef.current) {
      const source = renderIcon(image, 32, options);
      tabIconRef.current.width = 32;
      tabIconRef.current.height = 32;
      context(tabIconRef.current).drawImage(source, 0, 0);
    }
  }, [image, options]);

  const buildEntries = useCallback(async (): Promise<ZipEntry[]> => {
    if (!image) return [];
    const entries: ZipEntry[] = [];

    for (const file of included) {
      if (file.kind === "png" && file.size) {
        entries.push({ name: file.name, data: await toPng(renderIcon(image, file.size, options)) });
      } else if (file.kind === "ico") {
        const sources: IconSource[] = [];
        for (const size of ICO_SIZES) {
          const canvas = renderIcon(image, size, options);
          sources.push({
            size,
            pixels: context(canvas).getImageData(0, 0, size, size).data,
            png: await toPng(canvas)
          });
        }
        entries.push({ name: file.name, data: new Uint8Array(await createIco(sources).arrayBuffer()) });
      } else if (file.kind === "manifest") {
        const name = String(options.appName ?? "My Site").trim() || "My Site";
        entries.push({
          name: file.name,
          data: new TextEncoder().encode(webManifest({
            name,
            shortName: name.slice(0, 12),
            themeColor: String(options.themeColor ?? "#111827"),
            backgroundColor: String(options.backgroundColor ?? "#FFFFFF")
          }))
        });
      }
    }

    entries.push({ name: "README.txt", data: new TextEncoder().encode(
      `Favicon set generated with UtilFoundry Images.\n\nDrop these files in your site root, then paste this into <head>:\n\n${headSnippet()}\n`
    ) });

    return entries;
  }, [image, included, options]);

  const downloadAll = useCallback(async () => {
    setBusy(true);
    setBuildError("");
    try {
      const entries = await buildEntries();
      if (!entries.length) throw new Error("Select at least one file to download.");
      downloadBlob(createZip(entries), "favicon.zip");
    } catch (cause) {
      setBuildError(cause instanceof Error ? cause.message : "The favicon set could not be built.");
    } finally {
      setBusy(false);
    }
  }, [buildEntries]);

  const downloadOne = useCallback(async (file: Deliverable) => {
    if (!image) return;
    setBusy(true);
    setBuildError("");
    try {
      if (file.kind === "png" && file.size) {
        const bytes = await toPng(renderIcon(image, file.size, options));
        downloadBlob(new Blob([bytes as BlobPart], { type: "image/png" }), file.name);
      } else if (file.kind === "ico") {
        const sources: IconSource[] = [];
        for (const size of ICO_SIZES) {
          const canvas = renderIcon(image, size, options);
          sources.push({ size, pixels: context(canvas).getImageData(0, 0, size, size).data, png: await toPng(canvas) });
        }
        downloadBlob(createIco(sources), file.name);
      } else {
        const name = String(options.appName ?? "My Site").trim() || "My Site";
        const manifest = webManifest({
          name,
          shortName: name.slice(0, 12),
          themeColor: String(options.themeColor ?? "#111827"),
          backgroundColor: String(options.backgroundColor ?? "#FFFFFF")
        });
        downloadBlob(new Blob([manifest], { type: "application/manifest+json" }), file.name);
      }
    } catch (cause) {
      setBuildError(cause instanceof Error ? cause.message : "That file could not be built.");
    } finally {
      setBusy(false);
    }
  }, [image, options]);

  const error = input.error || buildError || copyError;
  const tone = error ? "error" : busy ? "busy" : image ? "ready" : "idle";
  const siteName = String(options.appName ?? "My Site").trim() || "My Site";

  return (
    <>
      <div className="workspace is-full">
        <div className="workspace-main">
          <div className="step-grid is-triple">
            <StepCard step={1} title="Upload an Image" subtitle={tool.uploadNote}>
              <UploadZone
                multiple={false}
                accept="image/*"
                label="Choose Image"
                hint={acceptedFormats(tool)}
                maxNote="Square images work best"
                onFiles={input.addFiles}
              />
              {image
                ? <FileList items={input.images} onRemove={input.remove} onClear={input.clear} />
                : <SampleStrip samples={samples} activeSrc={input.sampleSrc} onPick={input.addSample} />}

              {image && (
                <>
                  <RangeField
                    label="Padding"
                    min={0}
                    max={40}
                    unit="%"
                    value={Number(options.padding ?? 0)}
                    onChange={(value) => set("padding", value)}
                    help="Breathing room around the artwork inside the square."
                  />
                  <div className="field">
                    <ToggleRow
                      label="Rounded corners"
                      note="Rounds the icon to a squircle"
                      checked={options.roundCorners === true}
                      onChange={(value) => set("roundCorners", value)}
                    />
                    <ToggleRow
                      label="Solid background"
                      note="Fill transparent areas instead of keeping them clear"
                      checked={options.fillBackground === true}
                      onChange={(value) => set("fillBackground", value)}
                    />
                  </div>
                  {options.fillBackground === true && (
                    <ColorField
                      label="Background colour"
                      value={String(options.backgroundColor ?? "#FFFFFF")}
                      onChange={(value) => set("backgroundColor", value)}
                    />
                  )}
                </>
              )}
            </StepCard>

            <StepCard step={2} title="Favicon Preview" subtitle="How the icon looks at every size">
              {!image ? <PreviewEmpty message="Add an image to preview the favicon." /> : (
                <>
                  <div className="preview-stage checkerboard">
                    <div className="icon-preview" ref={previewRef} />
                  </div>

                  <div className="field">
                    <span className="field-label">In a browser tab</span>
                    <div className="browser-chrome">
                      <div className="browser-bar">
                        <span className="browser-dots" aria-hidden><span /><span /><span /></span>
                        <span className="browser-tab">
                          <canvas ref={tabIconRef} width={32} height={32} style={{ width: 16, height: 16 }} aria-hidden />
                          {siteName}
                        </span>
                      </div>
                      <div className="browser-url"><Lock size={12} /> https://{siteName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com</div>
                    </div>
                  </div>

                  {image.width !== image.height && (
                    <p className="field-help">
                      This image is {image.width} × {image.height}. It has been centred in a square —
                      a square source will give a sharper result.
                    </p>
                  )}
                </>
              )}
            </StepCard>

            <StepCard step={3} title="Download Favicon" subtitle="Everything a site needs, in one place">
              {!image ? (
                <p className="meta-empty">Add an image to generate the set.</p>
              ) : (
                <>
                  <TextField
                    label="Site name"
                    help="Written into the manifest and shown in the tab preview."
                    value={String(options.appName ?? "My Site")}
                    onChange={(value) => set("appName", value)}
                  />

                  <div className="file-table">
                    {FILES.map((file) => {
                      const on = !file.toggle || options[file.toggle] !== false;
                      return (
                        <div className="file-pick" key={file.id}>
                          <button
                            type="button"
                            className="file-check"
                            role="checkbox"
                            aria-checked={on}
                            aria-disabled={!file.toggle}
                            aria-label={file.toggle ? `Include ${file.name}` : `${file.name} is always included`}
                            onClick={() => file.toggle && set(file.toggle, !on)}
                          >
                            <i>{on && <Check size={12} strokeWidth={3.2} />}</i>
                            <span style={{ minWidth: 0 }}>
                              <b>{file.name}</b>
                            </span>
                            <small>{file.detail}</small>
                          </button>
                          <button
                            type="button"
                            className="file-download"
                            aria-label={`Download ${file.name} on its own`}
                            disabled={busy}
                            onClick={() => downloadOne(file)}
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <span className="field-help">
                    favicon.ico and the two PNG sizes are always included — every browser expects them.
                  </span>

                  <ColorField
                    label="Theme colour"
                    help="Colours the browser UI on Android."
                    value={String(options.themeColor ?? "#111827")}
                    onChange={(value) => set("themeColor", value)}
                  />

                  <button
                    type="button"
                    className="btn btn-secondary btn-block"
                    onClick={() => copy(headSnippet(), "markup")}
                  >
                    {copied === "markup" ? "Markup copied" : "Copy the <head> markup"}
                  </button>
                </>
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={tone}
            title={error || (image ? tool.readyTitle : "Upload an image to begin")}
            note={error
              ? "Fix the problem above and try again."
              : image
                ? `${included.length + 1} files, ${formatBytes(image.size)} of source artwork.`
                : "Drop a file or pick one of the samples to start."}
          >
            {image && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOptions(defaultsFor(tool.id))}>
                  <RefreshCw size={15} /> Reset
                </button>
                <DownloadSplit label={tool.action} busy={busy} onAction={downloadAll} />
              </>
            )}
          </StatusBar>
        </div>
      </div>

      <TipBar title="Use a simple, recognisable image">
        At 16 × 16 there is room for one shape and one or two colours — detail disappears. The ICO
        carries 16, 32, 48 and 256 px renditions so every browser picks the right one.
      </TipBar>
    </>
  );
}
