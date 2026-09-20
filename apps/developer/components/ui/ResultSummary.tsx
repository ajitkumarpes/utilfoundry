import Link from "next/link";
import { AlertCircle, CheckCircle2, Copy, Download } from "lucide-react";
import { ToolIcon } from "@/components/ui/ToolIcon";
import type { StatusTone } from "@/components/ui/StatusBar";
import type { JsonErrorLocation } from "@/lib/json-error";
import { relatedTo } from "@/lib/tool-content";
import type { ToolDefinition } from "@/lib/tools";

type ResultSummaryProps = {
  tool: ToolDefinition;
  tone: StatusTone;
  output: string;
  errorMessage: string;
  errorLocation: JsonErrorLocation | null;
  onCopy: () => void;
  onDownload: () => void;
  onJumpToError: () => void;
};

/** Counts nested objects/arrays when the output happens to parse as JSON — true for the JSON
 *  tools, and for anything else whose result is JSON-shaped (diffs, schema output, ...), without
 *  needing a hardcoded list of which tool ids that covers. */
function jsonShapeStats(output: string): { objects: number; arrays: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  let objects = 0;
  let arrays = 0;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      arrays += 1;
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      objects += 1;
      Object.values(node).forEach(walk);
    }
  };
  walk(parsed);
  return { objects, arrays };
}

function byteSize(value: string): string {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Sits above the static "Why use this tool?" content in the rail, and only appears once a
 * run has happened — before that, the rail is exactly the informational content it always
 * was. Replaces guessing at value with the numbers the run actually produced.
 */
export function ResultSummary({ tool, tone, output, errorMessage, errorLocation, onCopy, onDownload, onJumpToError }: ResultSummaryProps) {
  if (tone !== "ready" && tone !== "error") return null;

  if (tone === "error") {
    return (
      <section className="card rail-card result-summary is-error">
        <h2>Result</h2>
        <div className="result-status">
          <AlertCircle size={18} aria-hidden />
          <div>
            <strong>Couldn&apos;t process that</strong>
            <small>This is what the parser stopped on.</small>
          </div>
        </div>
        <p className="result-error-message">{errorMessage}</p>
        {errorLocation && (
          <>
            <p className="result-error-location">
              Line {errorLocation.line}, column {errorLocation.column}
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={onJumpToError}>
              Jump to error
            </button>
          </>
        )}
      </section>
    );
  }

  const shapeStats = jsonShapeStats(output);
  const lineCount = output.length === 0 ? 0 : output.split("\n").length;
  const nextSteps = relatedTo(tool, 3);

  return (
    <section className="card rail-card result-summary">
      <h2>Result</h2>
      <div className="result-status">
        <CheckCircle2 size={18} aria-hidden />
        <div>
          <strong>{tool.name} completed</strong>
          <small>Ready to copy or download below.</small>
        </div>
      </div>
      <dl className="result-stats">
        <div>
          <dt>Size</dt>
          <dd>{byteSize(output)}</dd>
        </div>
        <div>
          <dt>Lines</dt>
          <dd>{lineCount}</dd>
        </div>
        {shapeStats && (
          <>
            <div>
              <dt>Objects</dt>
              <dd>{shapeStats.objects}</dd>
            </div>
            <div>
              <dt>Array items</dt>
              <dd>{shapeStats.arrays}</dd>
            </div>
          </>
        )}
      </dl>
      <div className="result-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onCopy}>
          <Copy size={14} /> Copy to clipboard
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onDownload}>
          <Download size={14} /> Download
        </button>
      </div>

      {nextSteps.length > 0 && (
        <div className="result-next-steps">
          <h3>Next steps</h3>
          <div className="related-list">
            {nextSteps.map((item) => (
              <Link key={item.id} href={`/${item.slug}`} className="related-link">
                <i><ToolIcon id={item.id} size={16} /></i>
                <span><b>{item.name}</b><small>{item.tagline}</small></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
