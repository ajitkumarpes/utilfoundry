"use client";
/* QR and image data URLs are generated or read locally and intentionally rendered as native images. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight, Copy, Download, FileText, FolderOpen, ImagePlus, Maximize2, Minimize2, RefreshCw, Save, ShieldCheck,
  Trash2, Upload
} from "lucide-react";
import { StepCard } from "@/components/ui/StepCard";
import { CodeEditor, type CodeEditorHandle } from "@/components/ui/CodeEditor";
import { JsonTree } from "@/components/ui/JsonTree";
import { ToolToolbar, type MenuItem } from "@/components/ui/ToolToolbar";
import { ActionBar } from "@/components/ui/ActionBar";
import { ToolRail, type QuickAction } from "@/components/ui/ToolRail";
import { ToolCrumbs, ToolHero } from "@/components/ui/PageHeader";
import { Toast, useToast } from "@/components/ui/Toast";
import { detectSensitiveInput, maxInputLength, runTool } from "@/lib/run-tool";
import { STARTERS, defaultOption } from "@/lib/samples";
import { explainJsonError, locateJsonError } from "@/lib/json-error";
import { byteLength, formatBytes, summarizeResult } from "@/lib/result-summary";
import { insightsFor } from "@/lib/result-insights";
import type { RunResult } from "@/lib/run-result";
import { joinDocuments, splitDocuments, splitInputFor } from "@/lib/split-input";
import {
  downloadExtension, inputLanguage, inputSubtitle, optionsFor, outputLanguage, outputNoun, outputSubtitle, outputViews,
  reverseChoice, type OptionField, type OutputView
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

const VIEW_LABELS: Record<OutputView, string> = { code: "Code", tree: "Tree", preview: "Preview" };

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

/** The two-document tools have one field per half; both are read back and joined. */
function seedSplitInput(id: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const first = document.getElementById(id);
  const second = document.getElementById(`${id}-2`);
  if (first instanceof HTMLTextAreaElement && second instanceof HTMLTextAreaElement) {
    return joinDocuments(first.value, second.value);
  }
  return fallback;
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

function ViewSwitch({ views, value, onChange }: { views: OutputView[]; value: OutputView; onChange: (view: OutputView) => void }) {
  return (
    <div className="view-switch" role="group" aria-label="Show the output as">
      {views.map((view) => (
        <button key={view} type="button" aria-pressed={value === view} onClick={() => onChange(view)}>
          {VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}

function ExpandButton({ expanded, label, onToggle }: { expanded: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="pane-tool"
      onClick={onToggle}
      aria-label={expanded ? "Exit full screen" : `Open ${label} full screen`}
      title={expanded ? "Exit full screen (Esc)" : "Full screen"}
    >
      {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    </button>
  );
}

/** The strip along the top of a view that is not an editor, matching the editor's own. */
function PaneTop({ left, right }: { left?: ReactNode; right: string }) {
  return (
    <div className="editor-top">
      <div className="editor-top-left">{left}</div>
      <span className="editor-lang">{right}</span>
    </div>
  );
}

/** A pane footer for views that are not an editor, so every pane ends the same way. */
function PaneFooter({ label, bytes, action }: { label: string; bytes: number; action?: ReactNode }) {
  return (
    <div className="editor-status pane-footer">
      <span>{label}</span>
      <span className="editor-status-size">{formatBytes(bytes)}</span>
      {action}
    </div>
  );
}

export function Workbench({ tool }: { tool: ToolDefinition }) {
  const fieldId = (name: string) => `wb-${tool.id}-${name}`;
  const split = splitInputFor(tool.id);
  const [input, setInput] = useState(() =>
    split
      ? seedSplitInput(fieldId("input"), STARTERS[tool.id] ?? "")
      : seedFromField(fieldId("input"), STARTERS[tool.id] ?? ""));
  const [option, setOption] = useState(() => seedFromField(fieldId("option"), defaultOption(tool.id)));
  const [pattern, setPattern] = useState(() => seedFromField(fieldId("pattern"), DEFAULT_PATTERN));
  const [flags, setFlags] = useState(() => seedFromField(fieldId("flags"), DEFAULT_FLAGS));
  const [secret, setSecret] = useState(() => seedFromField(fieldId("secret"), DEFAULT_SECRET));
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [securityWarning, setSecurityWarning] = useState("");
  const [preferredView, setPreferredView] = useState<OutputView | null>(null);
  const [expanded, setExpanded] = useState<"input" | "output" | null>(null);
  const inputRef = useRef<CodeEditorHandle>(null);
  const workspaceFileRef = useRef<HTMLInputElement>(null);
  const textFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // A generator ignores the input box, and a control that does nothing is worse than none.
  const needsInput = tool.inputLabel !== "Not needed";
  const isImageTool = tool.id === "image-base64";
  const collapse = useCallback(() => setExpanded(null), []);

  function clearResult() {
    setOutput("");
    setResult(null);
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
    if (split) {
      const [first, second] = splitDocuments(runInput);
      const missing = !first.trim() ? split.first : !second.trim() ? split.second : null;
      if (missing) {
        setOutput("");
        setResult({
          status: "error",
          title: "Two documents needed",
          message: `The ${missing} editor is empty. This tool compares the two, so both need something in them.`,
          location: null
        });
        return;
      }
    }
    setBusy(true);
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

  // A generator has nothing to wait for, so it opens with a value already made.
  useEffect(() => {
    if (!needsInput) void runRef.current();
  }, [needsInput]);

  const optionIsChoice = optionsFor(tool.id)?.controls.some(
    (control) => control.field === "option" && control.kind !== "text"
  ) ?? false;

  function setField(field: OptionField, value: string) {
    if (field === "option") {
      setOption(value);
      // A choice between modes is a question about the same input, so once there is an
      // answer on screen, picking another mode answers again rather than leaving it stale.
      // A generator's setting (a password's length) is the whole question, so it answers too.
      if ((result && optionIsChoice) || !needsInput) void run({ option: value });
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

  /**
   * The share sheet where the device has one (phones, and Safari and Chrome on a Mac); the
   * clipboard otherwise. Either way the text goes only where the visitor sends it.
   */
  async function shareOutput() {
    if (!output) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${tool.name} result`, text: output });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyText(output, "Result");
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

  function loadTextFile(file: File | undefined, half?: 0 | 1) {
    if (!file) return;
    if (isImageTool) return loadImageFile(file);
    if (file.size > maxInputLength(tool.id)) {
      toast.show("That file is too large. Keep it under 2 MB so the tab stays responsive.", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (split && half !== undefined) {
        setInput((current) => {
          const [first, second] = splitDocuments(current);
          return half === 0 ? joinDocuments(text, second) : joinDocuments(first, text);
        });
      } else {
        setInput(text);
      }
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

  const insights = useMemo(
    () => (result?.status === "success" ? insightsFor(tool.id, result.option, input, output) : []),
    // Recomputed per run, not per keystroke in the input after it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, output, tool.id]
  );

  const errorLine = result?.status === "error" ? result.location?.line : undefined;
  const outputIsImage = output.startsWith("data:image/");
  const isQr = tool.id === "qr" && outputIsImage;
  const views = outputViews(tool.id, output);
  const view: OutputView = views.length ? (preferredView && views.includes(preferredView) ? preferredView : views[0]) : "code";
  const parsedOutput = useMemo(() => {
    if (view !== "tree") return undefined;
    try {
      return JSON.parse(output) as unknown;
    } catch {
      return undefined;
    }
  }, [view, output]);
  const outLanguage = output ? outputLanguage(tool.id, lastOption, output) : inputLanguage(tool.id, option) === "JSON" ? "JSON" : "Text";
  const [firstDoc, secondDoc] = split ? splitDocuments(input) : ["", ""];
  const jumpToError = () => result?.status === "error" && result.location && inputRef.current?.jumpTo(result.location.offset);

  const inputActions = needsInput ? (
    <>
      {isImageTool ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => imageFileRef.current?.click()}>
          <ImagePlus size={16} /> Choose image
        </button>
      ) : !split && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => textFileRef.current?.click()}>
          <FolderOpen size={16} /> Load file
        </button>
      )}
      <button type="button" className="btn btn-outline btn-sm btn-danger-icon" onClick={clearInput}>
        <Trash2 size={16} /> Clear
      </button>
    </>
  ) : null;

  const inputCard = needsInput ? (
    <StepCard
      step={1}
      title="Input"
      subtitle={split ? `Paste the ${split.first.toLowerCase()} and the ${split.second.toLowerCase()}, then click “Run tool”.` : inputSubtitle(tool.inputLabel)}
      actions={inputActions}
      expanded={expanded === "input"}
      onCollapse={collapse}
      className="is-input"
    >
      {tool.inputHint && !split && <p className="input-hint">{tool.inputHint}</p>}
      {isImageTool && input.startsWith("data:image/") && (
        <div className="image-input-preview">
          <img src={input} alt="The image being inspected" />
          <span>{input.slice(5, input.indexOf(";")) || "image"} · {formatBytes(byteLength(input))} as text</span>
        </div>
      )}
      {split ? (
        <div className="split-editors">
          {([0, 1] as const).map((half) => (
            <div className="split-editor" key={half}>
              <div className="split-editor-head">
                <span className="split-tag" aria-hidden>{half === 0 ? "A" : "B"}</span>
                <span>{half === 0 ? split.first : split.second}</span>
                <label className="split-load">
                  <FolderOpen size={14} aria-hidden /> Load file
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(event) => { loadTextFile(event.target.files?.[0], half); event.target.value = ""; }}
                  />
                </label>
              </div>
              <CodeEditor
                ref={half === 0 ? inputRef : undefined}
                id={half === 0 ? fieldId("input") : fieldId("input-2")}
                value={half === 0 ? firstDoc : secondDoc}
                onChange={(value) => setInput(half === 0 ? joinDocuments(value, secondDoc) : joinDocuments(firstDoc, value))}
                ariaLabel={`${tool.name} ${half === 0 ? split.first : split.second}`}
                placeholder={half === 0 ? split.firstPlaceholder : split.secondPlaceholder}
                language={inputLanguage(tool.id, option)}
                onDropFile={(file) => loadTextFile(file, half)}
                size={expanded === "input" ? "regular" : "compact"}
                expanded={expanded === "input"}
                onToggleExpand={half === 1 ? () => setExpanded(expanded === "input" ? null : "input") : undefined}
              />
            </div>
          ))}
        </div>
      ) : (
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
          expanded={expanded === "input"}
          onToggleExpand={() => setExpanded(expanded === "input" ? null : "input")}
          toolbar={<span className="editor-top-note">{isImageTool ? "Drop an image or paste a data URL" : "Type, paste or drop a file"}</span>}
        />
      )}
    </StepCard>
  ) : null;

  const viewSwitch = views.length > 1 ? <ViewSwitch views={views} value={view} onChange={setPreferredView} /> : null;
  let outputBody: ReactNode;
  const strength = insights.find((item) => item.meter !== undefined);
  if (!needsInput) {
    outputBody = (
      <div className={`generated${output ? " has-output" : ""}`}>
        <input
          className="generated-value"
          readOnly
          value={output}
          placeholder={busy ? "Generating…" : "Press Run tool to generate a value."}
          aria-label={`${tool.name} output`}
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
        />
        {strength?.meter !== undefined && (
          <div className="strength" data-tone={strength.tone}>
            <div className="strength-bar"><span style={{ width: `${Math.round(strength.meter * 100)}%` }} /></div>
            <small>{strength.value} · {insights.find((item) => item.label === "Entropy")?.value} of entropy</small>
          </div>
        )}
        <div className="generated-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyText(output, "Value")} disabled={!output}>
            <Copy size={16} /> Copy value
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void run()} disabled={busy}>
            <RefreshCw size={16} /> Generate another
          </button>
        </div>
        <p className="generated-note">
          <ShieldCheck size={15} aria-hidden /> Made from your browser&apos;s cryptographic random source. It never leaves this tab.
        </p>
      </div>
    );
  } else if (isQr) {
    outputBody = (
      <div className="pane-frame">
        <PaneTop left={<span className="editor-top-note">Scan it with a phone camera to check it</span>} right="PNG" />
        <div className="image-preview has-output"><img src={output} alt="Generated QR code" /></div>
        <PaneFooter label="PNG image" bytes={byteLength(output)} />
      </div>
    );
  } else if (view === "preview" && outputIsImage) {
    outputBody = (
      <div className="pane-frame">
        <PaneTop left={viewSwitch} right={output.slice(5, output.indexOf(";")) || "Image"} />
        <div className="image-preview has-output"><img src={output} alt="The image this data URL encodes" /></div>
        <PaneFooter label="Image preview" bytes={byteLength(output)} />
      </div>
    );
  } else if (view === "preview") {
    outputBody = (
      <div className="pane-frame">
        <PaneTop left={viewSwitch} right="HTML" />
        <div className="preview has-output" aria-label={`${tool.name} output`} dangerouslySetInnerHTML={{ __html: output }} />
        <PaneFooter
          label="Rendered HTML"
          bytes={byteLength(output)}
          action={<ExpandButton expanded={expanded === "output"} label="the output" onToggle={() => setExpanded(expanded === "output" ? null : "output")} />}
        />
      </div>
    );
  } else if (view === "tree" && parsedOutput !== undefined) {
    outputBody = (
      <div className="pane-frame">
        <JsonTree value={parsedOutput} ariaLabel={`${tool.name} output as a tree`} leading={viewSwitch} />
        <PaneFooter
          label="JSON tree"
          bytes={byteLength(output)}
          action={<ExpandButton expanded={expanded === "output"} label="the output" onToggle={() => setExpanded(expanded === "output" ? null : "output")} />}
        />
      </div>
    );
  } else {
    outputBody = (
      <CodeEditor
        value={output}
        readOnly
        ariaLabel={`${tool.name} output`}
        className={output ? "has-output" : undefined}
        placeholder={result?.status === "error" ? "No output — see the message below." : "Run the tool to see the result here."}
        language={outLanguage}
        onCopy={output ? () => void copyText(output, "Output") : undefined}
        expanded={expanded === "output"}
        onToggleExpand={() => setExpanded(expanded === "output" ? null : "output")}
        toolbar={viewSwitch ?? <span className="editor-top-note">Read-only</span>}
      />
    );
  }

  const outputCard = (
    <StepCard
      step={needsInput ? 2 : 1}
      title={needsInput ? "Output" : outputNoun(tool.id, lastOption)}
      subtitle={needsInput ? outputSubtitle(tool.id, lastOption) : "A new value every time you run it."}
      expanded={expanded === "output"}
      onCollapse={collapse}
      className="is-output"
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
      {outputBody}
    </StepCard>
  );

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
            <ToolToolbar
              toolId={tool.id}
              values={{ option, pattern, flags, secret }}
              onChange={setField}
              flow={{ from: needsInput ? (split ? "2 documents" : inputLanguage(tool.id, option)) : null, to: outputNoun(tool.id, option) }}
              menu={menu}
              extra={needsInput && (
                <button type="button" className="btn btn-outline btn-sm" onClick={loadExample}>
                  <FileText size={16} /> Example
                </button>
              )}
            />

            <div className={`workbench-grid${needsInput ? "" : " is-single"}`}>
              {inputCard}
              {outputCard}
            </div>

            <ActionBar
              toolName={tool.name}
              result={result}
              busy={busy}
              needsInput={needsInput}
              onRun={() => void run()}
              onReset={reset}
              onJumpToError={jumpToError}
            />
          </div>
        </div>

        <ToolRail
          tool={tool}
          option={lastOption}
          result={result}
          output={output}
          insights={insights}
          onCopy={() => void copyText(output, "Output")}
          onDownload={downloadOutput}
          onShare={() => void shareOutput()}
          onJumpToError={jumpToError}
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
