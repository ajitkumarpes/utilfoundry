"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type ChangeEvent, type UIEvent } from "react";

export type CodePaneHandle = {
  /** Focuses the pane, places the caret at `offset`, and scrolls it into view. */
  jumpTo: (offset: number) => void;
};

type CodePaneProps = {
  id?: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel: string;
  /** 1-based line to mark in the gutter, e.g. where a parse error landed. */
  errorLine?: number;
};

// Matches `.pane textarea { font: 12.5px/1.7 var(--mono); }` in globals.css — used only to
// approximate a scroll position for "jump to error", so it does not need to be exact.
const LINE_HEIGHT_PX = 12.5 * 1.7;

function byteSize(value: string): string {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function caretFromSelection(value: string, selectionStart: number): { line: number; column: number } {
  const before = value.slice(0, selectionStart);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/**
 * A plain <textarea> (editable or read-only) with a synced line-number gutter and a
 * Ln/Col/size status line — the "developer-tool" chrome around the raw textarea that
 * was here before. Deliberately not a full code editor (no syntax highlighting, no
 * virtualization): just enough to make pasting and reading structured text comfortable
 * for 70 different tools without taking on an editor dependency for all of them.
 *
 * Lines do not wrap (`white-space: pre` in .pane textarea) so each logical line is
 * exactly one visual row — the only way the gutter's line numbers stay aligned with the
 * text next to them. Long lines scroll horizontally instead, the same trade-off every
 * line-numbered code editor makes.
 */
export const CodePane = forwardRef<CodePaneHandle, CodePaneProps>(function CodePane(
  { id, value, onChange, readOnly, placeholder, ariaLabel, errorLine },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState({ line: 1, column: 1 });

  const lineCount = useMemo(() => (value.length === 0 ? 1 : value.split("\n").length), [value]);
  const size = useMemo(() => byteSize(value), [value]);

  function syncGutterScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
  }

  function updateCaret() {
    const el = textareaRef.current;
    if (el) setCaret(caretFromSelection(value, el.selectionStart));
  }

  useImperativeHandle(ref, () => ({
    jumpTo(offset: number) {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(offset, offset);
      const linesBefore = value.slice(0, offset).split("\n").length - 1;
      el.scrollTop = Math.max(0, linesBefore * LINE_HEIGHT_PX - el.clientHeight / 2);
      if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
      setCaret(caretFromSelection(value, offset));
    }
  }));

  return (
    <div className="code-pane">
      <div className="code-pane-body">
        <div className="code-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index} className={errorLine === index + 1 ? "gutter-line is-error" : "gutter-line"}>
              {index + 1}
            </span>
          ))}
        </div>
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck={false}
          aria-label={ariaLabel}
          className={readOnly && value ? "has-output" : undefined}
          onChange={onChange ? (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value) : undefined}
          onScroll={syncGutterScroll}
          onKeyUp={updateCaret}
          onClick={updateCaret}
          onSelect={updateCaret}
        />
      </div>
      <div className="code-pane-status">
        <span>
          Ln {caret.line}, Col {caret.column}
        </span>
        <span>
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
        <span>{size}</span>
      </div>
    </div>
  );
});
