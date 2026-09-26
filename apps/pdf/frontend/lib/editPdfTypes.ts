/**
 * One placed element on the /tools/edit-pdf canvas. Field names mirror the backend's
 * EditElement record exactly (percent coordinates, top-left origin) so building the request
 * body is a direct map, not a translation.
 */
export type EditElementKind =
  | "TEXT"
  | "IMAGE"
  | "SIGN"
  | "SHAPE"
  | "WHITEOUT"
  | "LINK"
  | "FORM_FIELD"
  | "ANNOTATE";

export type ShapeKind = "RECTANGLE" | "LINE" | "ELLIPSE" | "ARROW" | "X_MARK" | "CHECK";
export type FieldKind = "TEXT_FIELD" | "CHECKBOX" | "RADIO" | "DROPDOWN";

export type EditPoint = { xPct: number; yPct: number };

export type EditElement = {
  id: string;
  kind: EditElementKind;
  pageIndex: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  /** Degrees clockwise around the box's own center; every kind except ANNOTATE. */
  rotationDeg?: number;
  /** 0-1; every kind except ANNOTATE. Undefined/1 = fully opaque. */
  opacity?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  imageRef?: number;
  shapeKind?: ShapeKind;
  strokeWidth?: number;
  filled?: boolean;
  /** shapeKind LINE only: which diagonal of the box was actually dragged. */
  flipped?: boolean;
  url?: string;
  fieldKind?: FieldKind;
  fieldName?: string;
  /** FORM_FIELD with fieldKind=TEXT_FIELD only. */
  multiline?: boolean;
  /** FORM_FIELD with fieldKind=RADIO only: this option's export value - every element sharing
   *  the same fieldName forms one radio group, same as the backend. */
  optionValue?: string;
  /** FORM_FIELD with fieldKind=RADIO or CHECKBOX only: whether it starts selected/checked. */
  checked?: boolean;
  /** FORM_FIELD with fieldKind=DROPDOWN only. */
  options?: string[];
  points?: EditPoint[];
};

/** Click once on the page at the cursor to drop a small default-sized box there. */
export type ClickToPlaceTool =
  | "text"
  | "link"
  | "form-text"
  | "form-text-multiline"
  | "form-checkbox"
  | "form-radio"
  | "form-dropdown"
  | "stamp-x"
  | "stamp-check"
  | "stamp-dot";

/** Click-and-drag defines the box directly, same interaction as the Redact tool's draw boxes. */
export type DrawTool = "shape-rectangle" | "shape-line" | "shape-ellipse" | "shape-arrow" | "whiteout";

/**
 * "image" opens a plain file picker; "sign" opens the same draw-or-upload dialog as the
 * standalone Sign PDF tool. They used to share one handler (both were "pick a file, then place
 * it centered"), but they diverge enough now - one file input, one modal - that a shared type
 * guard would hide more than it explained; EditPdfEditor's onToolClick branches on the two
 * literals directly instead.
 */
export type PlacementTool = ClickToPlaceTool | DrawTool | "image" | "sign";

export type ActiveTool = "select" | "annotate" | PlacementTool;

/** What the server needs to resolve an element's imageRef back to real bytes. */
export type UploadedImage = { file: File | Blob; url: string };

const CLICK_TO_PLACE: ReadonlySet<string> = new Set<ClickToPlaceTool>([
  "text",
  "link",
  "form-text",
  "form-text-multiline",
  "form-checkbox",
  "form-radio",
  "form-dropdown",
  "stamp-x",
  "stamp-check",
  "stamp-dot"
]);
const DRAW: ReadonlySet<string> = new Set<DrawTool>(["shape-rectangle", "shape-line", "shape-ellipse", "shape-arrow", "whiteout"]);

export function isClickToPlaceTool(tool: ActiveTool): tool is ClickToPlaceTool {
  return CLICK_TO_PLACE.has(tool);
}

export function isDrawTool(tool: ActiveTool): tool is DrawTool {
  return DRAW.has(tool);
}
