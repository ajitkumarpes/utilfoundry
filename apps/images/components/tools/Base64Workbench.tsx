"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FileCode2, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/Fields";
import { EditorAlert } from "@/components/ui/EditorParts";
import { InfoRail } from "@/components/ui/InfoRail";
import { PreviewEmpty } from "@/components/ui/PreviewFrame";
import { StepCard } from "@/components/ui/StepCard";
import { StatusBar } from "@/components/ui/StatusBar";
import { SampleStrip, UploadZone } from "@/components/ui/UploadZone";
import { errorMessage, formatLabel } from "@/components/tools/EditorShell";
import { useCopy } from "@/components/tools/useCopy";
import { useImageInput } from "@/components/tools/useImageInput";
import { EXTENSION_BY_MIME } from "@/lib/batch";
import { decodeBase64Payload, SNIPPET_MODES, toSnippet, type SnippetMode } from "@/lib/base64";
import { context, createCanvas } from "@/lib/canvas/effects";
import { downloadBlob, encodeCanvas } from "@/lib/canvas/encode";
import { loadImageElement } from "@/lib/canvas/load";
import { baseName, formatBytes, formatNumber } from "@/lib/format";
import { samplesFor } from "@/lib/samples";
import { acceptedFormats, type ToolDefinition } from "@/lib/tools";

const RAIL = ["reasons", "formats", "tips", "feedback"] as const;
const SNIPPET_EXTENSION: Record<SnippetMode, string> = { "data-uri": "txt", raw: "txt", html: "html", css: "css", json: "json" };

/** Image → Base64: reads the original bytes, so the payload is byte-for-byte faithful. */
export function ImageToBase64({ tool }: { tool: ToolDefinition }) {
  const input = useImageInput({ multiple: false });
  const image = input.images[0] ?? null;
  const [mode, setMode] = useState<SnippetMode>("data-uri");
  // Keyed by image id: the payload is only used while it still matches the file.
  const [encodedFor, setEncodedFor] = useState<{ id: string; value: string } | null>(null);
  const [error, setError] = useState("");
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (!image?.file) return;
    const id = image.id;
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => { if (!cancelled) setEncodedFor({ id, value: String(reader.result ?? "") }); };
    reader.onerror = () => { if (!cancelled) setError("This file could not be read."); };
    reader.readAsDataURL(image.file);
    return () => { cancelled = true; reader.abort(); };
  }, [image]);

  const dataUri = image && encodedFor?.id === image.id ? encodedFor.value : "";
  const output = dataUri && image ? toSnippet(mode, dataUri, { name: image.name, width: image.width, height: image.height }) : "";
  const shown = input.error || error;

  async function copyOutput() {
    if (!(await copy(output))) setError("Copying is blocked in this browser. Select the text and copy it manually.");
  }

  return (
    <div className="workspace">
      <div className="workspace-main">
        <div className="step-grid">
          <StepCard step={1} title="Upload Image" subtitle="Choose an image file to convert to Base64">
            <UploadZone compact={Boolean(image)} multiple={false} accept="image/*" label="Choose Image" hint={acceptedFormats(tool)} maxNote="Max 32 MB per file" onFiles={input.addFiles} />
            {!image && <SampleStrip samples={samplesFor(tool.id)} activeSrc={input.sampleSrc} onPick={input.addSample} />}
          </StepCard>

          <StepCard
            step={2}
            title="Image Preview"
            subtitle={image ? "Selected image" : "Nothing selected yet"}
            actions={image && <button type="button" className="btn btn-outline btn-sm" onClick={input.clear}><RefreshCw size={14} /> Change Image</button>}
          >
            {!image ? <PreviewEmpty message="Choose an image to see it here." /> : (
              <>
                <div className="preview-stage checkerboard"><img src={image.url} alt={image.name} /></div>
                <div className="file-caption">
                  <span>
                    <b>{image.name}</b>
                    <small>{formatBytes(image.size)} · {image.width} × {image.height} px · {image.type}</small>
                  </span>
                </div>
              </>
            )}
          </StepCard>
        </div>

        <StepCard
          step={3}
          title="Base64 Output"
          subtitle="Image converted to a Base64 string"
          actions={(
            <>
              <select className="control control-inline" aria-label="Output format" value={mode} onChange={(event) => setMode(event.target.value as SnippetMode)}>
                {SNIPPET_MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <button type="button" className="btn btn-outline btn-sm" disabled={!output} onClick={copyOutput}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!output}
                onClick={() => downloadBlob(new Blob([output], { type: "text/plain;charset=utf-8" }), `${baseName(image?.name ?? "image")}-base64.${SNIPPET_EXTENSION[mode]}`)}
              >
                <Download size={14} /> Download .{SNIPPET_EXTENSION[mode]}
              </button>
            </>
          )}
        >
          {!output ? <PreviewEmpty message="The Base64 string appears here as soon as an image is chosen." /> : (
            <>
              <textarea className="text-output code-output" readOnly spellCheck={false} value={output} aria-label="Base64 output" />
              <p className="text-meta">
                <span>Characters: {formatNumber(output.length)}</span>
                <span>Source: {formatBytes(image?.size ?? 0)}</span>
                <span>Base64 adds {Math.round(((dataUri.length - (image?.size ?? 0)) / Math.max(1, image?.size ?? 1)) * 100)}%</span>
              </p>
            </>
          )}
        </StepCard>

        <StatusBar
          tone={shown ? "error" : output ? "ready" : "idle"}
          title={shown || (output ? "Done! Your image has been converted to Base64." : "Upload an image to begin")}
          note={shown ? "Fix the problem above and try again." : output ? "Copy the string, or download it as a file." : "Drop a file or pick a sample to start."}
        >
          {output && <button type="button" className="btn btn-outline" onClick={input.clear}><RefreshCw size={15} /> Convert Another Image</button>}
        </StatusBar>
      </div>

      <aside className="rail" aria-label={`About ${tool.name}`}>
        <InfoRail tool={tool} include={[...RAIL]} />
      </aside>
    </div>
  );
}

const OUTPUT_FORMATS = [
  { value: "detect", label: "Detect from Base64 (recommended)" },
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" }
];

const EXTENSION: Record<string, string> = { ...EXTENSION_BY_MIME, "image/svg+xml": "svg" };

type Built = { key: string; blob: Blob; name: string };

/** Base64 → image: decoded in the browser. "Detect" hands back the exact original bytes. */
export function Base64ToImage({ tool }: { tool: ToolDefinition }) {
  const [payload, setPayload] = useState("");
  const [format, setFormat] = useState("detect");
  const [fileName, setFileName] = useState("image");
  const [dims, setDims] = useState<{ key: string; width: number; height: number } | null>(null);
  const [failed, setFailed] = useState("");
  const [built, setBuilt] = useState<Built | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState("");
  const { copied, copy } = useCopy();

  const parsed = useMemo(() => {
    if (!payload.trim()) return null;
    try {
      return { value: decodeBase64Payload(payload), error: "" };
    } catch (cause) {
      return { value: null, error: errorMessage(cause, "That is not a valid Base64 string.") };
    }
  }, [payload]);

  const decoded = parsed?.value ?? null;
  const mime = decoded ? decoded.mime ?? decoded.declared : null;
  const src = decoded && mime ? `data:${mime};base64,${decoded.base64}` : "";
  // A cheap identity for the decoded image, so state tied to it goes stale on its own.
  const identity = decoded ? `${decoded.base64.length}:${decoded.base64.slice(0, 48)}:${decoded.base64.slice(-24)}` : "";
  const size = dims?.key === identity ? dims : null;
  const safeName = (baseName(fileName.trim()) || "image").replace(/[^\w.-]+/g, "-");
  const key = `${identity}|${format}|${safeName}`;
  const result = built?.key === key ? built : null;

  const problem = parsed?.error
    || (decoded && !mime ? "These bytes are not an image format this tool recognises." : "")
    || (failed && failed === identity ? "Your browser could not display this image; the data may be damaged or incomplete." : "");
  const mismatch = decoded?.declared && decoded.mime && decoded.declared !== decoded.mime
    ? `The data URI says ${decoded.declared}, but the bytes are ${formatLabel(decoded.mime)}. The real format is used.`
    : "";

  async function loadExample() {
    setLoadingExample(true);
    setError("");
    try {
      const blob = await (await fetch("/samples/mark.png")).blob();
      const reader = new FileReader();
      reader.onload = () => setPayload(String(reader.result ?? ""));
      reader.readAsDataURL(blob);
    } catch (cause) {
      setError(errorMessage(cause, "The example could not be loaded."));
    } finally {
      setLoadingExample(false);
    }
  }

  async function generate() {
    if (!decoded || !mime || problem) return;
    setBusy(true);
    setError("");
    try {
      let blob: Blob;
      let extension: string;
      if (format === "detect") {
        blob = new Blob([decoded.bytes as BlobPart], { type: mime });
        extension = EXTENSION[mime] ?? "img";
      } else {
        const element = await loadImageElement(src);
        const canvas = createCanvas(element.naturalWidth, element.naturalHeight);
        context(canvas).drawImage(element, 0, 0);
        const encoded = await encodeCanvas(canvas, format, 92);
        blob = encoded.blob;
        extension = encoded.extension;
      }
      setBuilt({ key, blob, name: `${safeName}.${extension}` });
    } catch (cause) {
      setError(errorMessage(cause, "The image could not be generated."));
    } finally {
      setBusy(false);
    }
  }

  async function copyAgain() {
    if (!(await copy(src))) setError("Copying is blocked in this browser. Select the text and copy it manually.");
  }

  const shown = error || problem;

  return (
    <div className="workspace">
      <div className="workspace-main">
        <div className="step-grid">
          <div className="step-stack">
            <StepCard
              step={1}
              title="Paste Base64 String"
              subtitle="Paste your Base64-encoded image data below"
              actions={(
                <button type="button" className="btn btn-outline btn-sm" disabled={loadingExample} onClick={loadExample}>
                  {loadingExample ? <Loader2 size={14} className="spin" /> : <FileCode2 size={14} />} Load Example
                </button>
              )}
            >
              <label className="textarea-field">
                <span className="sr-only">Base64 image payload</span>
                <textarea
                  value={payload}
                  spellCheck={false}
                  placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA…"
                  onChange={(event) => setPayload(event.target.value)}
                />
              </label>
              <span className="field-help">Supports Base64 strings with or without the data URL prefix (data:image/png;base64,…). Line breaks and URL-safe characters are fine.</span>
            </StepCard>

            <StepCard step={2} title="Output Settings" subtitle="Choose the output format and file name">
              <div className="split-row">
                <SelectField label="Image format" value={format} options={OUTPUT_FORMATS} onChange={setFormat} />
                <TextField label="File name (optional)" value={fileName} placeholder="image" onChange={setFileName} />
              </div>
              <span className="field-help">
                {format === "detect" ? "The decoded bytes are saved exactly as they are, with the right extension added." : "The image is re-encoded; the extension is added automatically."}
              </span>
              <button type="button" className="btn btn-primary btn-block-lg" disabled={!decoded || Boolean(problem) || busy} onClick={generate}>
                {busy ? <Loader2 size={18} className="spin" aria-hidden /> : <ImagePlus size={18} aria-hidden />} Generate Image
              </button>
            </StepCard>
          </div>

          <StepCard step={3} title="Preview & Download" subtitle={src && !problem ? "Your image is decoded" : "Waiting for a valid string"}>
            {!src || parsed?.error ? <PreviewEmpty message="Paste a Base64 string to see the image." /> : (
              <>
                <div className="preview-stage checkerboard">
                  <img
                    src={src}
                    alt="Decoded"
                    onLoad={(event) => setDims({ key: identity, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                    onError={() => setFailed(identity)}
                  />
                </div>
                <div className="result-details">
                  <h3>Image details</h3>
                  <dl>
                    <div><dt>Format</dt><dd>{mime ? formatLabel(mime) : "Unknown"}</dd></div>
                    <div><dt>Dimensions</dt><dd>{size ? `${size.width} × ${size.height} px` : "…"}</dd></div>
                    <div><dt>File size</dt><dd>{formatBytes(decoded?.bytes.length ?? 0)}</dd></div>
                  </dl>
                </div>
                {mismatch && <p className="editor-note">{mismatch}</p>}
                {result && (
                  <button type="button" className="btn btn-success btn-block-lg" onClick={() => downloadBlob(result.blob, result.name)}>
                    <Download size={18} aria-hidden /> Download {result.name} · {formatBytes(result.blob.size)}
                  </button>
                )}
                <button type="button" className="btn btn-outline" onClick={copyAgain}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy Base64 Again"}
                </button>
              </>
            )}
          </StepCard>
        </div>

        <EditorAlert message={shown} />
        <StatusBar
          tone={shown ? "error" : result ? "ready" : "idle"}
          title={shown ? "Check the Base64 string" : result ? "Your image is ready!" : decoded ? "Decoded. Choose the output and generate." : "Paste a string to begin"}
          note={shown ? "Paste the complete string, including every character." : result ? "Download it, or change the settings and generate again." : "Data URIs and raw Base64 are both accepted."}
        />
      </div>

      <aside className="rail" aria-label={`About ${tool.name}`}>
        <InfoRail tool={tool} include={[...RAIL]} />
      </aside>
    </div>
  );
}
