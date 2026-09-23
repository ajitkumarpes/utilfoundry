"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle, AlertTriangle, AlignJustify, ArrowRight, Braces, Brackets, Check, ChevronDown, ChevronRight,
  ChevronUp, Copy, Download, HardDrive, Lightbulb, SearchCheck
} from "lucide-react";
import { DocsDialog } from "@/components/ui/DocsDialog";
import { UseCaseIcon } from "@/components/ui/UseCaseIcon";
import { tokenizeJson } from "@/lib/highlight";
import { byteLength, formatBytes, jsonShape, lineCount } from "@/lib/result-summary";
import type { RunResult } from "@/lib/run-result";
import { STARTERS } from "@/lib/samples";
import { guideFor } from "@/lib/tool-guide";
import { tipsFor } from "@/lib/tool-content";
import { outputIsData, outputLanguage, outputNoun } from "@/lib/tool-options";
import { getToolById, type ToolDefinition } from "@/lib/tools";

export type QuickAction = { label: string; icon: ReactNode; onSelect: () => void };

type ToolRailProps = {
  tool: ToolDefinition;
  option: string;
  result: RunResult | null;
  output: string;
  onCopy: () => void;
  onDownload: () => void;
  onJumpToError: () => void;
  quickActions: QuickAction[];
};

type Tab = "info" | "result";

/**
 * The example the Example button loads, as written. A one-line JSON example is spread over
 * lines so it can be read in the narrow rail; anything already laid out is left alone.
 */
function exampleText(toolId: string) {
  const starter = STARTERS[toolId] ?? "";
  const first = starter.trimStart()[0];
  if (first === "{" || first === "[") {
    try {
      const parsed = JSON.parse(starter);
      return { text: starter.includes("\n") ? starter : JSON.stringify(parsed, null, 2), json: true };
    } catch {
      // Not JSON after all; shown as written.
    }
  }
  return { text: starter, json: false };
}

function CodeBlock({ text, json }: { text: string; json: boolean }) {
  // Focusable so a keyboard user can scroll a long example, not only a mouse user.
  return (
    <pre className="rail-code" tabIndex={0} aria-label="Example input">
      {json
        ? tokenizeJson(text).map((token, index) =>
            token.type === "plain" ? token.text : <span key={index} className={`tok-${token.type}`}>{token.text}</span>)
        : text}
    </pre>
  );
}

function InfoPanel({ tool, onOpenDocs }: { tool: ToolDefinition; onOpenDocs: () => void }) {
  const guide = guideFor(tool.id);
  const example = exampleText(tool.id);
  const [exampleOpen, setExampleOpen] = useState(true);
  const exampleId = useId();

  return (
    <>
      <h2 className="rail-heading">Why use this tool?</h2>
      {guide && <p className="rail-lead">{guide.why}</p>}
      {guide && (
        <ul className="check-list">
          {guide.features.map((feature) => (
            <li key={feature}>
              <span className="check-dot" aria-hidden><Check size={12} strokeWidth={3.2} /></span>
              {feature}
            </li>
          ))}
        </ul>
      )}

      {example.text && (
        <section className="rail-inset">
          <button
            type="button"
            className="rail-inset-toggle"
            aria-expanded={exampleOpen}
            aria-controls={exampleId}
            onClick={() => setExampleOpen((open) => !open)}
          >
            Example input
            {exampleOpen ? <ChevronUp size={17} aria-hidden /> : <ChevronDown size={17} aria-hidden />}
          </button>
          {exampleOpen && <div id={exampleId}><CodeBlock text={example.text} json={example.json} /></div>}
        </section>
      )}

      {guide && (
        <section className="rail-inset">
          <h3 className="rail-inset-title">Common use cases</h3>
          <ul className="usecase-list">
            {guide.uses.map(([icon, text]) => (
              <li key={text}><UseCaseIcon name={icon} /> {text}</li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="btn btn-outline docs-button" onClick={onOpenDocs}>
        View full documentation <ArrowRight size={17} aria-hidden />
      </button>
    </>
  );
}

function ResultPanel({ tool, option, result, output, onCopy, onDownload, onJumpToError, quickActions }: ToolRailProps) {
  const guide = guideFor(tool.id);
  const [actionsOpen, setActionsOpen] = useState(true);
  const needsInput = tool.inputLabel !== "Not needed";
  const tip = guide?.tip ?? (needsInput ? "You can also drag and drop a file straight into the input editor." : tipsFor(tool)[0]);

  if (!result) {
    return (
      <div className="rail-empty">
        <span className="rail-empty-icon"><SearchCheck size={22} aria-hidden /></span>
        <strong>No result yet</strong>
        <p>Run the tool to see the size, line count and quick actions for its output here.</p>
      </div>
    );
  }

  const tipBox = (
    <aside className="rail-tip">
      <Lightbulb size={17} aria-hidden />
      <div><strong>Tip</strong><p>{tip}</p></div>
    </aside>
  );

  if (result.status === "error") {
    return (
      <>
        <div className="result-head is-error">
          <span className="result-head-icon"><AlertCircle size={22} /></span>
          <div><strong>{result.title}</strong><small>No output was produced.</small></div>
        </div>
        <p className="result-error-explained">{result.message}</p>
        {result.detail && <p className="result-error-message"><span>Parser message</span>{result.detail}</p>}
        {result.location && (
          <div className="result-error-location">
            <span>Line {result.location.line}, column {result.location.column}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={onJumpToError}>Jump to error</button>
          </div>
        )}
        {tipBox}
      </>
    );
  }

  const shape = outputIsData(tool.id) ? jsonShape(output) : null;
  const outputBytes = byteLength(output);
  const language = outputLanguage(tool.id, result.option, output);
  const isImage = output.startsWith("data:image/");
  const change = result.inputBytes > 0 && needsInput && !isImage
    ? Math.round(((outputBytes - result.inputBytes) / result.inputBytes) * 100)
    : null;
  const next = (guide?.next ?? [])
    .map(([id, label]) => ({ tool: getToolById(id), label }))
    .filter((item): item is { tool: ToolDefinition; label: string } => item.tool !== undefined);

  return (
    <>
      <div className={`result-head${result.tone === "warning" ? " is-warning" : ""}`}>
        <span className="result-head-icon">{result.tone === "warning" ? <AlertTriangle size={20} /> : <Check size={22} strokeWidth={3} />}</span>
        <div>
          <strong>{result.title}</strong>
          <small>{outputNoun(tool.id, option)} · {Math.max(1, Math.round(result.elapsedMs))} ms</small>
        </div>
      </div>

      {!isImage && (
        <dl className="result-stats">
          <div>
            <dt><HardDrive size={16} aria-hidden /> Size</dt>
            <dd>
              {formatBytes(outputBytes)}
              {change !== null && change !== 0 && (
                <span className={`size-change${change < 0 ? " is-smaller" : ""}`} title="Compared with the input">
                  {change > 0 ? "+" : ""}{change}%
                </span>
              )}
            </dd>
          </div>
          <div><dt><AlignJustify size={16} aria-hidden /> Lines</dt><dd>{lineCount(output)}</dd></div>
          {shape && (
            <>
              <div><dt><Braces size={16} aria-hidden /> Objects</dt><dd>{shape.objects}</dd></div>
              <div><dt><Brackets size={16} aria-hidden /> Array items</dt><dd>{shape.arrayItems}</dd></div>
            </>
          )}
        </dl>
      )}

      <section className="result-section">
        <button type="button" className="result-section-toggle" aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)}>
          Actions {actionsOpen ? <ChevronUp size={17} aria-hidden /> : <ChevronDown size={17} aria-hidden />}
        </button>
        {actionsOpen && (
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={onCopy}><Copy size={16} /> Copy to clipboard</button>
            <button type="button" className="btn btn-outline" onClick={onDownload}>
              <Download size={16} /> Download {isImage ? "PNG" : language === "Text" ? "as text" : `as ${language}`}
            </button>
            {quickActions.map((action) => (
              <button key={action.label} type="button" className="btn btn-outline" onClick={action.onSelect}>
                {action.icon} {action.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {next.length > 0 && (
        <section className="result-section">
          <h3 className="result-section-title">Next steps</h3>
          <ul className="next-steps">
            {next.map((item) => (
              <li key={item.tool.id}>
                <Link href={`/${item.tool.slug}`}><ChevronRight size={15} aria-hidden /> {item.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tipBox}
    </>
  );
}

/** The right-hand panel: what the tool is for (Info) and what the last run produced (Result). */
export function ToolRail(props: ToolRailProps) {
  const [tab, setTab] = useState<Tab>("info");
  const docsRef = useRef<HTMLDialogElement>(null);
  const baseId = useId();
  const tabs: Tab[] = ["info", "result"];
  const tone = props.result
    ? props.result.status === "error" ? "error" : props.result.tone
    : null;

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "info" ? "result" : "info";
    setTab(next);
    document.getElementById(`${baseId}-${next}-tab`)?.focus();
  }

  return (
    <aside className="rail" aria-label={`About ${props.tool.name}`}>
      <div className="card rail-card">
        <div className="rail-tabs" role="tablist" aria-label="Tool panel">
          {tabs.map((name) => (
            <button
              key={name}
              id={`${baseId}-${name}-tab`}
              type="button"
              role="tab"
              aria-selected={tab === name}
              aria-controls={`${baseId}-${name}-panel`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={onTabKey}
            >
              {name === "info" ? "Info" : "Result"}
              {name === "result" && tone && tab !== "result" && (
                <span className={`tab-dot is-${tone}`}><span className="sr-only"> (new)</span></span>
              )}
            </button>
          ))}
        </div>
        <div
          id={`${baseId}-${tab}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${tab}-tab`}
          className="rail-panel"
        >
          {tab === "info"
            ? <InfoPanel tool={props.tool} onOpenDocs={() => docsRef.current?.showModal()} />
            : <ResultPanel {...props} />}
        </div>
      </div>
      <DocsDialog ref={docsRef} tool={props.tool} />
    </aside>
  );
}
