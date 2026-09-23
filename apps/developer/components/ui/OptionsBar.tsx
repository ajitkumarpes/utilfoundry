"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, MoreHorizontal, Play, RotateCcw, Settings } from "lucide-react";
import { optionsFor, type OptionControl, type OptionField } from "@/lib/tool-options";
import { useIsMac } from "@/lib/use-platform";

export type MenuItem = { label: string; icon: ReactNode; onSelect: () => void };

type OptionsBarProps = {
  toolId: string;
  values: Record<OptionField, string>;
  onChange: (field: OptionField, value: string) => void;
  onRun: () => void;
  onReset: () => void;
  busy: boolean;
  menu: MenuItem[];
};

const fieldId = (toolId: string, field: OptionField) => `wb-${toolId}-${field}`;

function Control({ toolId, control, value, onChange }: {
  toolId: string; control: OptionControl; value: string; onChange: (value: string) => void;
}) {
  if (control.kind === "radio") {
    return (
      <div className="radio-group" role="radiogroup" aria-label={control.label}>
        {control.choices.map((choice) => (
          <label key={choice.value} className="radio">
            <input
              type="radio"
              name={fieldId(toolId, control.field)}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <span className="radio-dot" aria-hidden />
            {choice.label}
          </label>
        ))}
      </div>
    );
  }
  // A <label for> rather than a wrapping label: wrapped, a select's accessible name took in
  // its current value too ("Language JavaScript").
  const id = fieldId(toolId, control.field);
  if (control.kind === "select") {
    return (
      <span className="option-field">
        <label htmlFor={id}>{control.label}</label>
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {control.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
      </span>
    );
  }
  const listId = control.suggestions ? `${id}-suggestions` : undefined;
  return (
    <span className={`option-field${control.size ? ` is-${control.size}` : ""}`}>
      <label htmlFor={id}>{control.label}</label>
      <input
        id={id}
        type={control.inputType ?? "text"}
        value={value}
        placeholder={control.placeholder}
        min={control.min}
        max={control.max}
        list={listId}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {control.suggestions && (
        <datalist id={listId}>
          {control.suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      )}
    </span>
  );
}

function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="more-menu" ref={boxRef}>
      <button
        type="button"
        className="btn btn-outline btn-icon"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="more-menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The bar under the editors: this tool's settings on the left, Reset and Run on the right. */
export function OptionsBar({ toolId, values, onChange, onRun, onReset, busy, menu }: OptionsBarProps) {
  const options = optionsFor(toolId);
  const isMac = useIsMac();

  return (
    <section className="card options-bar" aria-label="Tool options">
      {options ? (
        <div className="options-group">
          <span className="options-title"><Settings size={18} aria-hidden /> {options.title}</span>
          {options.controls.map((control) => (
            <Control
              key={control.field}
              toolId={toolId}
              control={control}
              value={values[control.field]}
              onChange={(value) => onChange(control.field, value)}
            />
          ))}
        </div>
      ) : (
        <p className="options-empty">No settings needed — just run it.</p>
      )}
      <div className="options-actions">
        {menu.length > 0 && <MoreMenu items={menu} />}
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
          {busy ? <Loader2 size={17} className="spin" /> : <Play size={17} />}
          Run tool
          <kbd aria-hidden="true">{isMac ? "⌘" : "Ctrl"} ↵</kbd>
        </button>
      </div>
    </section>
  );
}
