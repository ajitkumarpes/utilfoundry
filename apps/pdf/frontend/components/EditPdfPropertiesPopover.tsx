"use client";

import { BringToFront, ChevronDown, ChevronUp, Copy, SendToBack, Trash2, X } from "lucide-react";
import { EditElement } from "@/lib/editPdfTypes";

const PALETTE = ["#171717", "#dc2626", "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#ffffff"];
const POPOVER_WIDTH = 230;
const POPOVER_HEIGHT_ESTIMATE = 320;
const GAP = 10;

/** Kinds the backend actually rotates/fades - LINK and FORM_FIELD are PDF annotations, not
 *  content-stream paint, so a rotation or opacity value on them would be silently ignored. */
const TRANSFORMABLE_KINDS: EditElement["kind"][] = ["TEXT", "IMAGE", "SIGN", "SHAPE", "WHITEOUT"];

type ScreenRect = { left: number; top: number; width: number; height: number };
export type ReorderDirection = "forward" | "backward" | "front" | "back";

type Props = {
  element: EditElement;
  anchor: ScreenRect;
  containerWidth: number;
  containerHeight: number;
  onChange: (patch: Partial<EditElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder: (direction: ReorderDirection) => void;
  onClose: () => void;
};

const KIND_LABEL: Record<EditElement["kind"], string> = {
  TEXT: "Text",
  IMAGE: "Image",
  SIGN: "Signature",
  SHAPE: "Shape",
  WHITEOUT: "Whiteout",
  LINK: "Link",
  FORM_FIELD: "Form field",
  ANNOTATE: "Annotation"
};

export default function EditPdfPropertiesPopover({
  element,
  anchor,
  containerWidth,
  containerHeight,
  onChange,
  onDelete,
  onDuplicate,
  onReorder,
  onClose
}: Props) {
  const transformable = TRANSFORMABLE_KINDS.includes(element.kind);
  // LINE has no interior to fill; X_MARK/CHECK are always stroke-only stamps regardless of
  // `filled` (see PdfEditService.drawShape's early-return branches for both).
  const supportsFill = element.shapeKind !== "LINE" && element.shapeKind !== "X_MARK" && element.shapeKind !== "CHECK";
  const fitsBelow = anchor.top + anchor.height + GAP + POPOVER_HEIGHT_ESTIMATE <= containerHeight;
  const top = fitsBelow ? anchor.top + anchor.height + GAP : Math.max(GAP, anchor.top - POPOVER_HEIGHT_ESTIMATE - GAP);
  const left = Math.min(Math.max(GAP, anchor.left), Math.max(GAP, containerWidth - POPOVER_WIDTH - GAP));

  return (
    <div className="edit-popover" style={{ left, top }} onPointerDown={e => e.stopPropagation()}>
      <div className="edit-popover-head">
        <h4>{KIND_LABEL[element.kind]}</h4>
        <button type="button" className="edit-popover-close" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {element.kind === "TEXT" && (
        <div className="field">
          <label htmlFor="edit-font-size">Font size</label>
          <input id="edit-font-size" type="range" min={8} max={96} step={1} value={element.fontSize || 16} onChange={e => onChange({ fontSize: Number(e.target.value) })} />
        </div>
      )}

      {(element.kind === "TEXT" || element.kind === "SHAPE" || element.kind === "ANNOTATE") && (
        <div className="field">
          <label>Color</label>
          <div className="edit-color-row">
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                className={`edit-color-swatch${element.color === c ? " active" : ""}`}
                style={{ background: c, borderColor: c === "#ffffff" ? "var(--border)" : c }}
                onClick={() => onChange({ color: c })}
                aria-label={`Use color ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      {element.kind === "SHAPE" && supportsFill && (
        <label className="feedback-checkbox">
          <input type="checkbox" checked={!!element.filled} onChange={e => onChange({ filled: e.target.checked })} />
          <span>Filled</span>
        </label>
      )}

      {element.kind === "SHAPE" && (
        <div className="field">
          <label htmlFor="edit-stroke-width">{element.filled && supportsFill ? "Outline width (unused while filled)" : "Stroke width"}</label>
          <input
            id="edit-stroke-width"
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={element.strokeWidth || 2}
            onChange={e => onChange({ strokeWidth: Number(e.target.value) })}
          />
        </div>
      )}

      {element.kind === "ANNOTATE" && (
        <div className="field">
          <label htmlFor="edit-ink-width">Stroke width</label>
          <input id="edit-ink-width" type="range" min={1} max={20} step={0.5} value={element.strokeWidth || 3} onChange={e => onChange({ strokeWidth: Number(e.target.value) })} />
        </div>
      )}

      {element.kind === "WHITEOUT" && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.5 }}>
          Covers this area — the content underneath is not removed from the file. For permanent removal, use{" "}
          <a href="/tools/redact-pdf" style={{ color: "var(--accent)" }}>
            Redact PDF
          </a>{" "}
          instead.
        </p>
      )}

      {element.kind === "LINK" && (
        <div className="field">
          <label htmlFor="edit-link-url">Link URL</label>
          <input
            id="edit-link-url"
            className="text-input"
            type="url"
            placeholder="https://example.com"
            value={element.url || ""}
            onChange={e => onChange({ url: e.target.value })}
            autoFocus
          />
        </div>
      )}

      {element.kind === "FORM_FIELD" && (
        <>
          <div className="segmented">
            <button type="button" className={element.fieldKind === "TEXT_FIELD" ? "active" : ""} onClick={() => onChange({ fieldKind: "TEXT_FIELD" })}>
              Text
            </button>
            <button type="button" className={element.fieldKind === "CHECKBOX" ? "active" : ""} onClick={() => onChange({ fieldKind: "CHECKBOX" })}>
              Checkbox
            </button>
            <button type="button" className={element.fieldKind === "RADIO" ? "active" : ""} onClick={() => onChange({ fieldKind: "RADIO", optionValue: element.optionValue || "Option 1" })}>
              Radio
            </button>
            <button type="button" className={element.fieldKind === "DROPDOWN" ? "active" : ""} onClick={() => onChange({ fieldKind: "DROPDOWN", options: element.options?.length ? element.options : ["Option 1", "Option 2"] })}>
              Dropdown
            </button>
          </div>

          {element.fieldKind === "TEXT_FIELD" && (
            <label className="feedback-checkbox">
              <input type="checkbox" checked={!!element.multiline} onChange={e => onChange({ multiline: e.target.checked })} />
              <span>Multi-line</span>
            </label>
          )}

          {element.fieldKind === "RADIO" ? (
            <>
              <div className="field">
                <label htmlFor="edit-field-group">Group name</label>
                <input id="edit-field-group" className="text-input" type="text" value={element.fieldName || ""} onChange={e => onChange({ fieldName: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="edit-option-value">Option value</label>
                <input id="edit-option-value" className="text-input" type="text" value={element.optionValue || ""} onChange={e => onChange({ optionValue: e.target.value })} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)", lineHeight: 1.4 }}>Radio buttons that share the same group name form one choice - only one can be selected.</p>
              <label className="feedback-checkbox">
                <input type="checkbox" checked={!!element.checked} onChange={e => onChange({ checked: e.target.checked })} />
                <span>Selected by default</span>
              </label>
            </>
          ) : (
            <div className="field">
              <label htmlFor="edit-field-name">Field name</label>
              <input id="edit-field-name" className="text-input" type="text" value={element.fieldName || ""} onChange={e => onChange({ fieldName: e.target.value })} />
            </div>
          )}

          {element.fieldKind === "CHECKBOX" && (
            <label className="feedback-checkbox">
              <input type="checkbox" checked={!!element.checked} onChange={e => onChange({ checked: e.target.checked })} />
              <span>Checked by default</span>
            </label>
          )}

          {element.fieldKind === "DROPDOWN" && (
            <div className="field">
              <label htmlFor="edit-dropdown-options">Options (one per line)</label>
              <textarea
                id="edit-dropdown-options"
                className="text-input"
                rows={4}
                value={(element.options || []).join("\n")}
                onChange={e => onChange({ options: e.target.value.split("\n") })}
                onBlur={e => onChange({ options: e.target.value.split("\n").map(o => o.trim()).filter(Boolean) })}
              />
            </div>
          )}
        </>
      )}

      {(element.kind === "IMAGE" || element.kind === "SIGN") && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-faint)" }}>Drag to move, the corner handle to resize, the top handle to rotate.</p>
      )}

      {transformable && (
        <div className="field">
          <label htmlFor="edit-rotation">Rotation</label>
          <input
            id="edit-rotation"
            type="range"
            min={-180}
            max={180}
            step={1}
            value={element.rotationDeg || 0}
            onChange={e => onChange({ rotationDeg: Number(e.target.value) })}
          />
        </div>
      )}

      {transformable && (
        <div className="field">
          <label htmlFor="edit-opacity">Opacity</label>
          <input
            id="edit-opacity"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={element.opacity ?? 1}
            onChange={e => onChange({ opacity: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="edit-popover-row">
        <button type="button" className="icon-btn" onClick={() => onReorder("back")} title="Send to back" aria-label="Send to back">
          <SendToBack size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => onReorder("backward")} title="Send backward" aria-label="Send backward">
          <ChevronDown size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => onReorder("forward")} title="Bring forward" aria-label="Bring forward">
          <ChevronUp size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => onReorder("front")} title="Bring to front" aria-label="Bring to front">
          <BringToFront size={15} />
        </button>
      </div>

      <div className="edit-popover-row">
        <button type="button" className="secondary-btn" onClick={onDuplicate} style={{ flex: 1, justifyContent: "center", display: "flex", gap: 6 }}>
          <Copy size={15} /> Duplicate
        </button>
        <button type="button" className="secondary-btn" onClick={onDelete} style={{ flex: 1, justifyContent: "center", display: "flex", gap: 6 }}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </div>
  );
}
