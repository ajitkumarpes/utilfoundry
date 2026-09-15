"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function Field({ label, help, children }: { label?: string; help?: string; children: ReactNode }) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      {children}
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}

type Option = { value: string; label: string; disabled?: boolean };

export function SelectField({ label, help, value, options, onChange }: {
  label: string; help?: string; value: string; options: Option[]; onChange: (value: string) => void;
}) {
  return (
    <Field label={label} help={help}>
      <select className="control" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>
    </Field>
  );
}

export function NumberField({ label, help, value, onChange, placeholder, min, max }: {
  label: string; help?: string; value: string; onChange: (value: string) => void; placeholder?: string; min?: number; max?: number;
}) {
  return (
    <Field label={label} help={help}>
      <input
        className="control"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function TextField({ label, help, value, onChange, placeholder }: {
  label: string; help?: string; value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return (
    <Field label={label} help={help}>
      <input className="control" value={value} placeholder={placeholder} aria-label={label} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

/** Slider with an editable numeric readout, as in the reference option panels. */
export function RangeField({ label, value, onChange, min, max, step = 1, unit = "", help, accent = false, scale }: {
  label: string; value: number; onChange: (value: number) => void;
  min: number; max: number; step?: number;
  /** Shown inside the readout box, e.g. "px", "%", "°". */
  unit?: string;
  help?: string; accent?: boolean; scale?: [string, string, string];
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className={`field ${accent ? "range-accent" : ""}`}>
      <div className="range-head">
        <span className="field-label">{label}</span>
        <input
          className="range-value"
          type="text"
          inputMode="numeric"
          value={`${value}${unit}`}
          aria-label={`${label} value`}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value.replace(/[^0-9.-]/g, ""));
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ ["--fill" as string]: fill }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {scale && <div className="range-scale"><span>{scale[0]}</span><span>{scale[1]}</span><span>{scale[2]}</span></div>}
      {help && !scale && <span className="field-help">{help}</span>}
    </div>
  );
}

export function TileRow({ label, help, value, options, onChange }: {
  label?: string; help?: string; value: string;
  options: { value: string; label: string; icon?: ReactNode; disabled?: boolean }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} help={help}>
      <div className="tile-row" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="tile"
            disabled={option.disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** Two equally sized buttons, used for Portrait / Landscape style choices. */
export function SplitChoice({ label, help, value, options, onChange }: {
  label?: string; help?: string; value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} help={help}>
      <div className="split-row" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.value} type="button" className="tile" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function RadioRow({ label, help, value, options, onChange }: {
  label?: string; help?: string; value: string; options: Option[]; onChange: (value: string) => void;
}) {
  return (
    <Field label={label} help={help}>
      <div className="radio-row" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="radio"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <i /> {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function CheckboxRow({ label, note, checked, onChange }: {
  label: string; note?: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  return (
    <button type="button" className="checkbox-row" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)}>
      <i>{checked && <Check size={13} strokeWidth={3.2} />}</i>
      <span><b>{label}</b>{note && <small>{note}</small>}</span>
    </button>
  );
}

export function ToggleRow({ label, note, checked, onChange, tone = "accent" }: {
  label: string; note?: string; checked: boolean; onChange: (checked: boolean) => void; tone?: "accent" | "blue";
}) {
  return (
    <button
      type="button"
      className={`toggle-row ${tone === "blue" ? "is-blue" : ""}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span><b>{label}</b>{note && <small>{note}</small>}</span>
      <i />
    </button>
  );
}

export function ColorField({ label, help, value, onChange }: {
  label: string; help?: string; value: string; onChange: (value: string) => void;
}) {
  return (
    <Field label={label} help={help}>
      <div className="color-field">
        <input type="color" value={value} aria-label={`${label} swatch`} onChange={(event) => onChange(event.target.value)} />
        <input
          type="text"
          value={value.toUpperCase()}
          aria-label={`${label} hex value`}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (/^#[0-9a-fA-F]{0,6}$/.test(next)) onChange(next);
          }}
        />
      </div>
    </Field>
  );
}

const POSITIONS = ["top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"] as const;
export type WatermarkPosition = (typeof POSITIONS)[number];

export function PositionPad({ value, onChange }: { value: string; onChange: (value: WatermarkPosition) => void }) {
  return (
    <Field label="Position">
      <div className="position-pad" role="group" aria-label="Watermark position">
        {POSITIONS.map((position) => (
          <button
            key={position}
            type="button"
            aria-pressed={value === position}
            aria-label={position.replace("-", " ")}
            onClick={() => onChange(position)}
          >
            <i />
          </button>
        ))}
      </div>
    </Field>
  );
}
