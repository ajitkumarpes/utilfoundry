"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Leaf, LockKeyhole, Server, ShieldCheck } from "lucide-react";
import { TOOLS, type ToolId } from "@/lib/tools";
import { AppShell } from "@/components/image-tools/AppShell";
import { InfoRail } from "@/components/image-tools/InfoRail";
import { ResultCard } from "@/components/image-tools/ResultCard";
import { SettingsCard } from "@/components/image-tools/SettingsCard";
import { ToolIcon } from "@/components/image-tools/ToolIcon";
import { UploadCard } from "@/components/image-tools/UploadCard";
import type { ProcessResult, ToolOptions } from "@/components/image-tools/types";

const defaults: ToolOptions = {
  quality: "78", format: "auto", width: "1600", height: "", left: "0", top: "0", angle: "90", direction: "horizontal", language: "eng", psm: "6", scale: "2", resizeMode: "pixels", preset: "social", ratio: "free", keepAspect: "true", preventEnlargement: "true", pageSize: "a4", orientation: "portrait", margin: "small", base64Mode: "data-uri", enhance: "true"
};

function resultFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  if (utf8) {
    try { return decodeURIComponent(utf8); } catch { /* Fall back to the ASCII filename. */ }
  }
  return plain || fallback;
}

export function ImageWorkbench() {
  const [activeTool, setActiveTool] = useState<ToolId>("compress");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [base64, setBase64] = useState("");
  const [options, setOptions] = useState<ToolOptions>(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem("utilfoundry-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tool = TOOLS.find((item) => item.id === activeTool) ?? TOOLS[0];

  const matchingIds = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return new Set(TOOLS.map((item) => item.id));
    return new Set(TOOLS.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(normalized)).map((item) => item.id));
  }, [query]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (result?.url) URL.revokeObjectURL(result.url);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [previewUrl, result?.url]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem("utilfoundry-theme", nextTheme); } catch { /* Storage is optional. */ }
  }

  function setTool(id: ToolId) {
    setActiveTool(id);
    setError("");
    setResult(null);
    setCopied(false);
    setMobileNav(false);
    if (id === "screenshot-to-text") setOptions((current) => ({ ...current, psm: "11" }));
    if (id === "ocr") setOptions((current) => ({ ...current, psm: "6" }));
  }

  function updateOption(key: string, value: string) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function toggleOption(key: string) {
    setOptions((current) => ({ ...current, [key]: current[key] === "true" ? "false" : "true" }));
  }

  function resetOptions() {
    setOptions({ ...defaults, ...(activeTool === "screenshot-to-text" ? { psm: "11" } : {}) });
    setError("");
    setResult(null);
  }

  function acceptFile(next: File | undefined) {
    if (!next) return;
    const supported = next.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|gif|tiff?)$/i.test(next.name);
    if (!supported) { setError("Choose a JPG, PNG, WebP, AVIF, GIF or TIFF image."); return; }
    if (next.size > 32 * 1024 * 1024) { setError("Images must be 32 MB or smaller."); return; }
    setFile(next);
    setBase64("");
    setPreviewUrl(URL.createObjectURL(next));
    setResult(null);
    setError("");
  }

  function clearInput() {
    setFile(null);
    setPreviewUrl("");
    setBase64("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function run() {
    if (tool.needsFile && !file) { setError("Choose an image before running this tool."); return; }
    if (tool.needsBase64 && !base64.trim()) { setError("Paste a Base64 image payload before running this tool."); return; }
    setBusy(true);
    setError("");
    setCopied(false);
    setResult(null);
    try {
      const form = new FormData();
      form.append("tool", tool.id);
      if (file) form.append("file", file);
      if (base64) form.append("base64", base64);
      Object.entries(options).forEach(([key, value]) => form.append(key, value));
      const response = await fetch("/api/process", { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "The image could not be processed.");
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = await response.json() as { data?: string; text?: string; bytes?: number; confidence?: number | null };
        setResult({ text: body.data ?? body.text ?? "", size: body.bytes, confidence: body.confidence, mime: contentType });
      } else {
        const blob = await response.blob();
        setResult({ url: URL.createObjectURL(blob), name: resultFilename(response, `utilfoundry-${tool.id}`), size: blob.size, mime: contentType });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be processed.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy is unavailable in this browser. Select the output text and copy it manually.");
    }
  }

  const isAiTool = tool.category === "AI";
  const displayTitle = tool.name === "Remove Metadata" ? "Remove Image Metadata" : tool.name;

  return (
    <AppShell query={query} onQueryChange={setQuery} theme={theme} onToggleTheme={toggleTheme} activeTool={activeTool} matchingIds={matchingIds} mobileNav={mobileNav} onOpenMenu={() => setMobileNav((current) => !current)} onCloseMenu={() => setMobileNav(false)} onSelectTool={setTool}>
      <div className="breadcrumbs"><span>UtilFoundry</span><b>/</b><span>Images</span><b>/</b><strong>{displayTitle}</strong><span className="processing-pill"><i /> Server-local processing</span></div>
      <div className="content-grid">
        <div className="workspace-column">
          <section className="tool-heading"><div className={`tool-heading-icon ${isAiTool ? "ai" : ""}`}><ToolIcon id={activeTool} size={31} /></div><div><h1>{displayTitle}</h1><p>{tool.description} {tool.id === "compress" && "Keep the best balance between file size and visual quality."}</p></div></section>
          <div className="trust-row"><span><ShieldCheck size={17} /> 100% Free</span><span><LockKeyhole size={17} /> No account required</span><span><Server size={17} /> Processed locally</span><span><Leaf size={17} /> {isAiTool ? "No paid API" : "No tracking payloads"}</span></div>
          <UploadCard tool={tool} file={file} base64={base64} previewUrl={previewUrl} inputRef={inputRef} onBase64Change={setBase64} onFile={acceptFile} onClear={clearInput} title={displayTitle} />
          <SettingsCard activeTool={activeTool} tool={tool} options={options} error={error} busy={busy} title={displayTitle} onOption={updateOption} onToggle={toggleOption} onReset={resetOptions} onRun={run} />
          {result && <ResultCard result={result} activeTool={activeTool} onCopy={copy} />}
        </div>
        <InfoRail isAiTool={isAiTool} />
      </div>
      <footer className="site-footer"><span>© 2026 UtilFoundry. All rights reserved.</span><nav><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#blog">Blog</a><a href="#docs">Docs</a><a href="#contact">Contact</a><span className="footer-social">◎</span><span className="footer-social">in</span><span className="footer-social">𝕏</span></nav></footer>
      <span className="sr-only" aria-live="polite">{copied ? "Output copied" : ""}</span>
    </AppShell>
  );
}
