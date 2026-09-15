"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, FlipHorizontal2, FlipVertical2, ImageIcon, Loader2, RefreshCw, RotateCcw, RotateCw, Settings2, Zap } from "lucide-react";
import { RangeField } from "@/components/ui/Fields";
import { ActionTiles, ChipGroup, EditorAlert, OUTPUT_CHOICES, PanelTitle, ResultPanel } from "@/components/ui/EditorParts";
import {
  EditorShell, EditorThumbs, ImageStage, describeImage, errorMessage, processAnother, sizeChange, useFinished
} from "@/components/tools/EditorShell";
import { useEditorImages } from "@/components/tools/useEditorImages";
import { downloadBlob } from "@/lib/canvas/encode";
import { encodeResult, FORMAT_NAME, orient, resolveOutputFormat } from "@/lib/canvas/editor";
import type { SourceImage } from "@/lib/canvas/types";
import { baseName, formatBytes } from "@/lib/format";
import { applyOrientation, describeOrientation, isQuarterTurn, NO_CHANGE, rotatedSize, type Orientation } from "@/lib/geometry";
import type { ToolDefinition } from "@/lib/tools";

const LOSSY = new Set(["jpeg", "webp", "avif"]);
const PREVIEW_SIDE = 960;

const FILL_CHOICES = [
  { value: "transparent", label: "Transparent" },
  { value: "#ffffff", label: "White" },
  { value: "#000000", label: "Black" }
];

/** Draws the oriented image at preview size into a holder the effect owns. */
function OrientedPreview({ image, orientation, background }: { image: SourceImage; orientation: Orientation; background: string | null }) {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = holder.current;
    if (!target) return;
    const scale = Math.min(1, PREVIEW_SIDE / Math.max(image.width, image.height));
    const canvas = orient(image.element, image, orientation, { background, scale });
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Preview: ${describeOrientation(orientation)}`);
    target.replaceChildren(canvas);
  }, [image, orientation, background]);
  return <div ref={holder} className="stage-canvas" />;
}

function flipLabel({ flipH, flipV }: Orientation) {
  if (flipH && flipV) return "Flipped both ways";
  if (flipH) return "Horizontal Flip";
  if (flipV) return "Vertical Flip";
  return "No flip yet";
}

/** Shared state and the apply step for both the rotate and the flip tool. */
function useOrientEditor(tool: ToolDefinition) {
  const images = useEditorImages();
  const image = images.active;
  const [orientation, setOrientation] = useState<Orientation>(NO_CHANGE);
  const [choice, setChoice] = useState("auto");
  const [quality, setQuality] = useState(90);
  const [fill, setFill] = useState("transparent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, replace] = useFinished();

  const format = resolveOutputFormat(choice, image?.type ?? "");
  // JPEG has no alpha: transparent corners would come out black, so white stands in.
  const background = isQuarterTurn(orientation.rotation) ? null
    : fill === "transparent" ? (format === "jpeg" ? "#ffffff" : null) : fill;
  const key = JSON.stringify([orientation, format, quality, background]);
  const result = finished && image && finished.sourceId === image.id && finished.key === key ? finished : null;
  const changed = orientation.rotation !== 0 || orientation.flipH || orientation.flipV;

  async function apply() {
    if (!image) return;
    setBusy(true);
    setError("");
    try {
      const canvas = orient(image.element, image, orientation, { background });
      const encoded = await encodeResult(canvas, format, quality);
      const suffix = tool.id === "flip-image" ? "flipped" : "rotated";
      replace({ ...encoded, name: `${baseName(image.name)}-${suffix}.${encoded.extension}`, key, sourceId: image.id });
    } catch (cause) {
      setError(errorMessage(cause, "The image could not be processed."));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setOrientation(NO_CHANGE);
    setChoice("auto");
    setQuality(90);
    setFill("transparent");
    setError("");
  }

  return {
    images, image, orientation, setOrientation, choice, setChoice, quality, setQuality, fill, setFill,
    format, background, busy, error, result, changed, apply, reset, clearResult: () => replace(null)
  };
}

type Editor = ReturnType<typeof useOrientEditor>;

function OutputFields({ editor }: { editor: Editor }) {
  return (
    <>
      <ChipGroup label="Output format" value={editor.choice} choices={OUTPUT_CHOICES} onChange={editor.setChoice} />
      {LOSSY.has(editor.format) && (
        <RangeField label="Image quality (lossy formats)" min={40} max={100} accent unit="%" value={editor.quality} onChange={editor.setQuality} />
      )}
    </>
  );
}

function OrientResult({ editor, success, badge }: { editor: Editor; success: string; badge: string }) {
  const { result, image } = editor;
  if (!result || !image) return null;
  return (
    <ResultPanel
      title="Processed Image"
      thumbUrl={result.url}
      thumbBadge={badge}
      transparent={!editor.background && editor.format !== "jpeg"}
      details={[
        { label: "Original size", value: `${image.width} × ${image.height}` },
        { label: "New size", value: `${result.width} × ${result.height}` },
        { label: "File size", value: `${formatBytes(result.blob.size)} (${sizeChange(image.size, result.blob.size)})` },
        { label: "Format", value: FORMAT_NAME[result.format] ?? result.format.toUpperCase() }
      ]}
      success={success}
      onDownload={() => downloadBlob(result.blob, result.name)}
      onProcessAnother={() => processAnother(editor.images, editor.clearResult)}
    />
  );
}

function ApplyButton({ editor, label, idleHint }: { editor: Editor; label: string; idleHint: string }) {
  return (
    <>
      <EditorAlert message={editor.error} />
      <button
        type="button"
        className="btn btn-primary btn-block-lg"
        disabled={!editor.image || !editor.changed || editor.busy}
        onClick={editor.apply}
      >
        {editor.busy ? <Loader2 size={18} className="spin" aria-hidden /> : <Zap size={18} aria-hidden />} {label}
      </button>
      {editor.image && !editor.changed && <p className="editor-note">{idleHint}</p>}
    </>
  );
}

/* -------------------------------------------------------------------------- */

export function RotateWorkbench({ tool }: { tool: ToolDefinition }) {
  const editor = useOrientEditor(tool);
  const { image, orientation, setOrientation } = editor;
  const act = (action: Parameters<typeof applyOrientation>[1]) => setOrientation((current) => applyOrientation(current, action));
  const out = image ? rotatedSize(image, orientation.rotation) : null;

  return (
    <EditorShell
      tool={tool}
      images={editor.images}
      preview={image && (
        <>
          <PanelTitle icon={<ImageIcon size={18} />} title="Image Preview" />
          <ImageStage
            image={image}
            label={editor.changed ? `Preview · ${describeOrientation(orientation)}` : "Original (0°)"}
            meta={editor.changed && out ? `${out.width} × ${out.height}` : describeImage(image)}
            transparent={!editor.background && !isQuarterTurn(orientation.rotation)}
          >
            <OrientedPreview image={image} orientation={orientation} background={editor.background} />
          </ImageStage>
          <EditorThumbs images={editor.images} />
        </>
      )}
      settings={(
        <>
          <PanelTitle
            icon={<RotateCw size={18} />}
            title="Rotate & Flip"
            actions={<button type="button" className="ghost-button" onClick={editor.reset}><RefreshCw size={14} /> Reset</button>}
          />
          <ActionTiles
            columns={3}
            items={[
              { key: "left", icon: <RotateCcw size={22} />, title: "Rotate Left", note: "90°", onClick: () => act("left") },
              { key: "right", icon: <RotateCw size={22} />, title: "Rotate Right", note: "90°", onClick: () => act("right") },
              { key: "half", icon: <RefreshCw size={22} />, title: "Rotate", note: "180°", onClick: () => act("half") }
            ]}
          />
          <ActionTiles
            columns={2}
            items={[
              { key: "h", icon: <FlipHorizontal2 size={20} />, title: "Flip Horizontal", pressed: orientation.flipH, onClick: () => act("flipH") },
              { key: "v", icon: <FlipVertical2 size={20} />, title: "Flip Vertical", pressed: orientation.flipV, onClick: () => act("flipV") }
            ]}
          />
          <RangeField
            label="Custom angle"
            min={-180}
            max={180}
            unit="°"
            value={orientation.rotation}
            onChange={(rotation) => setOrientation((current) => ({ ...current, rotation }))}
            help="Straighten a tilted horizon. Any angle other than a quarter turn grows the canvas so no corner is cut off."
          />
          {!isQuarterTurn(orientation.rotation) && (
            <ChipGroup label="Fill the exposed corners with" value={editor.fill} choices={FILL_CHOICES} onChange={editor.setFill} />
          )}

          <PanelTitle icon={<Settings2 size={18} />} title="Additional Settings" />
          <OutputFields editor={editor} />
          <ApplyButton editor={editor} label="Apply Changes" idleHint="Rotate or flip the image to enable Apply." />
        </>
      )}
      below={<OrientResult editor={editor} success="Image rotated successfully!" badge={describeOrientation(orientation)} />}
    />
  );
}

export function FlipWorkbench({ tool }: { tool: ToolDefinition }) {
  const editor = useOrientEditor(tool);
  const { image, orientation, setOrientation } = editor;
  const [advanced, setAdvanced] = useState(false);
  const toggle = (action: "flipH" | "flipV") => setOrientation((current) => applyOrientation(current, action));

  return (
    <EditorShell
      tool={tool}
      images={editor.images}
      preview={image && (
        <>
          <PanelTitle icon={<ImageIcon size={18} />} title="Image Preview" />
          <ImageStage image={image} label="Original" meta={describeImage(image)} />
          <EditorThumbs images={editor.images} />
        </>
      )}
      settings={(
        <>
          <PanelTitle icon={<FlipHorizontal2 size={18} />} title="Flip Options" />
          <div className="action-tiles is-large" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <button type="button" className="action-tile" aria-pressed={orientation.flipH} onClick={() => toggle("flipH")}>
              <span aria-hidden><FlipHorizontal2 size={26} /></span>
              <b>Flip Horizontal</b>
              <small>Mirror left ↔ right</small>
            </button>
            <button type="button" className="action-tile" aria-pressed={orientation.flipV} onClick={() => toggle("flipV")}>
              <span aria-hidden><FlipVertical2 size={26} /></span>
              <b>Flip Vertical</b>
              <small>Mirror top ↕ bottom</small>
            </button>
          </div>

          <PanelTitle icon={<Eye size={18} />} title="Live Preview" />
          {image ? (
            <ImageStage image={image} label={flipLabel(orientation)}>
              <OrientedPreview image={image} orientation={orientation} background={null} />
            </ImageStage>
          ) : <p className="editor-note">Upload an image to see the flipped preview here.</p>}
        </>
      )}
      below={(
        <>
          <section className="card editor-card">
            <PanelTitle
              icon={<Settings2 size={18} />}
              title="Output Settings"
              actions={(
                <button type="button" className="ghost-button" aria-expanded={advanced} onClick={() => setAdvanced((open) => !open)}>
                  Advanced options <ChevronDown size={14} style={{ transform: advanced ? "rotate(180deg)" : undefined }} />
                </button>
              )}
            />
            <div className="output-bar">
              <ChipGroup label="Output format" value={editor.choice} choices={OUTPUT_CHOICES} onChange={editor.setChoice} />
              <div className="output-bar-action">
                <ApplyButton editor={editor} label="Apply Flip" idleHint="Choose a direction to enable Apply." />
              </div>
            </div>
            {advanced && (LOSSY.has(editor.format)
              ? <RangeField label="Image quality" min={40} max={100} accent unit="%" value={editor.quality} onChange={editor.setQuality} />
              : <p className="editor-note">{FORMAT_NAME[editor.format] ?? editor.format.toUpperCase()} is lossless, so there is no quality setting. Flipping never changes the pixel count.</p>)}
          </section>
          <OrientResult editor={editor} success="Image flipped successfully!" badge={flipLabel(orientation)} />
        </>
      )}
    />
  );
}
