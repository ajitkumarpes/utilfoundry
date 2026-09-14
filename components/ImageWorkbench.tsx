"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  Crop,
  Download,
  FileImage,
  FileOutput,
  FlipHorizontal2,
  Gauge,
  ImageIcon,
  Leaf,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  RotateCw,
  ScanLine,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  WandSparkles,
  X,
  UploadCloud,
  Zap
} from "lucide-react";
import { TOOLS, type ToolId } from "@/lib/tools";
import { BrandMark } from "@/components/BrandMark";

type Result = { url?: string; text?: string; name?: string; size?: number; mime?: string; confidence?: number | null };

const defaults: Record<string, string> = {
  quality: "78", format: "auto", width: "1600", height: "", left: "0", top: "0", angle: "90", direction: "horizontal", language: "eng", psm: "6", scale: "2", resizeMode: "pixels", preset: "social", ratio: "free", keepAspect: "true", preventEnlargement: "true", pageSize: "a4", orientation: "portrait", margin: "small", base64Mode: "data-uri", enhance: "true"
};

const navGroups: { label: string; ids: ToolId[] }[] = [
  { label: "OPTIMIZE", ids: ["compress", "resize", "strip-metadata"] },
  { label: "TRANSFORM", ids: ["crop", "rotate", "flip"] },
  { label: "CONVERT", ids: ["convert", "image-to-pdf", "screenshot-to-pdf", "image-to-base64", "base64-to-image"] },
  { label: "AI & OCR", ids: ["remove-background", "upscale", "ocr", "screenshot-to-text"] }
];

function toolIcon(id: ToolId, size = 18) {
  if (id === "rotate") return <RotateCw size={size} />;
  if (id === "flip") return <FlipHorizontal2 size={size} />;
  if (id === "crop") return <Crop size={size} />;
  if (id === "image-to-pdf" || id === "screenshot-to-pdf") return <FileOutput size={size} />;
  if (id === "ocr" || id === "screenshot-to-text") return <ScanLine size={size} />;
  if (id === "remove-background" || id === "upscale") return <WandSparkles size={size} />;
  if (id === "strip-metadata") return <ShieldCheck size={size} />;
  if (id === "base64-to-image" || id === "image-to-base64") return <FileImage size={size} />;
  return <ImageIcon size={size} />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageWorkbench() {
  const [activeTool, setActiveTool] = useState<ToolId>("compress");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [base64, setBase64] = useState("");
  const [options, setOptions] = useState<Record<string, string>>(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tool = TOOLS.find((item) => item.id === activeTool) ?? TOOLS[0];

  const matchingIds = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return new Set(TOOLS.map((item) => item.id));
    return new Set(TOOLS.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(normalized)).map((item) => item.id));
  }, [query]);

  function setTool(id: ToolId) {
    setActiveTool(id); setError(""); setResult(null); setMobileNav(false);
    if (id === "screenshot-to-text") setOptions((current) => ({ ...current, psm: "11" }));
    if (id === "ocr") setOptions((current) => ({ ...current, psm: "6" }));
  }

  function updateOption(key: string, value: string) { setOptions((current) => ({ ...current, [key]: value })); }

  function toggleOption(key: string) { setOptions((current) => ({ ...current, [key]: current[key] === "true" ? "false" : "true" })); }

  function resetOptions() { setOptions({ ...defaults }); setError(""); setResult(null); }

  function acceptFile(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Choose a JPG, PNG, WebP, AVIF, GIF or TIFF image."); return; }
    if (next.size > 32 * 1024 * 1024) { setError("Images must be 32 MB or smaller."); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next); setBase64(""); setPreviewUrl(URL.createObjectURL(next)); setResult(null); setError("");
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
    setBusy(true); setError(""); if (result?.url) URL.revokeObjectURL(result.url); setResult(null);
    try {
      const form = new FormData(); form.append("tool", tool.id); if (file) form.append("file", file); if (base64) form.append("base64", base64);
      Object.entries(options).forEach(([key, value]) => form.append(key, value));
      const response = await fetch("/api/process", { method: "POST", body: form });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? "The image could not be processed."); }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = await response.json() as { data?: string; text?: string; bytes?: number; confidence?: number | null };
        setResult({ text: body.data ?? body.text ?? "", size: body.bytes, confidence: body.confidence, mime: contentType });
      } else {
        const blob = await response.blob();
        setResult({ url: URL.createObjectURL(blob), name: response.headers.get("content-disposition")?.match(/filename="([^"]+)/)?.[1] ?? `utilfoundry-${tool.id}`, size: blob.size, mime: contentType });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The image could not be processed."); }
    finally { setBusy(false); }
  }

  async function copy(value: string) { await navigator.clipboard.writeText(value); }

  const isImageResult = result?.mime?.startsWith("image/");
  const isAiTool = tool.category === "AI";
  const displayTitle = tool.name === "Remove Metadata" ? "Remove Image Metadata" : tool.name;

  return (
    <div className="site-shell">
      <header className="site-header"><div className="header-inner">
        <button className="mobile-menu" aria-label="Open tools menu" onClick={() => setMobileNav((current) => !current)}><Menu size={20} /></button>
        <a className="brand" href="#top" aria-label="UtilFoundry Images home"><BrandMark size={45} /><span>UtilFoundry<em>IMAGES</em></span></a>
        <nav className="primary-nav" aria-label="Primary navigation"><a href="#tools">Tools</a><a href="#templates">Templates</a><a href="#pricing">Pricing</a><a href="#docs">Docs</a><a href="#blog">Blog</a></nav>
        <label className="global-search"><Search size={18} /><input aria-label="Search image tools" placeholder="Search image tools..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
        <div className="header-actions"><button className="icon-button" aria-label="Toggle theme"><Sun size={20} /></button><span className="header-divider" /><button className="avatar-button" aria-label="Account menu"><span>A</span><ChevronDown size={15} /></button></div>
      </div></header>

      <div className="app-layout">
        <aside className={`tool-sidebar ${mobileNav ? "open" : ""}`} aria-label="Image tools navigation">
          <div className="sidebar-top"><a href="#tools" className="back-link"><ArrowLeft size={16} /> Back to all tools</a><button className="sidebar-close" aria-label="Close tools menu" onClick={() => setMobileNav(false)}>×</button></div>
          {navGroups.map((group) => {
            const visible = group.ids.map((id) => TOOLS.find((item) => item.id === id)).filter((item): item is (typeof TOOLS)[number] => Boolean(item && matchingIds.has(item.id)));
            if (!visible.length) return null;
            return <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}{group.label === "AI & OCR" && <span className="new-badge">NEW</span>}</div>{visible.map((item) => <button key={item.id} className={`nav-tool ${item.id === activeTool ? "active" : ""}`} onClick={() => setTool(item.id)}><span className="nav-tool-icon">{toolIcon(item.id, 17)}</span><span><strong>{item.name}</strong><small>{item.description.replace(" with local OCR", "").replace(" with a local model", "")}</small></span>{item.id === activeTool && <ArrowRight size={14} />}</button>)}</div>;
          })}
          <div className="feature-card"><span className="feature-icon"><Sparkles size={20} /></span><div><strong>Need a feature?</strong><small>Tell us what you need</small></div><ArrowRight size={15} /></div>
        </aside>

        <main id="top" className="main-area">
          <div className="breadcrumbs"><span>UtilFoundry</span><b>/</b><span>Images</span><b>/</b><strong>{displayTitle}</strong><span className="processing-pill"><i /> Server-local processing</span></div>
          <div className="content-grid">
            <div className="workspace-column">
              <section className="tool-heading"><div className={`tool-heading-icon ${isAiTool ? "ai" : ""}`}>{toolIcon(activeTool, 31)}</div><div><h1>{displayTitle}</h1><p>{tool.description} {tool.id === "compress" && "Keep the best balance between file size and visual quality."}</p></div></section>
              <div className="trust-row"><span><ShieldCheck size={17} /> 100% Free</span><span><LockKeyhole size={17} /> No account required</span><span><Server size={17} /> Processed locally</span><span><Leaf size={17} /> {isAiTool ? "No paid API" : "No tracking payloads"}</span></div>

              <section className="upload-card">
                {tool.needsBase64 ? <label className="base64-input"><span>Base64 image payload</span><textarea value={base64} onChange={(event) => setBase64(event.target.value)} placeholder="data:image/png;base64,..." spellCheck={false} /></label> : <button className={`upload-zone ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files?.[0]); }}><input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => acceptFile(event.target.files?.[0])} />{file ? <><FileImage size={46} /><strong>{file.name}</strong><small>{formatBytes(file.size)} · click to replace</small></> : <><UploadCloud size={49} /><strong>Drop your image here</strong><small>or click to choose a file</small><span className="choose-button"><ImageIcon size={17} /> Choose Image</span><em>Supports JPG, PNG, WebP, AVIF, GIF, TIFF <b>·</b> Max 32 MB</em></>}</button>}
                {file && previewUrl && <div className="preview-strip"><img src={previewUrl} alt="Selected image preview" /><div><strong>{file.name}</strong><small>{formatBytes(file.size)} · ready for {displayTitle.toLowerCase()}</small></div><span className="ready-status"><CheckCircle2 size={15} /> Ready</span><button aria-label="Remove selected image" onClick={(event) => { event.stopPropagation(); clearInput(); }}>×</button></div>}
              </section>

              <section className="settings-card"><div className="card-heading"><div><Settings2 size={20} /><h2>{tool.id === "compress" ? "Compression Settings" : `${displayTitle} Settings`}</h2></div><button className="reset-button" onClick={resetOptions}>↻ Reset</button></div>
                <div className="settings-grid">
                  {activeTool === "compress" && <><label className="setting-field">Output format<select value={options.format} onChange={(event) => updateOption("format", event.target.value)}><option value="auto">Auto</option><option value="jpeg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="avif">AVIF</option></select></label><label className="setting-field range-field">Compression level <output>{options.quality}%</output><input type="range" min="20" max="100" value={options.quality} onChange={(event) => updateOption("quality", event.target.value)} /><small><span>Smaller size</span><span>Balanced</span><span>Higher quality</span></small></label><button className={`check-option ${options.format === "auto" ? "checked" : ""}`} onClick={() => updateOption("format", options.format === "auto" ? "webp" : "auto")}><span>✓</span> Keep original format when possible</button></>}
                  {activeTool === "convert" && <><div className="setting-field format-picker"><span>Output format</span><div className="format-options">{[["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"], ["avif", "AVIF"]].map(([value, label]) => <button key={value} className={options.format === value ? "selected" : ""} onClick={() => updateOption("format", value)}>{label}</button>)}</div></div><label className="setting-field range-field">Quality <output>{options.quality}%</output><input type="range" min="20" max="100" value={options.quality} onChange={(event) => updateOption("quality", event.target.value)} /></label></>}
                  {activeTool === "resize" && <><div className="segmented setting-field"><button className={options.resizeMode === "pixels" ? "selected" : ""} onClick={() => updateOption("resizeMode", "pixels")}>Pixels</button><button className={options.resizeMode === "percentage" ? "selected" : ""} onClick={() => updateOption("resizeMode", "percentage")}>Percentage</button><button className={options.resizeMode === "preset" ? "selected" : ""} onClick={() => updateOption("resizeMode", "preset")}>Preset</button></div>{options.resizeMode === "percentage" ? <label className="setting-field">Scale (%)<input inputMode="numeric" value={options.percentage ?? "100"} onChange={(event) => updateOption("percentage", event.target.value)} /></label> : <><label className="setting-field">Width (px)<input inputMode="numeric" value={options.width} onChange={(event) => updateOption("width", event.target.value)} /></label><label className="setting-field">Height (px)<input inputMode="numeric" placeholder="Keep ratio" value={options.height} onChange={(event) => updateOption("height", event.target.value)} /></label></>}{options.resizeMode === "preset" && <label className="setting-field">Common preset<select value={options.preset} onChange={(event) => updateOption("preset", event.target.value)}><option value="social">Social Media 1080 × 1080</option><option value="story">Story 1080 × 1920</option><option value="thumbnail">Thumbnail 1280 × 720</option></select></label>}<button className={`check-option ${options.preventEnlargement === "true" ? "checked" : ""}`} onClick={() => toggleOption("preventEnlargement")}><span>✓</span> Prevent enlargement</button></>}
                  {activeTool === "crop" && <><label className="setting-field">Aspect ratio<select value={options.ratio} onChange={(event) => updateOption("ratio", event.target.value)}><option value="free">Free</option><option value="square">1:1 Square</option><option value="landscape">16:9 Landscape</option><option value="portrait">4:5 Portrait</option></select></label>{["left", "top", "width", "height"].map((key) => <label className="setting-field" key={key}>{key[0].toUpperCase() + key.slice(1)} (px)<input inputMode="numeric" value={options[key] ?? ""} onChange={(event) => updateOption(key, event.target.value)} /></label>)}</>}
                  {activeTool === "rotate" && <><div className="quick-actions"><button onClick={() => updateOption("angle", "270")}>↶ Rotate Left 90°</button><button onClick={() => updateOption("angle", "90")}>↷ Rotate Right 90°</button><button onClick={() => updateOption("angle", "180")}>⟳ Rotate 180°</button></div><label className="setting-field">Output format<select value={options.format} onChange={(event) => updateOption("format", event.target.value)}><option value="auto">Keep original format</option><option value="jpeg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option></select></label></>}
                  {activeTool === "flip" && <div className="quick-actions"><button className={options.direction === "horizontal" ? "selected" : ""} onClick={() => updateOption("direction", "horizontal")}>⇆ Flip Horizontal</button><button className={options.direction === "vertical" ? "selected" : ""} onClick={() => updateOption("direction", "vertical")}>⇅ Flip Vertical</button></div>}
                  {(activeTool === "ocr" || activeTool === "screenshot-to-text") && <><label className="setting-field">OCR language<select value={options.language} onChange={(event) => updateOption("language", event.target.value)}><option value="eng">Auto-detect / English</option><option value="deu">German</option><option value="fra">French</option><option value="hin">Hindi</option><option value="spa">Spanish</option></select></label><label className="setting-field">Layout mode<select value={options.psm} onChange={(event) => updateOption("psm", event.target.value)}><option value="6">Standard block</option><option value="11">Sparse / screenshot</option></select></label><button className={`check-option ${options.enhance === "true" ? "checked" : ""}`} onClick={() => toggleOption("enhance")}><span>✓</span> Enhance image for better accuracy</button></>}
                  {activeTool === "upscale" && <><div className="segmented setting-field"><button className="selected">2×</button><button disabled>4×</button><button disabled>8×</button></div><button className={`check-option ${options.enhance === "true" ? "checked" : ""}`} onClick={() => toggleOption("enhance")}><span>✓</span> Enhance details</button></>}
                  {activeTool === "image-to-pdf" && <><label className="setting-field">Page size<select value={options.pageSize} onChange={(event) => updateOption("pageSize", event.target.value)}><option value="a4">A4</option><option value="letter">Letter</option><option value="original">Original image</option></select></label><label className="setting-field">Orientation<select value={options.orientation} onChange={(event) => updateOption("orientation", event.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label className="setting-field">Margin<select value={options.margin} onChange={(event) => updateOption("margin", event.target.value)}><option value="small">Small</option><option value="none">None</option></select></label></>}
                  {activeTool === "screenshot-to-pdf" && <><label className="setting-field">Capture option<select value={options.pageSize} onChange={(event) => updateOption("pageSize", event.target.value)}><option value="full">Uploaded screenshot</option><option value="original">Original dimensions</option></select></label><button className={`check-option ${options.enhance === "true" ? "checked" : ""}`} onClick={() => toggleOption("enhance")}><span>✓</span> Include cursor / annotations</button></>}
                  {activeTool === "strip-metadata" && <div className="check-list"><strong>Metadata that will be removed</strong><span>✓ EXIF data (camera info)</span><span>✓ GPS location data</span><span>✓ Device information</span><span>✓ Software information</span></div>}
                  {activeTool === "remove-background" && <div className="setting-note"><ShieldCheck size={18} /><span>A local U²-Net model creates a transparent PNG cutout.</span></div>}
                  {activeTool === "image-to-base64" && <label className="setting-field">Output mode<select value={options.base64Mode} onChange={(event) => updateOption("base64Mode", event.target.value)}><option value="data-uri">Data URI</option><option value="raw">Raw Base64</option></select></label>}
                  {activeTool === "base64-to-image" && <div className="setting-note"><ShieldCheck size={18} /><span>Decode a data URI or raw Base64 payload into a PNG preview.</span></div>}
                  {activeTool === "upscale" && <div className="setting-note"><ShieldCheck size={18} /><span>A local FSRCNN model produces a 2× PNG with no paid API.</span></div>}
                </div>
                {error && <div className="error-banner" role="alert">{error}</div>}
                <button className="run-button" onClick={run} disabled={busy}>{busy ? <><Gauge size={18} className="spin" /> Processing…</> : <><Sparkles size={18} /> {displayTitle === "Image Compressor" ? "Compress Images" : `Run ${displayTitle}`} <ArrowRight size={18} /></>}</button>
              </section>

              {result && <section className="result-card"><div className="card-heading"><div><span className="section-kicker">OUTPUT</span><h2>Ready to use</h2></div><span className="result-size">{result.size ? formatBytes(result.size) : ""}</span></div>{result.text !== undefined ? <div className="text-result">{result.confidence !== undefined && result.confidence !== null && <div className="confidence">Average OCR confidence: {result.confidence}%</div>}<textarea readOnly value={result.text} /><div className="result-actions"><button onClick={() => copy(result.text ?? "")}><Copy size={15} /> Copy</button><a className="download-button" href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text ?? "")}`} download={`${activeTool}.txt`}><Download size={15} /> Download TXT</a></div></div> : <div className="result-content">{isImageResult && result.url ? <img src={result.url} alt="Processed image preview" /> : <div className="pdf-result"><FileOutput size={32} /><span><strong>PDF generated</strong><small>{result.name}</small></span></div>}<a className="download-button" href={result.url} download={result.name}><Download size={16} /> Download output</a></div>}</section>}
            </div>

            <aside className="insights-column" aria-label="Tool information">
              <section className="info-card"><h2>Why use this tool?</h2><div className="benefit"><span className="benefit-icon green"><ShieldCheck size={21} /></span><div><strong>100% Free</strong><small>No account required</small></div></div><div className="benefit"><span className="benefit-icon blue"><LockKeyhole size={21} /></span><div><strong>Your files stay private</strong><small>Processed securely and not stored</small></div></div><div className="benefit"><span className="benefit-icon purple"><Zap size={21} /></span><div><strong>Fast & reliable</strong><small>Get results in seconds</small></div></div><div className="benefit"><span className="benefit-icon orange"><Leaf size={21} /></span><div><strong>{isAiTool ? "No paid API" : "No tracking payloads"}</strong><small>{isAiTool ? "Open-source local model" : "Simple, transparent processing"}</small></div></div></section>
              <section className="info-card formats-card"><div className="side-card-title"><h2>Supported formats</h2><a href="#formats">View all</a></div><div className="format-grid"><span><b className="fmt orange">J</b>JPG</span><span><b className="fmt blue">P</b>PNG</span><span><b className="fmt green">W</b>WebP</span><span><b className="fmt purple">A</b>AVIF</span><span><b className="fmt gray">G</b>GIF</span><span><b className="fmt gray">T</b>TIFF</span></div></section>
              <section className="info-card tips-card"><h2><Sparkles size={20} /> Tips for best results</h2><ul><li>For photos, 60–80% gives a strong quality/size balance.</li><li>Use WebP for smaller sizes on modern websites.</li><li>Keep PNG when transparency matters.</li><li>No watermark is added to your output.</li></ul></section>
              <section className="feedback-card"><span><MoreHorizontal size={22} /></span><div><strong>Have feedback?</strong><small>Help us build better tools</small></div><ArrowRight size={17} /></section>
            </aside>
          </div>
          <footer className="site-footer"><span>© 2026 UtilFoundry. All rights reserved.</span><nav><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#blog">Blog</a><a href="#docs">Docs</a><a href="#contact">Contact</a><span className="footer-social">◎</span><span className="footer-social">in</span><span className="footer-social">𝕏</span></nav></footer>
        </main>
      </div>
    </div>
  );
}
