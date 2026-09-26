"use client";

import {
  forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type ChangeEvent, type DragEvent, type ReactNode
} from "react";
import { Copy, Maximize2, Minimize2, Upload } from "lucide-react";
import { HIGHLIGHT_LIMIT, tokenizeDiff, tokenizeJson } from "@/lib/highlight";
import { byteLength, formatBytes, lineCount } from "@/lib/result-summary";

export type CodeEditorHandle = {
  /** Focuses the editor, puts the caret at `offset` and scrolls that line into view. */
  jumpTo: (offset: number) => void;
};

type CodeEditorProps = {
  id?: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel: string;
  /** Shown in the status line; "JSON" and "Diff" also switch on colouring. */
  language: string;
  /** 1-based line to mark, e.g. where a parse error landed. */
  errorLine?: number;
  onCopy?: () => void;
  /** When set, a file dropped on the editor is handed here instead of being ignored. */
  onDropFile?: (file: File) => void;
  className?: string;
  /** "compact" is the shorter editor used where two share one card. */
  size?: "regular" | "compact";
  /** When set, the status line offers to open the card full screen (or close it again). */
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** Controls for the strip along the top of the editor, left of the language. */
  toolbar?: ReactNode;
};

// Kept in step with `.editor` in globals.css: the gutter markers and the colour layer
// are positioned from these, so a mismatch shows as text drifting off its line.
const LINE_HEIGHT = 21;
const PAD_Y = 12;

function caretAt(value: string, offset: number) {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset && index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/** Reads the indentation a document actually uses, the way an editor's status bar does. */
function indentation(value: string) {
  let smallest = 0;
  const lines = value.split("\n", 400);
  for (const line of lines) {
    if (line.startsWith("\t")) return "Tabs";
    const spaces = line.length - line.trimStart().length;
    if (spaces > 0 && line.trim() && (smallest === 0 || spaces < smallest)) smallest = spaces;
  }
  return `Spaces: ${smallest || 2}`;
}

/**
 * A textarea with an editor's chrome: line numbers, the current line, JSON colouring and a
 * status line. The colouring is a layer drawn underneath a transparent-text textarea with
 * identical metrics, so typing, selection, undo and screen readers all stay the browser's own.
 *
 * Lines never wrap (`white-space: pre`, `wrap="off"`): one logical line is one row, which is
 * what keeps the numbers beside the text they count. Long lines scroll sideways instead.
 */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    id, value, onChange, readOnly, placeholder, ariaLabel, language, errorLine, onCopy, onDropFile, className,
    size: editorSize = "regular", expanded = false, onToggleExpand, toolbar
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState({ line: 1, column: 1 });
  const [dragging, setDragging] = useState(false);

  const lines = useMemo(() => Math.max(1, lineCount(value)), [value]);
  const gutterText = useMemo(() => Array.from({ length: lines }, (_, index) => index + 1).join("\n"), [lines]);
  const size = useMemo(() => formatBytes(byteLength(value)), [value]);
  const indent = useMemo(() => indentation(value), [value]);
  const tokens = useMemo(() => {
    if (!value || value.length > HIGHLIGHT_LIMIT) return null;
    if (language === "JSON") return tokenizeJson(value);
    if (language === "Diff") return tokenizeDiff(value);
    return null;
  }, [language, value]);

  function syncScroll() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { scrollTop, scrollLeft } = textarea;
    if (layerRef.current) layerRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-scrollTop}px)`;
  }

  // Replacing the value (Example, Clear, a run) can move the textarea's scroll position
  // without a scroll event, which would leave the colour layer where it was.
  useLayoutEffect(syncScroll, [value]);

  function updateCaret() {
    const textarea = textareaRef.current;
    if (textarea) setCaret(caretAt(value, textarea.selectionStart));
  }

  useImperativeHandle(ref, () => ({
    jumpTo(offset: number) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(offset, offset);
      const position = caretAt(value, offset);
      textarea.scrollTop = Math.max(0, (position.line - 1) * LINE_HEIGHT - textarea.clientHeight / 2);
      syncScroll();
      setCaret(position);
    }
  }));

  const dropEnabled = Boolean(onDropFile) && !readOnly;
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  const dragHandlers = dropEnabled
    ? {
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        },
        onDragLeave: (event: DragEvent<HTMLDivElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        },
        onDrop: (event: DragEvent<HTMLDivElement>) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) onDropFile?.(file);
        }
      }
    : {};

  const lineTop = (line: number) => PAD_Y + (line - 1) * LINE_HEIGHT;

  return (
    <div
      className={`editor${readOnly ? " is-readonly" : ""}${dragging ? " is-dragging" : ""}${editorSize === "compact" ? " is-compact" : ""}`}
      {...dragHandlers}
    >
      {editorSize !== "compact" && (
        <div className="editor-top">
          <div className="editor-top-left">{toolbar}</div>
          <span className="editor-lang">{language}</span>
        </div>
      )}
      <div className="editor-body">
        <div className="editor-gutter" aria-hidden="true">
          <div className="editor-gutter-inner" ref={gutterRef}>
            <pre>{gutterText}</pre>
            {!readOnly && <span className="gutter-mark is-current" style={{ top: lineTop(caret.line) }}>{caret.line}</span>}
            {errorLine && errorLine <= lines && (
              <span className="gutter-mark is-error" style={{ top: lineTop(errorLine) }}>{errorLine}</span>
            )}
          </div>
        </div>
        <div className="editor-surface">
          <div className="editor-layer" ref={layerRef} aria-hidden="true">
            {!readOnly && <div className="editor-line is-current" style={{ top: lineTop(caret.line) }} />}
            {errorLine && errorLine <= lines && <div className="editor-line is-error" style={{ top: lineTop(errorLine) }} />}
            {tokens && (
              <pre className="editor-code">
                {tokens.map((token, index) =>
                  token.type === "plain" ? token.text : <span key={index} className={`tok-${token.type}`}>{token.text}</span>
                )}
              </pre>
            )}
          </div>
          <textarea
            id={id}
            ref={textareaRef}
            className={[tokens ? "is-coloured" : "", className ?? ""].filter(Boolean).join(" ") || undefined}
            value={value}
            readOnly={readOnly}
            placeholder={placeholder}
            aria-label={ariaLabel}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            onChange={onChange ? (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value) : undefined}
            onScroll={syncScroll}
            onSelect={updateCaret}
            onKeyUp={updateCaret}
            onClick={updateCaret}
          />
          {dragging && (
            <div className="editor-drop" aria-hidden="true">
              <Upload size={20} /> Drop the file to load it
            </div>
          )}
        </div>
      </div>
      <div className="editor-status">
        <span>Ln {caret.line}, Col {caret.column}</span>
        <span>{indent}</span>
        <span>UTF-8</span>
        {editorSize === "compact" && <span>{language}</span>}
        <span className="editor-status-size">{size}</span>
        {onCopy && (
          <button type="button" className="editor-status-copy" onClick={onCopy} aria-label={`Copy ${ariaLabel.toLowerCase()}`} title="Copy">
            <Copy size={14} />
          </button>
        )}
        {onToggleExpand && (
          <button
            type="button"
            className="editor-status-copy"
            onClick={onToggleExpand}
            aria-label={expanded ? "Exit full screen" : `Open ${ariaLabel.toLowerCase()} full screen`}
            title={expanded ? "Exit full screen (Esc)" : "Full screen"}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
});
