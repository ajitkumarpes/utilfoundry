"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

/** Children drawn per object or array before the rest is summarised as "N more". */
const CHILD_LIMIT = 200;

type Mode = "default" | "all" | "none";

function kindOf(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function Leaf({ value }: { value: unknown }) {
  const kind = kindOf(value);
  if (kind === "string") return <span className="tok-string">{JSON.stringify(value)}</span>;
  if (kind === "number") return <span className="tok-number">{String(value)}</span>;
  if (kind === "boolean") return <span className="tok-boolean">{String(value)}</span>;
  return <span className="tok-null">null</span>;
}

function Node({ name, value, depth, mode }: { name?: string; value: unknown; depth: number; mode: Mode }) {
  const isArray = Array.isArray(value);
  const isContainer = value !== null && typeof value === "object";
  const [open, setOpen] = useState(mode === "all" ? true : mode === "none" ? depth === 0 : depth < 2);
  const entries: Array<[string, unknown]> = isContainer
    ? isArray ? (value as unknown[]).map((item, index) => [String(index), item]) : Object.entries(value as object)
    : [];

  const key = name === undefined ? null : (
    <span className={isArray || /^\d+$/.test(name) ? "tree-index" : "tok-key"}>{/^\d+$/.test(name) ? name : `"${name}"`}</span>
  );

  if (!isContainer) {
    return (
      <li>
        <div className="tree-row">
          <span className="tree-spacer" aria-hidden />
          {key}{key && <span className="tok-punct">: </span>}
          <Leaf value={value} />
        </div>
      </li>
    );
  }

  const summary = isArray ? `[${entries.length}]` : `{${entries.length}}`;
  return (
    <li>
      <div className="tree-row">
        <button
          type="button"
          className="tree-toggle"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${name === undefined ? "root" : name}`}
          onClick={() => setOpen((value) => !value)}
          disabled={entries.length === 0}
        >
          <ChevronRight size={14} aria-hidden />
        </button>
        {key}{key && <span className="tok-punct">: </span>}
        <span className="tree-summary">{isArray ? "Array" : "Object"} <span>{summary}</span></span>
      </div>
      {open && entries.length > 0 && (
        <ul>
          {entries.slice(0, CHILD_LIMIT).map(([childName, child]) => (
            <Node key={childName} name={childName} value={child} depth={depth + 1} mode={mode} />
          ))}
          {entries.length > CHILD_LIMIT && (
            <li className="tree-more">… {entries.length - CHILD_LIMIT} more — switch to Code to see everything</li>
          )}
        </ul>
      )}
    </li>
  );
}

/** A collapsible view of a JSON output, for finding your way around a large document. */
export function JsonTree({ value, ariaLabel, leading }: { value: unknown; ariaLabel: string; leading?: ReactNode }) {
  const [mode, setMode] = useState<Mode>("default");
  const [generation, setGeneration] = useState(0);

  function remount(next: Mode) {
    setMode(next);
    setGeneration((value) => value + 1);
  }

  return (
    <div className="json-tree-wrap">
      <div className="editor-top">
        <div className="editor-top-left">{leading}</div>
        <div className="json-tree-tools">
          <button type="button" onClick={() => remount("all")}><ChevronsUpDown size={14} aria-hidden /> Expand all</button>
          <button type="button" onClick={() => remount("none")}><ChevronsDownUp size={14} aria-hidden /> Collapse all</button>
        </div>
      </div>
      <div className="json-tree" role="region" aria-label={ariaLabel} tabIndex={0}>
        <ul key={generation}>
          <Node value={value} depth={0} mode={mode} />
        </ul>
      </div>
    </div>
  );
}
