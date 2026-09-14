"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Download, FileImage, FlipHorizontal2, ImageIcon, Loader2, RotateCw, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { TOOLS, type ToolId } from "@/lib/tools";
import { BrandMark } from "@/components/BrandMark";

type Result = { url?: string; text?: string; name?: string; size?: number; mime?: string; width?: string; height?: string; confidence?: number | null };

const groups = ["All", "Optimize", "Transform", "Convert", "Privacy", "AI"] as const;

export function ImageWorkbench() {
  const [activeTool, setActiveTool] = useState<ToolId>("compress");
  const [group, setGroup] = useState<(typeof groups)[number]>("All");
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [base64, setBase64] = useState("");
  const [options, setOptions] = useState<Record<string, string>>({ quality: "78", format: "webp", width: "1600", height: "", left: "0", top: "0", angle: "90", direction: "horizontal", language: "eng", psm: "6", scale: "2" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tool = TOOLS.find((item) => item.id === activeTool) ?? TOOLS[0];

  const visibleTools = useMemo(() => TOOLS.filter((item) => (group === "All" || item.category === group) && `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [group, query]);

  function setTool(id: ToolId) {
    setActiveTool(id);
    if (id === "screenshot-to-text") setOptions((current) => ({ ...current, psm: "11" }));
    if (id === "ocr") setOptions((current) => ({ ...current, psm: "6" }));
    setError("");
    setResult(null);
  }

  function acceptFile(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Choose a JPG, PNG, WebP, AVIF, GIF or TIFF image."); return; }
    if (next.size > 32 * 1024 * 1024) { setError("Images must be 32 MB or smaller."); return; }
    setFile(next);
    setBase64("");
    setPreviewUrl(URL.createObjectURL(next));
    setResult(null);
    setError("");
  }

  function clearInput() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null); setPreviewUrl(""); setBase64(""); setResult(null); setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function run() {
    if (tool.needsFile && !file) { setError("Choose an image before running this tool."); return; }
    if (tool.needsBase64 && !base64.trim()) { setError("Paste a Base64 image payload before running this tool."); return; }
    setBusy(true); setError("");
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const form = new FormData();
      form.append("tool", tool.id);
      if (file) form.append("file", file);
      if (base64) form.append("base64", base64);
      Object.entries(options).forEach(([key, value]) => form.append(key, value));
      const response = await fetch("/api/process", { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "The image could not be processed.");
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = await response.json() as { data?: string; text?: string; bytes?: number; confidence?: number | null };
        setResult({ text: body.data ?? body.text ?? "", size: body.bytes, confidence: body.confidence, mime: contentType });
      } else {
        const blob = await response.blob();
        setResult({ url: URL.createObjectURL(blob), name: response.headers.get("content-disposition")?.match(/filename="([^"]+)/)?.[1] ?? `utilfoundry-${tool.id}`, size: blob.size, mime: contentType, width: response.headers.get("x-image-width") ?? undefined, height: response.headers.get("x-image-height") ?? undefined });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be processed.");
    } finally { setBusy(false); }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  const isImageResult = result?.mime?.startsWith("image/");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top"><BrandMark size={34} /><span>UtilFoundry<em>IMAGES</em></span></a>
        <div className="sidebar-heading">Image toolbox</div>
        <div className="tool-list">
          {visibleTools.map((item) => <button key={item.id} className={`tool-row ${item.id === activeTool ? "active" : ""}`} onClick={() => setTool(item.id)}><span className="tool-row-icon">{item.id === "rotate" ? <RotateCw size={16} /> : item.id === "flip" ? <FlipHorizontal2 size={16} /> : item.category === "Privacy" ? <ShieldCheck size={16} /> : item.category === "AI" ? <Sparkles size={16} /> : <ImageIcon size={16} />}</span><span><strong>{item.name}</strong><small>{item.description}</small></span>{item.id === activeTool && <ArrowRight size={15} />}</button>)}
        </div>
        <div className="sidebar-note"><ShieldCheck size={17} /><span><strong>Explicit upload only</strong><small>Files are processed for this request and never saved as a workspace.</small></span></div>
      </aside>

      <main id="top" className="main-content">
        <header className="topbar"><div><span className="breadcrumb">UtilFoundry / Images</span><strong>{tool.name}</strong></div><span className="local-pill"><span /> Server-local processing</span></header>
        <section className="hero"><div><span className="eyebrow"><Sparkles size={14} /> BUILT FOR CLEANER MEDIA</span><h1>Image work,<br /><em>without the busywork.</em></h1><p>Convert, compress, enhance and extract from images with predictable output, clear controls and no account required.</p></div><div className="hero-stat"><strong>{TOOLS.length}</strong><span>focused tools</span><i><Check size={14} /> local processing · no paid APIs</i></div></section>

        <section className="tool-browser" aria-label="Image tools"><div className="browser-head"><div><span className="section-kicker">Choose a tool</span><h2>One operation at a time.</h2></div><input aria-label="Search image tools" placeholder="Search tools..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="filters">{groups.map((item) => <button className={group === item ? "selected" : ""} key={item} onClick={() => setGroup(item)}>{item}</button>)}</div></section>

        <section className="workspace" aria-label="Image workbench">
          <div className="workspace-heading"><div><span className="section-kicker">Workbench</span><h2>{tool.name}</h2><p>{tool.description}</p></div><button className="clear-button" onClick={clearInput}><Trash2 size={15} /> Clear</button></div>
          {tool.needsBase64 ? <label className="base64-input"><span>Base64 image payload</span><textarea value={base64} onChange={(event) => setBase64(event.target.value)} placeholder="data:image/png;base64,..." spellCheck={false} /></label> : <div className="drop-grid"><button className={`dropzone ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files?.[0]); }}><input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => acceptFile(event.target.files?.[0])} />{file ? <><FileImage size={28} /><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · click to replace</small></> : <><UploadCloud size={30} /><strong>Drop an image here</strong><small>or choose a file · JPG, PNG, WebP, AVIF, GIF, TIFF · 32 MB max</small></>}</button><div className="preview-card">{previewUrl ? <img src={previewUrl} alt="Selected image preview" /> : <div className="empty-preview"><ImageIcon size={28} /><span>Preview appears here</span></div>}</div></div>}

          <div className="options-panel">{(activeTool === "compress" || activeTool === "convert") && <><label>Output format<select value={options.format} onChange={(event) => setOptions({ ...options, format: event.target.value })}><option value="jpeg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="avif">AVIF</option></select></label>{activeTool === "compress" && <label>Quality <output>{options.quality}</output><input type="range" min="20" max="100" value={options.quality} onChange={(event) => setOptions({ ...options, quality: event.target.value })} /></label>}</>}{activeTool === "resize" && <><label>Width (px)<input inputMode="numeric" value={options.width} onChange={(event) => setOptions({ ...options, width: event.target.value })} /></label><label>Height (px)<input inputMode="numeric" placeholder="Keep ratio" value={options.height} onChange={(event) => setOptions({ ...options, height: event.target.value })} /></label></>}{activeTool === "crop" && <>{["left", "top", "width", "height"].map((key) => <label key={key}>{key[0].toUpperCase() + key.slice(1)} (px)<input inputMode="numeric" value={options[key] ?? ""} onChange={(event) => setOptions({ ...options, [key]: event.target.value })} /></label>)}</>}{activeTool === "rotate" && <label>Angle<select value={options.angle} onChange={(event) => setOptions({ ...options, angle: event.target.value })}><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></label>}{activeTool === "flip" && <label>Direction<select value={options.direction} onChange={(event) => setOptions({ ...options, direction: event.target.value })}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>}{(activeTool === "ocr" || activeTool === "screenshot-to-text") && <><label>OCR language<select value={options.language} onChange={(event) => setOptions({ ...options, language: event.target.value })}><option value="eng">English</option><option value="deu">German</option><option value="fra">French</option><option value="hin">Hindi</option><option value="spa">Spanish</option></select></label><label>Layout mode<select value={options.psm} onChange={(event) => setOptions({ ...options, psm: event.target.value })}><option value="6">Standard block</option><option value="11">Sparse / screenshot</option></select></label></>}{activeTool === "upscale" && <label>Scale<select value={options.scale} onChange={(event) => setOptions({ ...options, scale: event.target.value })}><option value="2">2× super-resolution</option></select></label>}{["strip-metadata", "image-to-pdf", "screenshot-to-pdf", "image-to-base64", "base64-to-image", "remove-background", "upscale"].includes(activeTool) && <div className="option-explanation"><ShieldCheck size={16} /><span>{activeTool === "strip-metadata" ? "EXIF, GPS and embedded metadata will be removed." : activeTool === "image-to-base64" ? "The response is a data URI ready for HTML, CSS or APIs." : activeTool === "remove-background" ? "A local U²-Net model creates a transparent PNG cutout." : activeTool === "upscale" ? "A local FSRCNN model produces a 2× PNG with no paid API." : "Output is generated with deterministic, non-AI processing."}</span></div>}</div>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <button className="run-button" onClick={run} disabled={busy}>{busy ? <><Loader2 size={17} className="spin" /> Processing…</> : <>Run {tool.name} <ArrowRight size={17} /></>}</button>

          {result && <div className="result-panel"><div className="result-heading"><div><span className="section-kicker">Output</span><h3>Ready to use</h3></div><span>{result.size ? `${(result.size / 1024).toFixed(1)} KB` : ""}</span></div>{result.text !== undefined ? <div className="text-result">{result.confidence !== undefined && result.confidence !== null && <div className="confidence">Average OCR confidence: {result.confidence}%</div>}<textarea readOnly value={result.text} /><div><button onClick={() => copy(result.text ?? "")}><Copy size={15} /> Copy</button><a className="download-button" href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text ?? "")}`} download={`${tool.id}.txt`}><Download size={15} /> Download TXT</a></div></div> : <div className="result-content">{isImageResult && result.url ? <img src={result.url} alt="Processed image preview" /> : <div className="pdf-result"><FileImage size={30} /><strong>PDF generated</strong><span>{result.name}</span></div>}<a className="download-button" href={result.url} download={result.name}><Download size={16} /> Download output</a></div>}</div>}
        </section>

        <footer className="footer"><span>UtilFoundry Images · practical tools, crafted well.</span><span><ShieldCheck size={14} /> No automatic history or analytics payloads</span></footer>
      </main>
    </div>
  );
}
