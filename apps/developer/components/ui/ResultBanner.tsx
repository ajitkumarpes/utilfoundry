import { AlertCircle, AlertTriangle, AlignJustify, Check, FileText, Files, Loader2, X } from "lucide-react";
import { byteLength, formatBytes, jsonShape, lineCount } from "@/lib/result-summary";
import type { RunResult } from "@/lib/run-result";
import { outputIsData } from "@/lib/tool-options";

type ResultBannerProps = {
  toolId: string;
  toolName: string;
  result: RunResult | null;
  output: string;
  busy: boolean;
  onDismiss: () => void;
  onJumpToError: () => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The one place a run reports how it went. Nothing is shown before the first run — the
 * page already says what the tool does — so this appears only when there is news.
 */
export function ResultBanner({ toolId, toolName, result, output, busy, onDismiss, onJumpToError }: ResultBannerProps) {
  if (busy) {
    return (
      <section className="result-banner is-busy" role="status" aria-live="polite">
        <span className="result-banner-icon"><Loader2 size={22} className="spin" /></span>
        <span className="result-banner-text"><strong>Running {toolName}…</strong></span>
      </section>
    );
  }
  if (!result) return null;

  if (result.status === "error") {
    return (
      <section className="result-banner is-error" role="alert">
        <span className="result-banner-icon"><AlertCircle size={24} /></span>
        <span className="result-banner-text">
          <strong>{result.title}</strong>
          <small>{result.message}</small>
        </span>
        {result.location && (
          <span className="result-banner-stats">
            <span>Line {result.location.line}, column {result.location.column}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={onJumpToError}>Jump to error</button>
          </span>
        )}
        <button type="button" className="result-banner-close" onClick={onDismiss} aria-label="Dismiss">
          <X size={18} />
        </button>
      </section>
    );
  }

  const shape = outputIsData(toolId) ? jsonShape(output) : null;
  const isImage = output.startsWith("data:image/");
  return (
    <section className={`result-banner${result.tone === "warning" ? " is-warning" : ""}`} role="status" aria-live="polite">
      <span className="result-banner-icon">{result.tone === "warning" ? <AlertTriangle size={22} /> : <Check size={24} strokeWidth={3} />}</span>
      <span className="result-banner-text">
        <strong>{result.title}</strong>
        <small>{result.note}</small>
      </span>
      {!isImage && (
        <span className="result-banner-stats">
          {shape && <span><FileText size={17} aria-hidden /> {plural(shape.objects, "object")}</span>}
          <span><AlignJustify size={17} aria-hidden /> {plural(lineCount(output), "line")}</span>
          <span><Files size={17} aria-hidden /> {formatBytes(byteLength(output))}</span>
        </span>
      )}
      <button type="button" className="result-banner-close" onClick={onDismiss} aria-label="Dismiss">
        <X size={18} />
      </button>
    </section>
  );
}
