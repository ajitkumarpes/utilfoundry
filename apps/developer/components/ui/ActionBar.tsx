"use client";

import { AlertCircle, AlertTriangle, Check, Loader2, Lock, Play, RotateCcw, Timer, Zap } from "lucide-react";
import type { RunResult } from "@/lib/run-result";
import { useIsMac } from "@/lib/use-platform";

type ActionBarProps = {
  toolName: string;
  result: RunResult | null;
  busy: boolean;
  /** Generators have nothing to paste, so the idle hint says so. */
  needsInput: boolean;
  onRun: () => void;
  onReset: () => void;
  onJumpToError: () => void;
};

/**
 * The bar under the editors: how the last run went on the left, Reset and Run on the right.
 * The status part carries `.result-banner` only once there is news, so "the banner is
 * showing" always means a run has started or finished.
 */
export function ActionBar({ toolName, result, busy, needsInput, onRun, onReset, onJumpToError }: ActionBarProps) {
  const isMac = useIsMac();
  const shortcut = isMac ? "⌘ ↵" : "Ctrl ↵";
  const state = busy ? "busy" : !result ? "idle" : result.status === "error" ? "error" : result.tone;

  let status;
  if (busy) {
    status = (
      <div className="result-banner is-busy" role="status" aria-live="polite">
        <span className="result-banner-icon"><Loader2 size={20} className="spin" /></span>
        <span className="result-banner-text"><strong>Running {toolName}…</strong></span>
      </div>
    );
  } else if (!result) {
    status = (
      <div className="action-idle">
        <span className="result-banner-icon"><Zap size={19} aria-hidden /></span>
        <span className="result-banner-text">
          <b>Ready when you are</b>
          <small>
            {needsInput ? "Paste your input, then press Run tool" : "Press Run tool for a fresh value"} or <kbd>{shortcut}</kbd>
          </small>
        </span>
      </div>
    );
  } else if (result.status === "error") {
    status = (
      <div className="result-banner is-error" role="alert">
        <span className="result-banner-icon"><AlertCircle size={22} /></span>
        <span className="result-banner-text">
          <strong>{result.title}</strong>
          <small>{result.message}</small>
        </span>
        {result.location && (
          <span className="result-banner-meta">
            <span>Line {result.location.line}, column {result.location.column}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={onJumpToError}>Jump to error</button>
          </span>
        )}
      </div>
    );
  } else {
    status = (
      <div className={`result-banner${result.tone === "warning" ? " is-warning" : ""}`} role="status" aria-live="polite">
        <span className="result-banner-icon">
          {result.tone === "warning" ? <AlertTriangle size={20} /> : <Check size={22} strokeWidth={3} />}
        </span>
        <span className="result-banner-text">
          <strong>{result.title}</strong>
          <small>{result.note}</small>
        </span>
        <span className="result-banner-meta">
          <span><Timer size={15} aria-hidden /> {Math.max(1, Math.round(result.elapsedMs))} ms</span>
          <span><Lock size={15} aria-hidden /> Processed locally</span>
        </span>
      </div>
    );
  }

  return (
    <section className={`card action-bar is-${state}`} aria-label="Run">
      <div className="action-status">{status}</div>
      <div className="action-buttons">
        <button type="button" className="btn btn-outline btn-reset" onClick={onReset} title="Reset the options and clear the result">
          <RotateCcw size={16} /> Reset
        </button>
        <button
          type="button"
          className="btn btn-primary btn-run"
          onClick={onRun}
          disabled={busy}
          aria-busy={busy}
          aria-keyshortcuts={isMac ? "Meta+Enter" : "Control+Enter"}
        >
          {busy ? <Loader2 size={17} className="spin" /> : <Play size={17} fill="currentColor" />}
          Run tool
          <kbd aria-hidden="true">{shortcut}</kbd>
        </button>
      </div>
    </section>
  );
}
