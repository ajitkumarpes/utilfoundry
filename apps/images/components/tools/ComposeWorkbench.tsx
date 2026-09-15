"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  CheckboxRow, ColorField, RangeField, SelectField, TileRow, ToggleRow
} from "@/components/ui/Fields";
import { PreviewEmpty } from "@/components/ui/PreviewFrame";
import { StepCard } from "@/components/ui/StepCard";
import { DownloadSplit, StatusBar } from "@/components/ui/StatusBar";
import { TipBar } from "@/components/ui/TipBar";
import { FileList, SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { useImageInput } from "@/components/tools/useImageInput";
import { downloadBlob, encodeCanvas } from "@/lib/canvas/encode";
import { composeFor, drawComposition } from "@/lib/compose";
import { defaultsFor } from "@/lib/defaults";
import { formatBytes } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";
import type { ToolOptions } from "@/lib/canvas/types";

const MAX_IMAGES = 50;
/** Longest edge of the on-screen preview; the export is always full size. */
const PREVIEW_MAX = 900;

const WIDTHS = [
  { value: "1200", label: "1200 px" },
  { value: "1600", label: "1600 px (recommended)" },
  { value: "2400", label: "2400 px" },
  { value: "a4", label: "A4 at 300 DPI" },
  { value: "letter", label: "US Letter at 300 DPI" }
];

const FITS = [
  { value: "fit", label: "Fit" },
  { value: "fill", label: "Fill" },
  { value: "stretch", label: "Stretch" }
];

const FORMATS = [
  { value: "png", label: "PNG (best quality)" },
  { value: "jpeg", label: "JPG (smaller file)" },
  { value: "webp", label: "WebP" }
];

export function ComposeWorkbench({ tool }: { tool: ToolDefinition }) {
  const isCollage = tool.id === "image-collage";
  const input = useImageInput({ multiple: true, max: MAX_IMAGES });
  const [options, setOptions] = useState<ToolOptions>(() => defaultsFor(tool.id));
  const [busy, setBusy] = useState(false);
  const [renderError, setRenderError] = useState("");
  const holderRef = useRef<HTMLDivElement>(null);

  const samples = useMemo(() => samplesFor(tool.id), [tool.id]);
  // Samples stay on offer after the first pick — these tools need several —
  // but each one only once.
  const unused = useMemo(
    () => samples.filter((sample) => !input.images.some((image) => image.name === sample.name)),
    [samples, input.images]
  );
  const set = useCallback((key: string, value: string | number | boolean) => {
    setOptions((current) => ({ ...current, [key]: value }));
  }, []);

  const { composition, layoutError } = useMemo(() => {
    // One image is not a sheet or a collage; the empty state says as much.
    if (input.images.length < 2) return { composition: null, layoutError: "" };
    try {
      return { composition: composeFor(tool.id, input.images, options), layoutError: "" };
    } catch (cause) {
      return {
        composition: null,
        layoutError: cause instanceof Error ? cause.message : "This layout could not be built."
      };
    }
  }, [input.images, options, tool.id]);

  // Live preview, deferred a frame so dragging a slider stays smooth.
  useEffect(() => {
    if (!composition || !holderRef.current) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (cancelled || !holderRef.current) return;
      try {
        const scale = Math.min(1, PREVIEW_MAX / Math.max(composition.width, composition.height));
        const canvas = drawComposition(composition, options, scale);
        canvas.style.maxWidth = "100%";
        canvas.style.height = "auto";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${tool.name} preview`);
        holderRef.current.replaceChildren(canvas);
        setRenderError("");
      } catch (cause) {
        setRenderError(cause instanceof Error ? cause.message : "This layout could not be drawn.");
      }
    }, 40);
    return () => { cancelled = true; window.clearTimeout(handle); };
  }, [composition, options, tool.name]);

  const download = useCallback(async (overrideFormat?: string) => {
    if (!composition) return;
    setBusy(true);
    setRenderError("");
    try {
      const canvas = drawComposition(composition, options);
      const format = overrideFormat ?? String(options.format ?? "png");
      const { blob, extension } = await encodeCanvas(canvas, format, Number(options.quality ?? 92));
      downloadBlob(blob, `${isCollage ? "collage" : "contact-sheet"}.${extension}`);
    } catch (cause) {
      setRenderError(cause instanceof Error ? cause.message : "The image could not be exported.");
    } finally {
      setBusy(false);
    }
  }, [composition, options, isCollage]);

  const error = input.error || layoutError || renderError;
  const tone = error ? "error" : busy ? "busy" : composition ? "ready" : "idle";
  const enough = input.images.length >= 2;
  const transparent = options.transparent === true && String(options.format ?? "png") === "png";

  return (
    <>
      <div className="workspace is-full">
        <div className="workspace-main">
          <div className="step-grid is-triple">
            <StepCard step={1} title="Upload Images" subtitle={tool.uploadNote}>
              <UploadZone
                multiple
                accept="image/*"
                label="Choose Images"
                hint={acceptedFormats(tool)}
                maxNote={`Max ${MAX_IMAGES} images, 32 MB each`}
                onFiles={input.addFiles}
              />
              {input.images.length > 0 && (
                <FileList items={input.images} onRemove={input.remove} onClear={input.clear} onReorder={input.reorder} />
              )}
              {unused.length > 0 && <SampleStrip samples={unused} onPick={input.addSample} />}
            </StepCard>

            <StepCard
              step={2}
              title="Preview"
              subtitle={isCollage ? "How the collage will look" : "How the sheet will print"}
            >
              {!composition ? (
                <PreviewEmpty message={`Add at least two images to build a ${isCollage ? "collage" : "contact sheet"}.`} />
              ) : (
                <>
                  <div className={`preview-stage ${transparent ? "checkerboard" : ""}`}>
                    <div ref={holderRef} style={{ display: "contents" }} />
                  </div>
                  <p className="text-meta" style={{ justifyContent: "center" }}>
                    <span>{input.images.length} image{input.images.length === 1 ? "" : "s"}</span>
                    <span>Output {composition.width} × {composition.height} px</span>
                    <span>{composition.columns} × {composition.rows}</span>
                  </p>
                </>
              )}
            </StepCard>

            <StepCard step={3} title="Layout Settings" subtitle={isCollage ? "Shape the collage" : "Customise the sheet"}>
              {isCollage ? (
                <>
                  <TileRow
                    label="Layout"
                    value={String(options.layout ?? "grid")}
                    onChange={(value) => set("layout", value)}
                    options={[
                      { value: "grid", label: "Grid" },
                      { value: "mosaic", label: "Mosaic" },
                      { value: "horizontal", label: "Row" },
                      { value: "vertical", label: "Column" }
                    ]}
                  />
                  <RangeField
                    label="Gap"
                    min={0}
                    max={60}
                    unit=" px"
                    value={Number(options.gap ?? 12)}
                    onChange={(value) => set("gap", value)}
                  />
                  <RangeField
                    label="Corner radius"
                    min={0}
                    max={64}
                    unit=" px"
                    value={Number(options.radius ?? 12)}
                    onChange={(value) => set("radius", value)}
                  />
                </>
              ) : (
                <>
                  <RangeField
                    label="Columns"
                    min={1}
                    max={12}
                    value={Number(options.columns ?? 4)}
                    onChange={(value) => set("columns", value)}
                    help="Rows are added automatically as you add images."
                  />
                  <RangeField
                    label="Spacing"
                    min={0}
                    max={60}
                    unit=" px"
                    value={Number(options.spacing ?? 10)}
                    onChange={(value) => set("spacing", value)}
                  />
                </>
              )}

              <SelectField
                label="Output width"
                help="The finished image is always rendered at full size."
                value={String(options.sheetWidth ?? "1600")}
                options={WIDTHS}
                onChange={(value) => set("sheetWidth", value)}
              />

              <SelectField
                label="Image fit"
                help={String(options.fit) === "fill" ? "Fills each cell and crops the overflow." : "Keeps every image whole inside its cell."}
                value={String(options.fit ?? "fit")}
                options={FITS}
                onChange={(value) => set("fit", value)}
              />

              <ColorField
                label="Background colour"
                value={String(options.background ?? "#FFFFFF")}
                onChange={(value) => set("background", value)}
              />
              <div className="field">
                <ToggleRow
                  label="Transparent background"
                  note="PNG output only"
                  checked={options.transparent === true}
                  onChange={(value) => set("transparent", value)}
                />
                <ToggleRow
                  label="Drop shadow"
                  note="Lifts each image off the background"
                  checked={options.shadow === true}
                  onChange={(value) => set("shadow", value)}
                />
              </div>

              {!isCollage && (
                <>
                  <CheckboxRow
                    label="Show file names"
                    note="Print each image's name with it"
                    checked={options.showFilenames !== false}
                    onChange={(value) => set("showFilenames", value)}
                  />
                  {options.showFilenames !== false && (
                    <>
                      <SelectField
                        label="Caption position"
                        value={String(options.labelPosition ?? "below")}
                        options={[{ value: "below", label: "Below the image" }, { value: "overlay", label: "Over the image" }]}
                        onChange={(value) => set("labelPosition", value)}
                      />
                      <RangeField
                        label="Caption size"
                        min={8}
                        max={32}
                        unit=" px"
                        value={Number(options.fontSize ?? 12)}
                        onChange={(value) => set("fontSize", value)}
                      />
                    </>
                  )}
                  <RangeField
                    label="Corner radius"
                    min={0}
                    max={48}
                    unit=" px"
                    value={Number(options.radius ?? 0)}
                    onChange={(value) => set("radius", value)}
                  />
                </>
              )}

              <SelectField
                label="Output format"
                value={String(options.format ?? "png")}
                options={FORMATS}
                onChange={(value) => set("format", value)}
              />
              {String(options.format ?? "png") !== "png" && (
                <RangeField
                  label="Quality"
                  min={40}
                  max={100}
                  accent
                  unit="%"
                  value={Number(options.quality ?? 92)}
                  onChange={(value) => set("quality", value)}
                />
              )}
            </StepCard>
          </div>

          <StatusBar
            tone={tone}
            title={error || (composition ? tool.readyTitle : enough ? "Building the layout…" : "Add at least two images")}
            note={error
              ? "Fix the problem above and try again."
              : composition
                ? `${tool.readyNote} Exports at ${composition.width} × ${composition.height} px.`
                : "Drop several files at once, or pick the samples and add a few."}
          >
            {composition && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOptions(defaultsFor(tool.id))}>
                  <RefreshCw size={15} /> Reset
                </button>
                <DownloadSplit
                  label={tool.action}
                  busy={busy}
                  onAction={() => download()}
                  options={[
                    { value: "png", label: "Download as PNG" },
                    { value: "jpeg", label: "Download as JPG" },
                    { value: "webp", label: "Download as WebP" }
                  ]}
                  onPick={(value) => download(value)}
                />
              </>
            )}
          </StatusBar>
        </div>
      </div>

      <TipBar title={isCollage ? "Drag to change the order" : "Contact sheets make good indexes"}>
        {isCollage
          ? "The first image becomes the hero in the mosaic layout, so drag the one you want featured to the top of the list."
          : `Every image stays on one page — ${input.images.length ? `this sheet is ${formatBytes(input.images.reduce((total, image) => total + image.size, 0))} of source material` : "add a folder's worth at once"}. Print it, or keep it as a visual index of a shoot.`}
      </TipBar>
    </>
  );
}
