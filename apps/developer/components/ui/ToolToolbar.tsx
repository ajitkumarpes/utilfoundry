"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { optionsFor, type OptionControl, type OptionField } from "@/lib/tool-options";

export type MenuItem = { label: string; icon: ReactNode; onSelect: () => void };

type ToolToolbarProps = {
  toolId: string;
  values: Record<OptionField, string>;
  onChange: (field: OptionField, value: string) => void;
  /** What goes in and what comes out, e.g. "SQL" → "Formatted SQL". */
  flow: { from: string | null; to: string };
  menu: MenuItem[];
  /** Buttons that act on the whole bench, such as loading the example. */
  extra?: ReactNode;
};

const fieldId = (toolId: string, field: OptionField) => `wb-${toolId}-${field}`;

/**
 * A choice between modes, drawn as tabs. Underneath it is still a group of native radio
 * buttons, so arrow keys move between modes and assistive technology announces a choice.
 */
function Segmented({ toolId, control, value, onChange }: {
  toolId: string; control: Extract<OptionControl, { kind: "radio" }>; value: string; onChange: (value: string) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={control.label}>
      {control.choices.map((choice) => (
        <label key={choice.value} className="segment">
          <input
            type="radio"
            name={fieldId(toolId, control.field)}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
          />
          <span>{choice.label}</span>
        </label>
      ))}
    </div>
  );
}

function Field({ toolId, control, value, onChange }: {
  toolId: string; control: Exclude<OptionControl, { kind: "radio" }>; value: string; onChange: (value: string) => void;
}) {
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
        className="btn btn-outline btn-icon btn-sm"
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

/**
 * The strip above the editors: how this tool should run (its modes as tabs, and any
 * fields it takes), what it turns into what, and the workspace menu.
 */
export function ToolToolbar({ toolId, values, onChange, flow, menu, extra }: ToolToolbarProps) {
  const options = optionsFor(toolId);

  return (
    <section className="card tool-toolbar" aria-label="Tool options">
      <div className="toolbar-controls">
        {options ? (
          options.controls.map((control) =>
            control.kind === "radio" ? (
              <Segmented
                key={control.field}
                toolId={toolId}
                control={control}
                value={values[control.field]}
                onChange={(value) => onChange(control.field, value)}
              />
            ) : (
              <Field
                key={control.field}
                toolId={toolId}
                control={control}
                value={values[control.field]}
                onChange={(value) => onChange(control.field, value)}
              />
            )
          )
        ) : (
          <span className="toolbar-empty"><SlidersHorizontal size={16} aria-hidden /> No settings needed</span>
        )}
      </div>
      <div className="toolbar-meta">
        <span className="flow-chip">
          {flow.from ? (
            <>
              <b>{flow.from}</b>
              <ArrowRight size={14} aria-hidden />
              <span className="sr-only"> to </span>
            </>
          ) : (
            <span>Generates</span>
          )}
          <b>{flow.to}</b>
        </span>
        {extra}
        {menu.length > 0 && <MoreMenu items={menu} />}
      </div>
    </section>
  );
}
