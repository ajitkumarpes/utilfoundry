"use client";
/* QR data URLs are generated locally and intentionally rendered as a native image. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Copy, Download, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { StepCard } from "@/components/ui/StepCard";
import { StatusBar, type StatusTone } from "@/components/ui/StatusBar";
import { CodePane, type CodePaneHandle } from "@/components/ui/CodePane";
import { ResultSummary } from "@/components/ui/ResultSummary";
import { InfoRail } from "@/components/ui/InfoRail";
import { detectSensitiveInput, runTool } from "@/lib/run-tool";
import { STARTERS, defaultOption } from "@/lib/samples";
import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";
import type { ToolDefinition } from "@/lib/tools";

/** Tools whose single option is a plain encode/decode switch. */
const MODE_TOOLS = ["base64", "url", "yaml", "csv", "html", "hex"];

/**
 * Tools where a thrown JSON.parse error's "position N" lands directly in the full
 * `input` textarea, so it can drive "jump to error". json-diff and json-schema parse a
 * *half* of the input (split on a --- line), where that same offset would point at the
 * wrong place, so they're deliberately left out rather than jumping somewhere wrong.
 */
const JSON_ERROR_LOCATABLE = new Set(["json", "json-validator", "json-minifier", "jsonpath", "json-schema-generator"]);

/**
 * Reads a field's current value so React can start from it instead of from the shipped default.
 *
 * Every tool page is prerendered, so the example text and the default option are on screen and
 * editable well before this island hydrates. React seeds its state on that first client render
 * and then writes the seed back over the DOM, so a paste or a mode change made in the gap is
 * discarded without a trace. Measured in WebKit against a slow server: text typed into the input
 * box before hydration was replaced by the shipped example, and the tool then ran on the example.
 *
 * The id is per tool, so a client-side move to a different tool cannot adopt the outgoing page's
 * value — that element carries the previous tool's id and no longer matches.
 */
function seedFromField(id: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const field = document.getElementById(id);
  const isFormField =
    field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement || field instanceof HTMLSelectElement;
  return isFormField ? field.value : fallback;
}

export function Workbench({ tool }: { tool: ToolDefinition }) {
  const fieldId = (name: string) => `wb-${tool.id}-${name}`;
  const [input, setInput] = useState(() => seedFromField(fieldId("input"), STARTERS[tool.id] ?? ""));
  const [output, setOutput] = useState("");
  const [notice, setNotice] = useState("");
  const [tone, setTone] = useState<StatusTone>("idle");
  const [option, setOption] = useState(() => seedFromField(fieldId("option"), defaultOption(tool.id)));
  const [pattern, setPattern] = useState(() => seedFromField(fieldId("pattern"), "\\b[A-Z][a-z]+\\b"));
  const [flags, setFlags] = useState(() => seedFromField(fieldId("flags"), "g"));
  const [secret, setSecret] = useState(() => seedFromField(fieldId("secret"), "change-me-locally"));
  const [securityWarning, setSecurityWarning] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorLocation, setErrorLocation] = useState<JsonErrorLocation | null>(null);
  const workspaceFileRef = useRef<HTMLInputElement>(null);
  const inputPaneRef = useRef<CodePaneHandle>(null);

  async function run() {
    const findings = detectSensitiveInput(input);
    setSecurityWarning(
      findings.length
        ? `Potentially sensitive ${findings.join(", ")} detected. Use masked test data only and clear this page when finished.`
        : ""
    );
    setTone("busy");
    try {
      setOutput(await runTool(tool.id, { input, option, pattern, flags, secret }));
      setNotice("Done");
      setErrorMessage("");
      setErrorLocation(null);
      setTone("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process input.";
      setOutput(message);
      setNotice("Check your input");
      setErrorMessage(message);
      setErrorLocation(JSON_ERROR_LOCATABLE.has(tool.id) ? locateJsonError(input) : null);
      setTone("error");
    }
  }

  // Cmd/Ctrl+Enter runs the tool, matching the hint next to the Run button — the same
  // dual metaKey/ctrlKey check SiteHeader's own ⌘K shortcut uses. The listener is
  // attached once; a ref keeps it calling the latest `run` without resubscribing on
  // every keystroke into the input.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        runRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setNotice("Copied to clipboard");
    } catch {
      setNotice("Clipboard unavailable; select the output and copy manually");
    }
  }

  function downloadOutput() {
    if (!output) return;
    const link = document.createElement("a");
    const isImage = output.startsWith("data:image/");
    const objectUrl = isImage ? undefined : URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
    link.href = isImage ? output : (objectUrl ?? "");
    link.download = `${tool.slug}-output.${isImage ? "png" : "txt"}`;
    link.click();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setNotice("Downloaded locally");
  }

  function workspaceSnapshot() {
    return JSON.stringify({ version: 1, tool: tool.id, input, option, pattern, flags, exportedAt: new Date().toISOString() }, null, 2);
  }

  function saveWorkspace() {
    try {
      localStorage.setItem("utilfoundry-dev-workspace", workspaceSnapshot());
      setNotice("Workspace saved locally");
    } catch {
      setNotice("Local workspace storage is unavailable");
    }
  }

  function exportWorkspace() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([workspaceSnapshot()], { type: "application/json" }));
    link.download = "utilfoundry-workspace.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("Workspace exported locally");
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
        setNotice(saved.tool && saved.tool !== tool.id
          ? `Fields restored from a ${String(saved.tool)} workspace`
          : "Workspace imported locally");
      } catch {
        setNotice("Workspace file is not valid JSON");
      }
    };
    reader.readAsText(file);
  }

  function loadImageFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice("Images are limited to 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInput(typeof reader.result === "string" ? reader.result : "");
      setOutput("");
      setNotice("Image loaded locally");
    };
    reader.onerror = () => setNotice("Unable to read that image");
    reader.readAsDataURL(file);
  }

  // A generator ignores the input box, and a control that does nothing is worse than none.
  const needsInput = tool.inputLabel !== "Not needed";

  const statusTitle = tone === "ready" ? "Completed locally"
    : tone === "error" ? "Check your input"
      : tone === "busy" ? "Working…"
        : `Ready to run ${tool.name}`;
  const statusNote = tone === "error" ? "The message in the output pane says what went wrong."
    : tone === "ready" ? "Nothing uploaded"
      : "Nothing is uploaded. The tool runs in this tab.";

  return (
    <>
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

      <div className="workspace-split">
        <div className="workspace-main">
          <div className="workbench-grid">
        <StepCard
          step={1}
          title="Input"
          subtitle={needsInput ? "Paste or edit the input, then run the tool" : "This generator takes no input"}
          actions={needsInput ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setInput(STARTERS[tool.id] ?? "");
                  setOutput("");
                  setTone("idle");
                  setNotice("Example restored");
                  setErrorMessage("");
                  setErrorLocation(null);
                }}
              >
                <RotateCcw size={14} /> Example
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setInput("");
                  setOutput("");
                  setNotice("");
                  setTone("idle");
                  setErrorMessage("");
                  setErrorLocation(null);
                }}
              >
                Clear
              </button>
            </>
          ) : undefined}
        >
          <div className="tool-options">
            {MODE_TOOLS.includes(tool.id) && (
              <label>
                Mode
                <select id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)}>
                  <option value="encode">Encode / convert</option>
                  <option value="decode">Decode / convert</option>
                </select>
              </label>
            )}
            {/* Packing is the only one of the three that has a real choice to make, so the
                filler the payments world actually uses is named in the label rather than hidden. */}
            {tool.id === "bcd" && (
              <label>
                Mode
                <select id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)}>
                  <option value="encode">Pack digits (odd count filled with F)</option>
                  <option value="encode-zero">Pack digits (odd count padded with a leading 0)</option>
                  <option value="decode">Unpack BCD bytes</option>
                </select>
              </label>
            )}
            {tool.id === "binary" && (
              <label>
                Mode
                <select id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)}>
                  <option value="hex-to-binary">Hex → binary</option>
                  <option value="binary-to-hex">Binary → hex</option>
                </select>
              </label>
            )}
            {tool.id === "hash" && (
              <label>
                Algorithm
                <select id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)}>
                  <option>SHA-256</option>
                  <option>SHA-1</option>
                </select>
              </label>
            )}
            {(tool.id === "regex" || tool.id === "regex-safe") && (
              <>
                <label>Pattern<input id={fieldId("pattern")} value={pattern} onChange={(event) => setPattern(event.target.value)} /></label>
                <label>Flags<input id={fieldId("flags")} value={flags} onChange={(event) => setFlags(event.target.value)} /></label>
              </>
            )}
            {tool.id === "number" && (
              <label>
                Input base
                <select id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)}>
                  <option value="2">Binary (2)</option>
                  <option value="8">Octal (8)</option>
                  <option value="10">Decimal (10)</option>
                  <option value="16">Hex (16)</option>
                </select>
              </label>
            )}
            {tool.id === "jsonpath" && <label>Path<input id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)} /></label>}
            {tool.id === "timezone" && <label>Timezone<input id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)} /></label>}
            {tool.id === "code-formatter" && (
              <label>
                Language
                <select id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)}>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="json">JSON</option>
                  <option value="css">CSS</option>
                  <option value="html">HTML</option>
                </select>
              </label>
            )}
            {tool.id === "password" && (
              <label>Length<input id={fieldId("option")} type="number" min="8" max="128" value={option} onChange={(event) => setOption(event.target.value)} /></label>
            )}
            {tool.id === "jwt-sign" && (
              <>
                <label>
                  Mode
                  <select id={fieldId("option")} value={option} onChange={(event) => setOption(event.target.value)}>
                    <option value="sign">Sign payload</option>
                    <option value="verify">Verify token</option>
                  </select>
                </label>
                <label>HMAC secret<input id={fieldId("secret")} type="password" value={secret} onChange={(event) => setSecret(event.target.value)} /></label>
              </>
            )}
            {tool.id === "image-base64" && (
              <label className="file-picker">
                Choose image
                <input type="file" accept="image/*" onChange={(event) => loadImageFile(event.target.files?.[0])} />
              </label>
            )}
          </div>

          {needsInput ? (
            <>
              {/* Tools with a format convention say so here, rather than in an error afterwards. */}
              {tool.inputHint && <p className="input-hint">{tool.inputHint}</p>}
              <div className="pane">
                <div className="pane-label">Input <span>{tool.inputLabel}</span></div>
                <CodePane
                  ref={inputPaneRef}
                  id={fieldId("input")}
                  value={input}
                  onChange={setInput}
                  ariaLabel={`${tool.name} input`}
                  errorLine={errorLocation?.line}
                />
              </div>
            </>
          ) : (
            <p className="pane-empty">Nothing to paste: press <b>Run tool</b> for a fresh value, as often as you like.</p>
          )}
        </StepCard>

        <StepCard
          step={2}
          title="Output"
          subtitle="The result of the last run"
          actions={
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={copyOutput} disabled={!output}><Copy size={14} /> Copy</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={downloadOutput} disabled={!output}><Download size={14} /> Download</button>
            </>
          }
        >
          <div className="pane">
            <div className="pane-label">Output {notice && <span className="notice">{notice}</span>}</div>
            {tool.id === "markdown" && output ? (
              <div className="preview" dangerouslySetInnerHTML={{ __html: output }} />
            ) : tool.id === "qr" && output.startsWith("data:image/") ? (
              <div className="image-preview"><img src={output} alt="Generated QR code" /></div>
            ) : (
              <CodePane
                value={output}
                readOnly
                placeholder="Run the tool to see the result here."
                ariaLabel={`${tool.name} output`}
              />
            )}
          </div>
        </StepCard>
          </div>

          <StatusBar tone={tone} title={statusTitle} note={statusNote}>
            <span className="status-actions-secondary">
              <button type="button" className="btn btn-outline btn-sm" onClick={saveWorkspace}>Save local</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={exportWorkspace}>Export</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => workspaceFileRef.current?.click()}>Import</button>
              <input
                ref={workspaceFileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => importWorkspace(event.target.files?.[0])}
              />
            </span>
            <span className="status-actions-primary">
              <button type="button" className="btn btn-primary btn-run" onClick={run}>
                <Play size={16} /> Run tool <kbd>⌘ ⏎</kbd>
              </button>
            </span>
          </StatusBar>
        </div>

        <aside className="rail" aria-label={`About ${tool.name}`}>
          <ResultSummary
            tool={tool}
            tone={tone}
            output={output}
            errorMessage={errorMessage}
            errorLocation={errorLocation}
            onCopy={copyOutput}
            onDownload={downloadOutput}
            onJumpToError={() => errorLocation && inputPaneRef.current?.jumpTo(errorLocation.offset)}
          />
          <InfoRail tool={tool} showRelated={tone !== "ready"} />
        </aside>
      </div>
    </>
  );
}
