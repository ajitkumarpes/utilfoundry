"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, Link as LinkIcon, X } from "lucide-react";
import type { RenderedPage } from "@/lib/pdfPageRenderer";
import { EditElement, UploadedImage } from "@/lib/editPdfTypes";

type Props = {
  mainPage: RenderedPage;
  elements: EditElement[];
  images: UploadedImage[];
  selectedId: string | null;
  /** The one TEXT element (if any) currently accepting keystrokes - see the comment above the
   *  textarea below for why this has to be distinct from `selectedId`. */
  editingTextId: string | null;
  ptToPx: number;
  onStartMove: (e: ReactPointerEvent, el: EditElement) => void;
  onStartResize: (e: ReactPointerEvent, el: EditElement) => void;
  onStartRotate: (e: ReactPointerEvent, el: EditElement) => void;
  onRemove: (id: string) => void;
  onStartEditingText: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onTextBlur: () => void;
};

/** An arrow's shaft plus a filled triangular head, mirroring PdfEditService's addArrowhead. */
function arrowPoints(w: number, h: number, flipped: boolean | undefined) {
  const x1 = 0;
  const y1 = flipped ? h : 0;
  const x2 = w;
  const y2 = flipped ? 0 : h;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = Math.max(8, (w + h) * 0.08);
  const spread = (28 * Math.PI) / 180;
  const leftX = x2 - headLength * Math.cos(angle - spread);
  const leftY = y2 - headLength * Math.sin(angle - spread);
  const rightX = x2 - headLength * Math.cos(angle + spread);
  const rightY = y2 - headLength * Math.sin(angle + spread);
  return { x1, y1, x2, y2, head: `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}` };
}

/** Renders every box-based element (everything except freehand ink) for the current page. */
export default function EditPdfElementLayer({
  mainPage,
  elements,
  images,
  selectedId,
  editingTextId,
  ptToPx,
  onStartMove,
  onStartResize,
  onStartRotate,
  onRemove,
  onStartEditingText,
  onTextChange,
  onTextBlur
}: Props) {
  const px = (pct: number) => pct * mainPage.renderWidth;
  const py = (pct: number) => pct * mainPage.renderHeight;

  return (
    <>
      {elements.map(el => {
        const selected = el.id === selectedId;
        const editing = el.id === editingTextId;
        const w = px(el.widthPct);
        const h = py(el.heightPct);
        return (
          <div
            key={el.id}
            className={`edit-element edit-element-${el.kind.toLowerCase()}${selected ? " selected" : ""}${editing ? " editing" : ""}`}
            style={{
              left: px(el.xPct),
              top: py(el.yPct),
              width: w,
              height: h,
              transform: el.rotationDeg ? `rotate(${el.rotationDeg}deg)` : undefined,
              opacity: el.opacity ?? 1
            }}
            onPointerDown={e => onStartMove(e, el)}
            onDoubleClick={() => el.kind === "TEXT" && onStartEditingText(el.id)}
          >
            {el.kind === "TEXT" && (
              // A textarea that filled the whole box intercepted every pointerdown, so
              // onStartMove's own "don't drag when the target is the textarea" guard (needed so
              // clicking in to type doesn't also drag) ended up blocking ALL dragging of text
              // elements, full stop - there was no click that ever reached the wrapper. The fix
              // most editors use: the textarea only accepts pointer events while it is the one
              // being edited (double-click to enter that state); otherwise clicks pass through
              // it to the wrapper, which selects and drags like any other element.
              <textarea
                value={el.text || ""}
                placeholder="Double-click to edit…"
                // autoFocus only fires when this DOM node is first created - it does nothing when
                // an already-mounted textarea's turn to be edited comes later (double-clicking an
                // existing box), which left it looking editable (border, pointer-events) without
                // actually taking keystrokes. A ref callback re-runs on every render regardless,
                // so it catches that case too; calling focus() on an already-focused textarea is
                // a harmless no-op, so this needs no extra state to only fire once.
                ref={node => {
                  if (node && editingTextId === el.id) node.focus();
                }}
                onChange={e => onTextChange(el.id, e.target.value)}
                onBlur={onTextBlur}
                style={{
                  fontSize: (el.fontSize || 16) * ptToPx,
                  color: el.color || "#171717",
                  pointerEvents: editingTextId === el.id ? "auto" : "none"
                }}
              />
            )}

            {(el.kind === "IMAGE" || el.kind === "SIGN") && el.imageRef !== undefined && images[el.imageRef] && (
              <img
                src={images[el.imageRef].url}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", display: "block", objectFit: "fill", pointerEvents: "none" }}
              />
            )}

            {el.kind === "SHAPE" && (
              <svg width={w} height={h} style={{ overflow: "visible", pointerEvents: "none", display: "block" }}>
                {el.shapeKind === "RECTANGLE" && (
                  <rect
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    fill={el.filled ? el.color || "#171717" : "none"}
                    stroke={el.filled ? "none" : el.color || "#171717"}
                    strokeWidth={(el.strokeWidth || 2) * ptToPx}
                  />
                )}
                {el.shapeKind === "ELLIPSE" && (
                  <ellipse
                    cx={w / 2}
                    cy={h / 2}
                    rx={w / 2}
                    ry={h / 2}
                    fill={el.filled ? el.color || "#171717" : "none"}
                    stroke={el.filled ? "none" : el.color || "#171717"}
                    strokeWidth={(el.strokeWidth || 2) * ptToPx}
                  />
                )}
                {el.shapeKind === "LINE" && (
                  <line x1={0} y1={el.flipped ? h : 0} x2={w} y2={el.flipped ? 0 : h} stroke={el.color || "#171717"} strokeWidth={(el.strokeWidth || 2) * ptToPx} />
                )}
                {el.shapeKind === "ARROW" &&
                  (() => {
                    const a = arrowPoints(w, h, el.flipped);
                    return (
                      <>
                        <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={el.color || "#171717"} strokeWidth={(el.strokeWidth || 2) * ptToPx} />
                        <polygon points={a.head} fill={el.color || "#171717"} />
                      </>
                    );
                  })()}
                {el.shapeKind === "X_MARK" && (
                  <>
                    <line x1={w * 0.1} y1={h * 0.1} x2={w * 0.9} y2={h * 0.9} stroke={el.color || "#171717"} strokeWidth={(el.strokeWidth || 2) * ptToPx} strokeLinecap="round" />
                    <line x1={w * 0.9} y1={h * 0.1} x2={w * 0.1} y2={h * 0.9} stroke={el.color || "#171717"} strokeWidth={(el.strokeWidth || 2) * ptToPx} strokeLinecap="round" />
                  </>
                )}
                {el.shapeKind === "CHECK" && (
                  <polyline
                    points={`${w * 0.05},${h * 0.55} ${w * 0.35},${h * 0.9} ${w * 0.95},${h * 0.1}`}
                    fill="none"
                    stroke={el.color || "#171717"}
                    strokeWidth={(el.strokeWidth || 2) * ptToPx}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            )}

            {el.kind === "LINK" && (
              <>
                <LinkIcon size={12} /> {el.url || "Set a URL →"}
              </>
            )}

            {el.kind === "FORM_FIELD" && el.fieldKind === "CHECKBOX" && (el.checked ? "☑" : "☐")}
            {el.kind === "FORM_FIELD" && el.fieldKind === "RADIO" && (
              <>
                {el.checked ? "◉" : "○"} {el.optionValue || el.fieldName || "Option"}
              </>
            )}
            {el.kind === "FORM_FIELD" && el.fieldKind === "DROPDOWN" && (
              <>
                {el.fieldName || "Field"} <ChevronDown size={12} />
              </>
            )}
            {el.kind === "FORM_FIELD" && el.fieldKind === "TEXT_FIELD" && (el.fieldName || "Field")}

            {selected && (
              <button type="button" className="edit-element-remove" onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(el.id)} aria-label="Remove this element">
                <X size={13} />
              </button>
            )}
            {selected && el.kind !== "WHITEOUT" && el.kind !== "LINK" && el.kind !== "FORM_FIELD" && (
              <div className="edit-rotate-handle" onPointerDown={e => onStartRotate(e, el)} title="Drag to rotate" />
            )}
            {selected && <div className="edit-resize-handle" onPointerDown={e => onStartResize(e, el)} />}
          </div>
        );
      })}
    </>
  );
}
