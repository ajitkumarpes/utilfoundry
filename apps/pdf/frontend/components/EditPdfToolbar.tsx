"use client";

import {
  AlignLeft,
  ArrowUpRight,
  Check,
  ChevronDown as ChevronDownIcon,
  Circle,
  CircleDot,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Minus,
  MousePointer2,
  PenLine,
  Redo2,
  Square,
  SquareCheck,
  TextCursorInput,
  Undo2,
  X as XIcon,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type { ActiveTool } from "@/lib/editPdfTypes";
import EditPdfToolDropdown from "@/components/EditPdfToolDropdown";

export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

type Props = {
  activeTool: ActiveTool;
  onToolClick: (tool: ActiveTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoomPct: number;
  onZoomChange: (delta: number) => void;
  onZoomFit: (mode: "width" | "page" | "100") => void;
  onApply: () => void;
  applying: boolean;
  hasElements: boolean;
};

export default function EditPdfToolbar({
  activeTool,
  onToolClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoomPct,
  onZoomChange,
  onZoomFit,
  onApply,
  applying,
  hasElements
}: Props) {
  return (
    <div className="edit-toolbar-bar">
      <div className="edit-toolbar-tools">
        <button type="button" className={`edit-tool-btn${activeTool === "select" ? " active" : ""}`} onClick={() => onToolClick("select")} title="Select and move (Esc)">
          <MousePointer2 size={16} /> Select
        </button>
        <div className="edit-tool-sep" />
        <button type="button" className={`edit-tool-btn${activeTool === "text" ? " active" : ""}`} onClick={() => onToolClick("text")} title="Click on the page to add text">
          <span style={{ fontWeight: 800, fontSize: 15, width: 16, textAlign: "center" }}>T</span> Text
        </button>
        <button type="button" className={`edit-tool-btn${activeTool === "image" ? " active" : ""}`} onClick={() => onToolClick("image")} title="Add an image">
          <ImageIcon size={16} /> Image
        </button>
        <button type="button" className={`edit-tool-btn${activeTool === "sign" ? " active" : ""}`} onClick={() => onToolClick("sign")} title="Add a signature image">
          <PenLine size={16} /> Sign
        </button>
        <div className="edit-tool-sep" />
        <EditPdfToolDropdown
          label="Shapes"
          activeTool={activeTool}
          onToolClick={onToolClick}
          options={[
            { tool: "shape-rectangle", label: "Rectangle", icon: <Square size={15} />, title: "Drag to draw a rectangle" },
            { tool: "shape-ellipse", label: "Ellipse", icon: <Circle size={15} />, title: "Drag to draw an ellipse" },
            { tool: "shape-line", label: "Line", icon: <Minus size={15} />, title: "Drag to draw a line" },
            { tool: "shape-arrow", label: "Arrow", icon: <ArrowUpRight size={15} />, title: "Drag to draw an arrow" }
          ]}
        />
        <div className="edit-tool-sep" />
        <button type="button" className={`edit-tool-btn${activeTool === "whiteout" ? " active" : ""}`} onClick={() => onToolClick("whiteout")} title="Drag to cover an area">
          <Square size={16} /> Whiteout
        </button>
        <button type="button" className={`edit-tool-btn${activeTool === "annotate" ? " active" : ""}`} onClick={() => onToolClick("annotate")} title="Draw freehand">
          <PenLine size={16} /> Annotate
        </button>
        <div className="edit-tool-sep" />
        <button type="button" className={`edit-tool-btn${activeTool === "link" ? " active" : ""}`} onClick={() => onToolClick("link")} title="Click on the page to add a link">
          <LinkIcon size={16} /> Link
        </button>
        <EditPdfToolDropdown
          label="Forms"
          activeTool={activeTool}
          onToolClick={onToolClick}
          options={[
            { tool: "stamp-x", label: "X mark", icon: <XIcon size={15} />, title: "Click to stamp an X mark", group: "Add text and symbols" },
            { tool: "stamp-check", label: "Checkmark", icon: <Check size={15} />, title: "Click to stamp a checkmark", group: "Add text and symbols" },
            { tool: "stamp-dot", label: "Dot", icon: <Circle size={15} />, title: "Click to stamp a filled dot", group: "Add text and symbols" },
            { tool: "form-text", label: "Text field", icon: <TextCursorInput size={15} />, title: "Click to add a fillable text field", group: "Add new form fields" },
            { tool: "form-text-multiline", label: "Text field (multiline)", icon: <AlignLeft size={15} />, title: "Click to add a multi-line text field", group: "Add new form fields" },
            { tool: "form-dropdown", label: "Dropdown", icon: <ChevronDownIcon size={15} />, title: "Click to add a dropdown list", group: "Add new form fields" },
            { tool: "form-radio", label: "Radio button", icon: <CircleDot size={15} />, title: "Click to add a radio button", group: "Add new form fields" },
            { tool: "form-checkbox", label: "Checkbox", icon: <SquareCheck size={15} />, title: "Click to add a checkbox", group: "Add new form fields" }
          ]}
        />
      </div>

      <div className="edit-toolbar-actions">
        <button type="button" className="edit-tool-btn" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl/Cmd+Z)">
          <Undo2 size={16} />
        </button>
        <button type="button" className="edit-tool-btn" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
          <Redo2 size={16} />
        </button>

        <div className="edit-zoom">
          <button type="button" disabled={zoomPct <= MIN_ZOOM} onClick={() => onZoomChange(-ZOOM_STEP)} aria-label="Zoom out">
            <ZoomOut size={14} />
          </button>
          <span>{zoomPct}%</span>
          <button type="button" disabled={zoomPct >= MAX_ZOOM} onClick={() => onZoomChange(ZOOM_STEP)} aria-label="Zoom in">
            <ZoomIn size={14} />
          </button>
        </div>
        <div className="edit-zoom-fit">
          <button type="button" onClick={() => onZoomFit("width")} title="Fit page width to the window">
            Width
          </button>
          <button type="button" onClick={() => onZoomFit("page")} title="Fit the whole page in the window">
            Page
          </button>
          <button type="button" onClick={() => onZoomFit("100")} title="Actual size">
            100%
          </button>
        </div>

        <button type="button" className="primary-btn" disabled={applying || !hasElements} onClick={onApply}>
          {applying ? (
            <>
              <Loader2 size={16} className="spin" /> Applying…
            </>
          ) : (
            "Apply changes"
          )}
        </button>
      </div>
    </div>
  );
}
