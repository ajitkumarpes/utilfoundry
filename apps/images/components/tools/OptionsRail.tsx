"use client";
/* eslint-disable @next/next/no-img-element */

import { AlignJustify, Circle, CircleDashed, Eye, Globe, Lightbulb, Lock, Server, ShieldCheck, Square, Target, Zap, ImagePlus } from "lucide-react";
import { ColorField, NumberField, PositionPad, RadioRow, RangeField, SelectField, TextField, TileRow, ToggleRow, type WatermarkPosition, Field } from "@/components/ui/Fields";
import { BottomCorners, CircleCorner, CustomCorners, DashedBox, DottedBox, DoubleBox, PhotoSwatch, RoundedCorner, SolidBox, SquareCorner, TopCorners } from "@/components/ui/Glyphs";
import { useRef } from "react";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";
import type { ToolDefinition } from "@/lib/tools";

export type RailProps = {
  tool: ToolDefinition;
  options: ToolOptions;
  set: (key: string, value: string | number | boolean) => void;
  /** Bound to the live preview so the rail's zoom slider actually moves the image. */
  zoom?: number;
  onZoom?: (value: number) => void;
  /** The watermark logo, which the workbench keeps. */
  overlay?: SourceImage | null;
  onOverlay?: (files: File[]) => void;
  onClearOverlay?: () => void;
};

const num = (options: ToolOptions, key: string, fallback: number) => {
  const value = Number(options[key]);
  return Number.isFinite(value) ? value : fallback;
};
const text = (options: ToolOptions, key: string, fallback: string) =>
  options[key] === undefined ? fallback : String(options[key]);
const flag = (options: ToolOptions, key: string, fallback = false) =>
  options[key] === undefined ? fallback : options[key] === true || options[key] === "true";

const IMAGE_FORMATS = [
  { value: "png", label: "PNG (Recommended)" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
  { value: "tiff", label: "TIFF" }
];

export function OptionsRail({ tool, options, set, zoom, onZoom, overlay, onOverlay, onClearOverlay }: RailProps) {
  switch (tool.id) {
    case "blur-image":
      return <BlurOptions options={options} set={set} zoom={zoom} onZoom={onZoom} />;
    case "sharpen-image":
      return <SharpenOptions options={options} set={set} />;
    case "grayscale-image":
      return <GrayscaleOptions options={options} set={set} />;
    case "rounded-corners":
      return <RoundedOptions options={options} set={set} />;
    case "add-border":
      return <BorderOptions options={options} set={set} />;
    case "watermark-image":
      return <WatermarkOptions options={options} set={set} overlay={overlay} onOverlay={onOverlay} onClearOverlay={onClearOverlay} />;
    case "background-removal":
      return <BackgroundOptions options={options} set={set} />;
    case "image-upscaler":
      return <UpscaleOptions options={options} set={set} />;
    case "ocr-image":
    case "screenshot-to-text":
      return <OcrOptions tool={tool} options={options} set={set} />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tip-card">
      <Lightbulb size={20} />
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}

function Reasons({ items }: { items: { icon: React.ReactNode; color: string; tint: string; title: string; note: string }[] }) {
  return (
    <section className="card rail-card">
      <h2>Why use this tool?</h2>
      <div className="reason-list">
        {items.map((item) => (
          <div className="reason" key={item.title}>
            <i style={{ background: item.tint, color: item.color }}>{item.icon}</i>
            <div><strong>{item.title}</strong><small>{item.note}</small></div>
          </div>
        ))}
      </div>
    </section>
  );
}

const PRIVACY_REASONS = [
  { icon: <Zap size={17} />, color: "#e8912a", tint: "var(--amber-tint)", title: "Fast & easy", note: "Get results in seconds" },
  { icon: <ShieldCheck size={17} />, color: "var(--green)", tint: "var(--green-tint)", title: "100% private", note: "Files are processed on this server, never stored" },
  { icon: <Eye size={17} />, color: "var(--blue)", tint: "var(--blue-tint)", title: "No account required", note: "Start using immediately" }
];

/* ------------------------------ Blur ----------------------------- */

function BlurOptions({ options, set, zoom, onZoom }: Pick<RailProps, "options" | "set" | "zoom" | "onZoom">) {
  return (
    <section className="card rail-card">
      <h2>Blur Options</h2>
      <TileRow
        label="Blur Type"
        value={text(options, "blurType", "gaussian")}
        onChange={(value) => set("blurType", value)}
        options={[
          { value: "gaussian", label: "Gaussian", icon: <CircleDashed size={20} strokeWidth={1.8} /> },
          { value: "motion", label: "Motion", icon: <AlignJustify size={20} strokeWidth={1.8} /> },
          { value: "box", label: "Box", icon: <Square size={20} strokeWidth={1.8} /> },
          { value: "lens", label: "Lens", icon: <Circle size={20} strokeWidth={1.8} /> }
        ]}
      />
      <RangeField label="Blur Intensity" min={0} max={50} value={num(options, "intensity", 10)} onChange={(value) => set("intensity", value)} />
      {onZoom && <RangeField label="Preview Zoom" min={25} max={300} step={25} unit="%" value={zoom ?? 100} onChange={onZoom} />}

      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0 16px" }} />
      <p className="field-label" style={{ marginBottom: 14 }}>Advanced Options</p>
      <ToggleRow label="Maintain Original Size" note="Off exports at half resolution" checked={flag(options, "keepSize", true)} onChange={(value) => set("keepSize", value)} tone="blue" />
      <ToggleRow label="Apply to Entire Image" note="Off keeps the centre sharp" checked={flag(options, "wholeImage", true)} onChange={(value) => set("wholeImage", value)} tone="blue" />
    </section>
  );
}

/* ---------------------------- Sharpen ---------------------------- */

function SharpenOptions({ options, set }: Pick<RailProps, "options" | "set">) {
  return (
    <>
      <section className="card rail-card">
        <h2>Sharpen Options</h2>
        <RangeField label="Sharpen Intensity" min={0} max={100} value={num(options, "intensity", 50)} onChange={(value) => set("intensity", value)} />
      </section>

      <Tip title="Pro Tip">Start with a lower intensity and increase gradually. Above roughly 70 the edges begin to show bright halos.</Tip>

      <section className="card rail-card">
        <h2>Advanced Options</h2>
        <ToggleRow label="Reduce Noise" note="Minimize image noise while sharpening" checked={flag(options, "reduceNoise", true)} onChange={(value) => set("reduceNoise", value)} tone="blue" />
        <ToggleRow label="Preserve Colors" note="Keep original colors natural" checked={flag(options, "preserveColors", true)} onChange={(value) => set("preserveColors", value)} tone="blue" />
        <ToggleRow label="Enhance Edges" note="Improve edge definition" checked={flag(options, "enhanceEdges", true)} onChange={(value) => set("enhanceEdges", value)} tone="blue" />
        <OutputFormatField options={options} set={set} />
      </section>
    </>
  );
}

/* --------------------------- Grayscale --------------------------- */

function GrayscaleOptions({ options, set }: Pick<RailProps, "options" | "set">) {
  return (
    <section className="card rail-card">
      <h2>Grayscale Options</h2>
      <TileRow
        label="Grayscale Mode"
        value={text(options, "mode", "desaturate")}
        onChange={(value) => set("mode", value)}
        options={[
          { value: "desaturate", label: "Desaturate", icon: <PhotoSwatch from="#9aa3b2" to="#45506a" /> },
          { value: "luminosity", label: "Luminosity", icon: <PhotoSwatch from="#c3c9d4" to="#2f3849" /> },
          { value: "average", label: "Average", icon: <PhotoSwatch from="#adb4c1" to="#5b6679" /> }
        ]}
      />
      <RangeField label="Brightness" min={-100} max={100} value={num(options, "brightness", 0)} onChange={(value) => set("brightness", value)} />
      <RangeField label="Contrast" min={-100} max={100} value={num(options, "contrast", 0)} onChange={(value) => set("contrast", value)} />
      <div className="field">
        <ToggleRow label="Keep Original Size" note="Off exports at half resolution" checked={flag(options, "keepSize", true)} onChange={(value) => set("keepSize", value)} tone="blue" />
      </div>
      <OutputFormatField options={options} set={set} />
    </section>
  );
}

/* ------------------------ Rounded corners ------------------------ */

function RoundedOptions({ options, set }: Pick<RailProps, "options" | "set">) {
  const background = text(options, "background", "transparent");
  return (
    <>
      <section className="card rail-card">
        <h2>Corner Options</h2>
        <RangeField label="Corner Radius" min={0} max={200} accent value={num(options, "radius", 32)} onChange={(value) => set("radius", value)} unit=" px" />

        <TileRow
          label="Corner Style"
          value={text(options, "cornerStyle", "all")}
          onChange={(value) => set("cornerStyle", value)}
          options={[
            { value: "all", label: "All Corners", icon: <RoundedCorner /> },
            { value: "top", label: "Top Only", icon: <TopCorners /> },
            { value: "bottom", label: "Bottom Only", icon: <BottomCorners /> },
            { value: "custom", label: "Custom", icon: <CustomCorners /> }
          ]}
        />

        {text(options, "cornerStyle", "all") === "custom" && (
          <div className="split-row" style={{ marginTop: 14 }}>
            <NumberField label="Top left" min={0} value={text(options, "radiusTopLeft", "32")} onChange={(value) => set("radiusTopLeft", value)} />
            <NumberField label="Top right" min={0} value={text(options, "radiusTopRight", "32")} onChange={(value) => set("radiusTopRight", value)} />
            <NumberField label="Bottom right" min={0} value={text(options, "radiusBottomRight", "32")} onChange={(value) => set("radiusBottomRight", value)} />
            <NumberField label="Bottom left" min={0} value={text(options, "radiusBottomLeft", "32")} onChange={(value) => set("radiusBottomLeft", value)} />
          </div>
        )}

        <RadioRow
          label="Background Options"
          value={background}
          onChange={(value) => set("background", value)}
          options={[{ value: "transparent", label: "Keep original background" }, { value: "color", label: "Add background color" }]}
        />
        {background === "color" && <ColorField label="Background color" value={text(options, "backgroundColor", "#FFFFFF")} onChange={(value) => set("backgroundColor", value)} />}

        <OutputFormatField options={options} set={set} help="PNG supports transparency and high quality." />
      </section>

      <Tip title="Pro Tip">Use a larger corner radius for a modern, smooth look. 20–50 px works well for most images. Export as PNG so the rounded corners stay transparent.</Tip>
    </>
  );
}

/* ----------------------------- Border ---------------------------- */

function BorderOptions({ options, set }: Pick<RailProps, "options" | "set">) {
  const grow = flag(options, "changeOutputSize", true);
  return (
    <section className="card rail-card">
      <h2>Border Options</h2>
      <TileRow
        label="Border Style"
        value={text(options, "borderStyle", "solid")}
        onChange={(value) => set("borderStyle", value)}
        options={[
          { value: "solid", label: "Solid", icon: <SolidBox /> },
          { value: "dashed", label: "Dashed", icon: <DashedBox /> },
          { value: "dotted", label: "Dotted", icon: <DottedBox /> },
          { value: "double", label: "Double", icon: <DoubleBox /> }
        ]}
      />
      <ColorField label="Border Color" value={text(options, "borderColor", "#3B82F6")} onChange={(value) => set("borderColor", value)} />
      <RangeField label="Border Thickness" min={1} max={120} accent value={num(options, "thickness", 20)} onChange={(value) => set("thickness", value)} unit=" px" />
      <TileRow
        label="Corner Style"
        value={text(options, "cornerStyle", "square")}
        onChange={(value) => set("cornerStyle", value)}
        options={[
          { value: "square", label: "Square", icon: <SquareCorner /> },
          { value: "rounded", label: "Rounded", icon: <RoundedCorner /> },
          { value: "circle", label: "Circle", icon: <CircleCorner /> }
        ]}
      />
      <div className="field">
        <ToggleRow label="Keep Original Size" note="Draw the border inside the original dimensions." checked={!grow} onChange={(value) => set("changeOutputSize", !value)} />
        <ToggleRow label="Change Output Size" note="Grow the image so the border sits outside it." checked={grow} onChange={(value) => set("changeOutputSize", value)} />
      </div>
      <OutputFormatField options={options} set={set} />
    </section>
  );
}

/* ---------------------------- Watermark -------------------------- */

function WatermarkOptions({ options, set, overlay, onOverlay, onClearOverlay }: Pick<RailProps, "options" | "set" | "overlay" | "onOverlay" | "onClearOverlay">) {
  const mode = text(options, "mode", "text");
  const pick = useRef<HTMLInputElement>(null);
  return (
    <section className="card rail-card">
      <h2>Watermark Options</h2>
      <div className="tab-row is-segmented" style={{ marginBottom: 18 }} role="tablist" aria-label="Watermark type">
        <button type="button" role="tab" aria-selected={mode === "text"} onClick={() => set("mode", "text")}>Text Watermark</button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "image"}
          onClick={() => {
            set("mode", "image");
            // A tilted logo is rarely wanted; the text mark's default tilt is dropped.
            if (num(options, "rotation", -30) === -30) set("rotation", 0);
          }}
        >
          Image Watermark
        </button>
      </div>

      {mode === "image" ? (
        <>
          <Field label="Watermark image" help="A PNG with transparency, such as a logo, works best.">
            <input
              ref={pick}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                if (event.target.files?.length) onOverlay?.(Array.from(event.target.files));
                event.target.value = "";
              }}
            />
            {overlay ? (
              <div className="overlay-pick">
                <img src={overlay.url} alt="" />
                <span><b>{overlay.name}</b><small>{overlay.width} × {overlay.height}</small></span>
                <button type="button" className="link-button" onClick={() => pick.current?.click()}>Replace</button>
                <button type="button" className="link-button" onClick={onClearOverlay}>Remove</button>
              </div>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => pick.current?.click()}><ImagePlus size={16} /> Choose watermark image</button>
            )}
          </Field>
          <RangeField label="Size" min={5} max={100} unit="%" value={num(options, "logoSize", 25)} onChange={(value) => set("logoSize", value)} help="Width of the watermark as a share of the photo's width." />
        </>
      ) : (
        <>
          <TextField label="Text" value={text(options, "text", "UtilFoundry")} onChange={(value) => set("text", value)} placeholder="Your watermark text" />
          <SelectField
            label="Font"
            value={text(options, "font", "inter")}
            onChange={(value) => set("font", value)}
            options={[
              { value: "inter", label: "Inter (Default)" },
              { value: "serif", label: "Serif" },
              { value: "mono", label: "Monospace" },
              { value: "condensed", label: "Condensed" }
            ]}
          />
          <RangeField label="Font Size" min={8} max={320} value={num(options, "fontSize", 72)} onChange={(value) => set("fontSize", value)} />
          <ColorField label="Text Color" value={text(options, "textColor", "#FFFFFF")} onChange={(value) => set("textColor", value)} />
        </>
      )}

      <RangeField label="Opacity" min={5} max={100} value={num(options, "opacity", 50)} onChange={(value) => set("opacity", value)} unit="%" />
      <PositionPad value={text(options, "position", "middle-center")} onChange={(value: WatermarkPosition) => set("position", value)} />
      <RangeField label="Rotation" min={-90} max={90} value={num(options, "rotation", -30)} onChange={(value) => set("rotation", value)} unit="°" />
      {mode === "text" && (
        <>
          <div className="field">
            <ToggleRow label="Add Shadow" checked={flag(options, "shadow", true)} onChange={(value) => set("shadow", value)} />
            <ToggleRow label="Outline Text" checked={flag(options, "outline", false)} onChange={(value) => set("outline", value)} />
          </div>
          {flag(options, "outline", false) && <ColorField label="Outline Color" value={text(options, "outlineColor", "#111C3D")} onChange={(value) => set("outlineColor", value)} />}
        </>
      )}
      <OutputFormatField options={options} set={set} />
    </section>
  );
}

/* --------------------------- Simple rails ------------------------ */

function OutputFormatField({ options, set, help = "High quality with good compression." }: Pick<RailProps, "options" | "set"> & { help?: string }) {
  const format = text(options, "format", "png");
  return (
    <>
      <SelectField
        label="Output Format"
        help={help}
        value={format}
        onChange={(value) => set("format", value)}
        options={[{ value: "auto", label: "Keep original format" }, ...IMAGE_FORMATS]}
      />
      {format !== "png" && format !== "auto" && (
        <RangeField label="Quality" min={5} max={100} accent value={num(options, "quality", 92)} onChange={(value) => set("quality", value)} />
      )}
    </>
  );
}

/* --------------------------- Worker rails ------------------------ */

function BackgroundOptions({ options, set }: Pick<RailProps, "options" | "set">) {
  return (
    <>
      <section className="card rail-card">
        <h2>Output Options</h2>
        <SelectField
          label="Output Format"
          help="Best for logos, product photos, and graphics."
          value={text(options, "format", "png")}
          onChange={(value) => set("format", value)}
          options={[{ value: "png", label: "PNG (Transparent background)" }, { value: "webp", label: "WebP (Transparent background)" }]}
        />
        {text(options, "format", "png") === "webp" && (
          <RangeField label="Image Quality" min={40} max={100} accent value={num(options, "quality", 90)} onChange={(value) => set("quality", value)} unit="%" help="Applies to WebP. PNG is always lossless." />
        )}
        <SelectField
          label="Image Size"
          help="Resize the output image (optional)."
          value={text(options, "outputSize", "original")}
          onChange={(value) => set("outputSize", value)}
          options={[
            { value: "original", label: "Same as original" },
            { value: "1024", label: "Max 1024 px" },
            { value: "512", label: "Max 512 px" },
            { value: "256", label: "Max 256 px" }
          ]}
        />
        <p className="field-help">The model refines the mask edges on every run. Format and size are applied when you download.</p>
      </section>
      <Reasons items={[
        { icon: <ShieldCheck size={17} />, color: "var(--purple)", tint: "var(--purple-tint)", title: "AI-powered accuracy", note: "Precisely detects and removes backgrounds" },
        ...PRIVACY_REASONS
      ]} />
      <section className="card rail-card">
        <h2>Common use cases</h2>
        <ul className="check-list">
          {["Product photos for e-commerce", "Logos and graphics", "Profile pictures", "Social media content", "Marketing and presentations"].map((item) => <li key={item}><Target size={14} /> {item}</li>)}
        </ul>
      </section>
    </>
  );
}

function UpscaleOptions({ options, set }: Pick<RailProps, "options" | "set">) {
  return (
    <>
      <section className="card rail-card">
        <h2>Upscale Options</h2>
        <TileRow
          label="Upscale Factor"
          help="Increase image resolution by 2×, 4× or 8×."
          value={text(options, "scale", "2")}
          onChange={(value) => set("scale", value)}
          options={[{ value: "2", label: "2×" }, { value: "4", label: "4×" }, { value: "8", label: "8×" }]}
        />
        <SelectField
          label="Output Format"
          help="PNG preserves maximum quality."
          value={text(options, "format", "png")}
          onChange={(value) => set("format", value)}
          options={[{ value: "png", label: "PNG (Best Quality)" }, { value: "jpeg", label: "JPG (Smaller file)" }, { value: "webp", label: "WebP" }]}
        />
        <p className="field-help">Runs the FSRCNN super-resolution model on this server: 2× per pass, so 4× and 8× take two and three passes. The format is applied when you download.</p>
      </section>
      <Reasons items={[
        { icon: <Zap size={17} />, color: "var(--purple)", tint: "var(--purple-tint)", title: "Sharper details", note: "Enhance clarity and fine details" },
        ...PRIVACY_REASONS
      ]} />
    </>
  );
}

function OcrOptions({ tool, options, set }: RailProps) {
  return (
    <>
      <section className="card rail-card">
        <h2>OCR Options</h2>
        <SelectField
          label="Language"
          help="Auto detect assumes Latin script. Pick a language for best accuracy."
          value={text(options, "language", "auto")}
          onChange={(value) => set("language", value)}
          options={[
            { value: "auto", label: "Auto Detect (Recommended)" },
            { value: "eng", label: "English" },
            { value: "deu", label: "German" },
            { value: "fra", label: "French" },
            { value: "spa", label: "Spanish" },
            { value: "hin", label: "Hindi" }
          ]}
        />
        <RadioRow
          label="OCR Mode"
          value={text(options, "psm", tool.id === "screenshot-to-text" ? "11" : "6")}
          onChange={(value) => set("psm", value)}
          options={[
            { value: "6", label: "Standard (printed text)" },
            { value: "11", label: "Sparse / screenshot" },
            { value: "3", label: "Full page" }
          ]}
        />
        <div className="field">
          <ToggleRow label="Preserve Formatting" note="Keep the original line breaks. Off rejoins wrapped lines into paragraphs." checked={flag(options, "preserveFormatting", true)} onChange={(value) => set("preserveFormatting", value)} />
        </div>
      </section>
      <Reasons items={[
        { icon: <Target size={17} />, color: "var(--purple)", tint: "var(--purple-tint)", title: "High accuracy", note: "Powered by a locally hosted OCR engine" },
        { icon: <Globe size={17} />, color: "var(--blue)", tint: "var(--blue-tint)", title: "Multiple languages", note: "Whatever language packs the worker has installed" },
        { icon: <Server size={17} />, color: "var(--green)", tint: "var(--green-tint)", title: "No paid API", note: "Nothing is sent to a third-party service" },
        { icon: <Lock size={17} />, color: "#e8912a", tint: "var(--amber-tint)", title: "No account required", note: "Start using immediately" }
      ]} />
    </>
  );
}
