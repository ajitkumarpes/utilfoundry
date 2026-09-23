"use client";
/* QR data URLs are generated locally and intentionally rendered as a native image. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight, Copy, Download, FileText, FolderOpen, ImagePlus, Maximize2, Minimize2, Save, ShieldCheck,
  Trash2, Upload
} from "lucide-react";
import { StepCard } from "@/components/ui/StepCard";
import { CodeEditor, type CodeEditorHandle } from "@/components/ui/CodeEditor";
import { OptionsBar, type MenuItem } from "@/components/ui/OptionsBar";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { ToolRail, type QuickAction } from "@/components/ui/ToolRail";
import { ToolCrumbs, ToolHero } from "@/components/ui/PageHeader";
import { Toast, useToast } from "@/components/ui/Toast";
import { detectSensitiveInput, maxInputLength, runTool } from "@/lib/run-tool";
import { STARTERS, defaultOption } from "@/lib/samples";
import { explainJsonError, locateJsonError } from "@/lib/json-error";
import { byteLength, summarizeResult } from "@/lib/result-summary";
import type { RunResult } from "@/lib/run-result";
import {
  downloadExtension, inputLanguage, inputSubtitle, optionsFor, outputLanguage, outputSubtitle, reverseChoice,
  type OptionField
} from "@/lib/tool-options";
import type { ToolDefinition } from "@/lib/tools";

/**
 * Tools whose whole input is one JSON document, so a JSON.parse failure's position lands
 * in the input box and can drive "jump to error". The two-document tools (json-diff,
 * json-schema, openapi-diff) parse half of the input each, where the same offset would
 * point at the wrong place, so they are deliberately left out.
 */
const JSON_ERROR_LOCATABLE = new Set([
  "json", "json-validator", "json-minifier", "jsonpath", "json-schema-generator", "webhook", "curl", "api-request"
]);

const DEFAULT_PATTERN = "\\b[A-Z][a-z]+\\b";
const DEFAULT_FLAGS = "g";
const DEFAULT_SECRET = "change-me-locally";

/**
 * Reads a field's current value so React can start from it instead of from the shipped default.
 *
 * Every tool page is prerendered, so the example text and the default option are on screen and
 * editable well before this island hydrates. React seeds its state on that first client render
 * and then writes the seed back over the DOM, so a paste or a mode change made in the gap would
 * be discarded without a trace. Measured in WebKit against a slow server: text typed into the
 * input before hydration was replaced by the shipped example, and the tool then ran on it.
 *
 * Ids and radio names are per tool, so a client-side move to another tool cannot adopt the
 * outgoing page's value.
 */
function seedFromField(id: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const field = document.getElementById(id);
  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    return field.value;
  }
  const checked = document.querySelector<HTMLInputElement>(`input[type="radio"][name="${id}"]:checked`);
  return checked ? checked.value : fallback;
}

function errorTitle(toolId: string, error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (toolId === "regex" || toolId === "regex-safe" || toolId === "regex-visualizer") return "Invalid pattern";
  if (name === "SyntaxError" && /JSON/.test(message)) return "Invalid JSON";
  if (name === "YAMLException") return "Invalid YAML";
  if (name === "GraphQLError") return "Invalid GraphQL";
  return "Couldn't process that";
}

export function Workbench({ tool }: { tool: ToolDefinition }) {
  const fieldId = (name: string) => `wb-${tool.id}-${name}`;
  const [input, setInput] = useState(() => seedFromField(fieldId("input"), STARTERS[tool.id] ?? ""));
  const [option, setOption] = useState(() => seedFromField(fieldId("option"), defaultOption(tool.id)));
  const [pattern, setPattern] = useState(() => seedFromField(fieldId("pattern"), DEFAULT_PATTERN));
  const [flags, setFlags] = useState(() => seedFromField(fieldId("flags"), DEFAULT_FLAGS));
  const [secret, setSecret] = useState(() => seedFromField(fieldId("secret"), DEFAULT_SECRET));
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [securityWarning, setSecurityWarning] = useState("");
  const inputRef = useRef<CodeEditorHandle>(null);
  const workspaceFileRef = useRef<HTMLInputElement>(null);
  const textFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // A generator ignores the input box, and a control that does nothing is worse than none.
  const needsInput = tool.inputLabel !== "Not needed";
  const isImageTool = tool.id === "image-base64";

  function clearResult() {
    setOutput("");
    setResult(null);
    setBannerHidden(false);
  }

  async function run(overrides: { input?: string; option?: string } = {}) {
    const runInput = overrides.input ?? input;
    const runOption = overrides.option ?? option;
    const findings = detectSensitiveInput(runInput);
    setSecurityWarning(
      findings.length
        ? `Potentially sensitive ${findings.join(", ")} detected. Use masked test data only and clear this page when finished.`
        : ""
    );
    setBusy(true);
    setBannerHidden(false);
    const started = performance.now();
    try {
      const produced = await runTool(tool.id, { input: runInput, option: runOption, pattern, flags, secret });
      const elapsedMs = performance.now() - started;
      setOutput(produced);
      setResult({
        status: "success",
        ...summarizeResult(tool.id, runOption, produced, elapsedMs),
        elapsedMs,
        inputBytes: byteLength(runInput),
        option: runOption
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process input.";
      const locatable = error instanceof SyntaxError && /JSON/.test(message) && JSON_ERROR_LOCATABLE.has(tool.id);
      const explained = locatable ? explainJsonError(runInput) : null;
      setOutput("");
      setResult({
        status: "error",
        title: errorTitle(tool.id, error),
        message: explained ?? message,
        detail: explained ? message : undefined,
        location: locatable ? locateJsonError(runInput) : null
      });
    } finally {
      setBusy(false);
    }
  }

  // Cmd/Ctrl+Enter runs the tool from anywhere on the page, matching the hint on the button.
  // A ref keeps the one listener calling the latest `run` without resubscribing per keystroke.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void runRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const optionIsChoice = optionsFor(tool.id)?.controls.some(
    (control) => control.field === "option" && control.kind !== "text"
  ) ?? false;

  function setField(field: OptionField, value: string) {
    if (field === "option") {
      setOption(value);
      // A choice between modes is a question about the same input, so once there is an
      // answer on screen, picking another mode answers again rather than leaving it stale.
      if (result && optionIsChoice) void run({ option: value });
    }
    if (field === "pattern") setPattern(value);
    if (field === "flags") setFlags(value);
    if (field === "secret") setSecret(value);
  }

  async function copyText(text: string, what: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${what} copied to clipboard`);
    } catch {
      toast.show("Clipboard unavailable — select the text and copy it manually", "info");
    }
  }

  function downloadOutput() {
    if (!output) return;
    const language = outputLanguage(tool.id, result?.status === "success" ? result.option : option, output);
    const isImage = output.startsWith("data:image/");
    const link = document.createElement("a");
    const objectUrl = isImage ? undefined : URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
    link.href = isImage ? output : (objectUrl ?? "");
    link.download = `${tool.slug}-output.${downloadExtension(language)}`;
    link.click();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    toast.show("Download started");
  }

  function loadExample() {
    setInput(STARTERS[tool.id] ?? "");
    clearResult();
    toast.show("Example loaded", "info");
  }

  function clearInput() {
    setInput("");
    clearResult();
    setSecurityWarning("");
  }

  function reset() {
    setOption(defaultOption(tool.id));
    setPattern(DEFAULT_PATTERN);
    setFlags(DEFAULT_FLAGS);
    setSecret(DEFAULT_SECRET);
    clearResult();
    toast.show("Options reset", "info");
  }

  function loadTextFile(file: File | undefined) {
    if (!file) return;
    if (isImageTool) return loadImageFile(file);
    if (file.size > maxInputLength(tool.id)) {
      toast.show("That file is too large. Keep it under 2 MB so the tab stays responsive.", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInput(typeof reader.result === "string" ? reader.result : "");
      clearResult();
      toast.show(`Loaded ${file.name}`);
    };
    reader.onerror = () => toast.show("That file could not be read", "info");
    reader.readAsText(file);
  }

  function loadImageFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.show("Choose an image file", "info");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.show("Images are limited to 10 MB", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInput(typeof reader.result === "string" ? reader.result : "");
      clearResult();
      toast.show(`Loaded ${file.name}`);
    };
    reader.onerror = () => toast.show("That image could not be read", "info");
    reader.readAsDataURL(file);
  }

  function workspaceSnapshot() {
    return JSON.stringify({ version: 1, tool: tool.id, input, option, pattern, flags, exportedAt: new Date().toISOString() }, null, 2);
  }

  function saveWorkspace() {
    try {
      localStorage.setItem("utilfoundry-dev-workspace", workspaceSnapshot());
      toast.show("Workspace saved in this browser");
    } catch {
      toast.show("This browser is not letting the page save anything", "info");
    }
  }

  function exportWorkspace() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([workspaceSnapshot()], { type: "application/json" }));
    link.download = "utilfoundry-workspace.json";
    link.click();
    URL.revokeObjectURL(link.href);
    toast.show("Workspace exported");
  }

  /** Only the fields of the saved bench are restored; the tool itself is the page you are on. */
  function importWorkspace(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const saved = JSON.parse(String(reader.result)) as Record<string, unknown>;
        if (typeof saved.input === "string") setInput(saved.input);
        if (typeof saved.option === "string") setOption(saved.option);
        if (typeof saved.pattern === "string") setPattern(saved.pattern);
        if (typeof saved.flags === "string") setFlags(saved.flags);
        clearResult();
        toast.show(saved.tool && saved.tool !== tool.id
          ? `Fields restored from a ${String(saved.tool)} workspace`
          : "Workspace imported");
      } catch {
        toast.show("That workspace file is not valid JSON", "info");
      }
    };
    reader.readAsText(file);
  }

  const menu: MenuItem[] = [
    ...(needsInput && !isImageTool
      ? [{ label: "Open a file…", icon: <FolderOpen size={16} />, onSelect: () => textFileRef.current?.click() }]
      : []),
    { label: "Save workspace", icon: <Save size={16} />, onSelect: saveWorkspace },
    { label: "Export workspace", icon: <Download size={16} />, onSelect: exportWorkspace },
    { label: "Import workspace…", icon: <Upload size={16} />, onSelect: () => workspaceFileRef.current?.click() }
  ];

  const lastOption = result?.status === "success" ? result.option : option;
  const quickActions: QuickAction[] = [];
  if (result?.status === "success") {
    if (tool.id === "json") {
      const target = lastOption === "minify" ? "pretty" : "minify";
      quickActions.push({
        label: target === "minify" ? "Minify this JSON" : "Pretty print this JSON",
        icon: target === "minify" ? <Minimize2 size={16} /> : <Maximize2 size={16} />,
        onSelect: () => {
          setOption(target);
          void run({ option: target });
        }
      });
    }
    const reverse = reverseChoice(tool.id, lastOption);
    if (reverse) {
      quickActions.push({
        label: `Reverse: ${reverse.label}`,
        icon: <ArrowLeftRight size={16} />,
        onSelect: () => {
          const nextInput = output;
          setInput(nextInput);
          setOption(reverse.value);
          void run({ input: nextInput, option: reverse.value });
        }
      });
    }
  }

  const errorLine = result?.status === "error" ? result.location?.line : undefined;
  const outputIsPreview = tool.id === "markdown" && Boolean(output);
  const outputIsImage = tool.id === "qr" && output.startsWith("data:image/");

  return (
    <>
      <ToolCrumbs tool={tool} notify={toast.show} />

      <div className="tool-layout">
        <div className="tool-main">
          <ToolHero tool={tool} />

          {tool.category === "Payments" && (
            <div className="security-note">
              <ShieldCheck size={15} aria-hidden />
              <span>Use masked test data only. PANs, Track 2, PIN blocks and production keys must never be pasted here.</span>
            </div>
          )}
          {securityWarning && (
            <div className="security-warning" role="alert">
              <ShieldCheck size={15} aria-hidden />
              <span>{securityWarning}</span>
            </div>
          )}

          <div className="workspace-main">
            <div className="workbench-grid">
              <StepCard
                step={1}
                title="Input"
                subtitle={needsInput ? inputSubtitle(tool.inputLabel) : "This generator takes no input."}
                actions={needsInput ? (
                  <>
                    {isImageTool ? (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => imageFileRef.current?.click()}>
                        <ImagePlus size={16} /> Choose image
                      </button>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={loadExample}>
                        <FileText size={16} /> Example
                      </button>
                    )}
                    <button type="button" className="btn btn-outline btn-sm btn-danger-icon" onClick={clearInput}>
                      <Trash2 size={16} /> Clear
                    </button>
                  </>
                ) : undefined}
              >
                {needsInput ? (
                  <>
                    {tool.inputHint && <p className="input-hint">{tool.inputHint}</p>}
                    <CodeEditor
                      ref={inputRef}
                      id={fieldId("input")}
                      value={input}
                      onChange={setInput}
                      ariaLabel={`${tool.name} input`}
                      placeholder={isImageTool ? "Choose or drop an image, or paste a data URL." : `Paste your ${tool.inputLabel.toLowerCase()} here, or drop a file.`}
                      language={inputLanguage(tool.id, option)}
                      errorLine={errorLine}
                      onCopy={() => void copyText(input, "Input")}
                      onDropFile={loadTextFile}
                    />
                  </>
                ) : (
                  <p className="pane-empty">Nothing to paste: press <b>Run tool</b> for a fresh value, as often as you like.</p>
                )}
              </StepCard>

              <StepCard
                step={2}
                title="Output"
                subtitle={outputSubtitle(tool.id, lastOption)}
                actions={
                  <>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyText(output, "Output")} disabled={!output}>
                      <Copy size={16} /> Copy
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={downloadOutput} disabled={!output}>
                      <Download size={16} /> Download
                    </button>
                  </>
                }
              >
                {outputIsPreview ? (
                  <div className="preview has-output" aria-label={`${tool.name} output`} dangerouslySetInnerHTML={{ __html: output }} />
                ) : outputIsImage ? (
                  <div className="image-preview has-output"><img src={output} alt="Generated QR code" /></div>
                ) : (
                  <CodeEditor
                    value={output}
                    readOnly
                    ariaLabel={`${tool.name} output`}
                    className={output ? "has-output" : undefined}
                    placeholder={result?.status === "error" ? "No output — see the message below." : "Run the tool to see the result here."}
                    language={output ? outputLanguage(tool.id, lastOption, output) : inputLanguage(tool.id, option) === "JSON" ? "JSON" : "Text"}
                    onCopy={output ? () => void copyText(output, "Output") : undefined}
                  />
                )}
              </StepCard>
            </div>

            <OptionsBar
              toolId={tool.id}
              values={{ option, pattern, flags, secret }}
              onChange={setField}
              onRun={() => void run()}
              onReset={reset}
              busy={busy}
              menu={menu}
            />

            {!bannerHidden && (
              <ResultBanner
                toolId={tool.id}
                toolName={tool.name}
                result={result}
                output={output}
                busy={busy}
                onDismiss={() => setBannerHidden(true)}
                onJumpToError={() => result?.status === "error" && result.location && inputRef.current?.jumpTo(result.location.offset)}
              />
            )}
          </div>
        </div>

        <ToolRail
          tool={tool}
          option={lastOption}
          result={result}
          output={output}
          onCopy={() => void copyText(output, "Output")}
          onDownload={downloadOutput}
          onJumpToError={() => result?.status === "error" && result.location && inputRef.current?.jumpTo(result.location.offset)}
          quickActions={quickActions}
        />
      </div>

      <input ref={textFileRef} type="file" hidden onChange={(event) => { loadTextFile(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={imageFileRef} type="file" accept="image/*" hidden onChange={(event) => { loadImageFile(event.target.files?.[0]); event.target.value = ""; }} />
      <input
        ref={workspaceFileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => { importWorkspace(event.target.files?.[0]); event.target.value = ""; }}
      />
      <Toast message={toast.message} />
    </>
  );
}
