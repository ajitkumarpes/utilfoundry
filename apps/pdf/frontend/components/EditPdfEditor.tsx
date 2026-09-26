"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Loader2 } from "lucide-react";
import { renderSinglePage, RenderedPage } from "@/lib/pdfPageRenderer";
import {
  ActiveTool,
  ClickToPlaceTool,
  EditElement,
  EditPoint,
  UploadedImage,
  isClickToPlaceTool,
  isDrawTool
} from "@/lib/editPdfTypes";
import EditPdfToolbar, { MAX_ZOOM, MIN_ZOOM } from "@/components/EditPdfToolbar";
import EditPdfPageRail from "@/components/EditPdfPageRail";
import EditPdfElementLayer from "@/components/EditPdfElementLayer";
import EditPdfInkLayer from "@/components/EditPdfInkLayer";
import EditPdfPropertiesPopover, { ReorderDirection } from "@/components/EditPdfPropertiesPopover";
import EditPdfSignDialog from "@/components/EditPdfSignDialog";

const BASE_RENDER_WIDTH = 780;
const MIN_BOX_PCT = 0.02;
const CANVAS_PADDING_PX = 56; // matches .edit-canvas-scroll's padding on each axis

export type EditPdfEditorHandle = {
  getElements: () => EditElement[];
  getImages: () => UploadedImage[];
};

type Props = {
  file: File;
  thumbnails: RenderedPage[];
  onApply: () => void;
  applying: boolean;
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `el-${Date.now()}-${Math.random()}`;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** A duplicate offset slightly down-right; ANNOTATE has no single xPct/yPct box, so its points
 *  shift instead. */
function cloneWithOffset(el: EditElement): EditElement {
  const id = uid();
  const offset = 0.02;
  if (el.kind === "ANNOTATE") {
    return { ...el, id, points: (el.points || []).map(p => ({ xPct: Math.min(1, p.xPct + offset), yPct: Math.min(1, p.yPct + offset) })) };
  }
  return { ...el, id, xPct: Math.min(1 - el.widthPct, el.xPct + offset), yPct: Math.min(1 - el.heightPct, el.yPct + offset) };
}

const EditPdfEditor = forwardRef<EditPdfEditorHandle, Props>(function EditPdfEditor({ file, thumbnails, onApply, applying }, ref) {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [mainPage, setMainPage] = useState<RenderedPage | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);

  const [elements, setElements] = useState<EditElement[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [history, setHistory] = useState<EditElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const clipboardRef = useRef<EditElement | null>(null);

  const dragState = useRef<{
    id: string;
    mode: "move" | "resize";
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    startWidthPct: number;
    startHeightPct: number;
  } | null>(null);
  const rotateState = useRef<{ id: string; centerClientX: number; centerClientY: number; startAngleDeg: number; startRotationDeg: number } | null>(null);
  const drawState = useRef<{ x0: number; y0: number } | null>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const strokeState = useRef<{ x: number; y: number }[] | null>(null);
  const [livePoints, setLivePoints] = useState<{ x: number; y: number }[] | null>(null);
  const moved = useRef(false);

  useImperativeHandle(ref, () => ({
    getElements: () => elements,
    getImages: () => images
  }));

  useEffect(() => {
    let cancelled = false;
    const targetWidth = BASE_RENDER_WIDTH * (zoomPct / 100);
    renderSinglePage(file, activePageIndex, targetWidth).then(page => {
      if (!cancelled) setMainPage(page);
    });
    return () => {
      cancelled = true;
    };
  }, [file, activePageIndex, zoomPct]);

  // A selected element's floating popover is positioned in the CURRENT page's coordinate space;
  // switching pages without clearing selection left a stale popover (for an element that isn't
  // even rendered on the new page) floating over whatever happened to be at the same on-screen
  // position. Deselecting on page change matches how most editors treat a page/slide switch.
  useEffect(() => {
    setSelectedId(null);
    setEditingTextId(null);
  }, [activePageIndex]);

  /** Functional update so two zoom clicks in the same event-loop tick (a real thing headless
   *  testing caught) both apply, instead of both reading the same pre-render zoomPct. */
  function changeZoom(delta: number) {
    setZoomPct(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }

  /**
   * "100%" means one PDF point per CSS pixel (pdf.js's own convention at its native scale), not
   * this editor's own BASE_RENDER_WIDTH default - so it is computed from the page's real point
   * size once known, not treated as a fixed zoomPct value.
   */
  function changeZoomFit(mode: "width" | "page" | "100") {
    if (!mainPage) return;
    const availW = (scrollRef.current?.clientWidth || BASE_RENDER_WIDTH + CANVAS_PADDING_PX * 2) - CANVAS_PADDING_PX * 2;
    const availH = (scrollRef.current?.clientHeight || 900) - CANVAS_PADDING_PX * 2;
    let targetRenderWidth: number;
    if (mode === "100") {
      targetRenderWidth = mainPage.pageWidthPt;
    } else if (mode === "width") {
      targetRenderWidth = availW;
    } else {
      const pageAspect = mainPage.pageWidthPt / mainPage.pageHeightPt;
      targetRenderWidth = Math.min(availW, availH * pageAspect);
    }
    setZoomPct(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((targetRenderWidth / BASE_RENDER_WIDTH) * 100))));
  }

  function commit(next: EditElement[]) {
    setElements(next);
    const truncated = history.slice(0, historyIndex + 1);
    const nextHistory = [...truncated, next];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }

  function undo() {
    if (historyIndex === 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    setElements(history[idx]);
    setSelectedId(null);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    setElements(history[idx]);
    setSelectedId(null);
  }

  function removeElement(id: string) {
    commit(elements.filter(el => el.id !== id));
    if (id === selectedId) setSelectedId(null);
  }

  function updateSelected(patch: Partial<EditElement>) {
    if (!selectedId) return;
    commit(elements.map(el => (el.id === selectedId ? { ...el, ...patch } : el)));
  }

  function duplicateElement(id: string) {
    const el = elements.find(x => x.id === id);
    if (!el) return;
    const clone = cloneWithOffset(el);
    commit([...elements, clone]);
    setSelectedId(clone.id);
  }

  function reorderElement(id: string, direction: ReorderDirection) {
    const idx = elements.findIndex(el => el.id === id);
    if (idx === -1) return;
    const next = [...elements];
    const [item] = next.splice(idx, 1);
    if (direction === "front") next.push(item);
    else if (direction === "back") next.unshift(item);
    else if (direction === "forward") next.splice(Math.min(next.length, idx + 1), 0, item);
    else next.splice(Math.max(0, idx - 1), 0, item);
    commit(next);
  }

  function moveSelectedBy(dxPct: number, dyPct: number) {
    if (!selectedId) return;
    const el = elements.find(x => x.id === selectedId);
    if (!el || el.kind === "ANNOTATE") return;
    const nextX = clamp01(Math.min(1 - el.widthPct, Math.max(0, el.xPct + dxPct)));
    const nextY = clamp01(Math.min(1 - el.heightPct, Math.max(0, el.yPct + dyPct)));
    commit(elements.map(x => (x.id === selectedId ? { ...x, xPct: nextX, yPct: nextY } : x)));
  }

  /** Live-typing update with no history entry per keystroke; commitPending() on blur. */
  function updateLive(id: string, patch: Partial<EditElement>) {
    setElements(prev => prev.map(el => (el.id === id ? { ...el, ...patch } : el)));
  }

  function commitPending() {
    commit(elements);
    setEditingTextId(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const typing = tag === "textarea" || tag === "input";
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        e.preventDefault();
        redo();
      } else if (!typing && (e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeElement(selectedId);
      } else if (e.key === "Escape") {
        setActiveTool("select");
        setSelectedId(null);
      } else if (!typing && mod && key === "d" && selectedId) {
        e.preventDefault();
        duplicateElement(selectedId);
      } else if (!typing && mod && key === "c" && selectedId) {
        const el = elements.find(x => x.id === selectedId);
        if (el) clipboardRef.current = el;
      } else if (!typing && mod && key === "x" && selectedId) {
        const el = elements.find(x => x.id === selectedId);
        if (el) {
          clipboardRef.current = el;
          removeElement(selectedId);
        }
      } else if (!typing && mod && key === "v" && clipboardRef.current) {
        e.preventDefault();
        const clone = cloneWithOffset({ ...clipboardRef.current, pageIndex: activePageIndex });
        commit([...elements, clone]);
        setSelectedId(clone.id);
      } else if (!typing && selectedId && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") && mainPage) {
        e.preventDefault();
        const stepPx = e.shiftKey ? 10 : 1;
        const dxPct = (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0) * (stepPx / mainPage.renderWidth);
        const dyPct = (e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0) * (stepPx / mainPage.renderHeight);
        moveSelectedBy(dxPct, dyPct);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, history, historyIndex, selectedId, mainPage, activePageIndex]);

  function nextFieldName() {
    const count = elements.filter(el => el.kind === "FORM_FIELD").length;
    return `Field ${count + 1}`;
  }

  /** Each click makes its own radio group by default ("Radio group 1", "Radio group 2", ...) -
   *  to put two buttons in the same group, give them the same group name in the properties
   *  popover afterward, same as renaming any other field. */
  function nextRadioGroupName() {
    const groups = new Set(elements.filter(el => el.kind === "FORM_FIELD" && el.fieldKind === "RADIO").map(el => el.fieldName));
    return `Radio group ${groups.size + 1}`;
  }

  // ---- click-to-place: text, link, form fields, stamps --------------------------------------

  function placeAtClick(tool: ClickToPlaceTool, xPct: number, yPct: number) {
    if (!mainPage) return;
    const pageAspect = mainPage.renderWidth / mainPage.renderHeight;
    const id = uid();
    let base: Omit<EditElement, "id">;

    switch (tool) {
      case "text":
        base = { kind: "TEXT", pageIndex: activePageIndex, xPct, yPct, widthPct: 0.35, heightPct: 0.08, text: "", fontSize: 16, color: "#171717" };
        break;
      case "link":
        base = { kind: "LINK", pageIndex: activePageIndex, xPct, yPct, widthPct: 0.22, heightPct: 0.045, url: "" };
        break;
      case "form-text":
        base = { kind: "FORM_FIELD", pageIndex: activePageIndex, xPct, yPct, widthPct: 0.28, heightPct: 0.04, fieldKind: "TEXT_FIELD", fieldName: nextFieldName() };
        break;
      case "form-text-multiline":
        base = { kind: "FORM_FIELD", pageIndex: activePageIndex, xPct, yPct, widthPct: 0.28, heightPct: 0.12, fieldKind: "TEXT_FIELD", multiline: true, fieldName: nextFieldName() };
        break;
      case "form-checkbox": {
        const w = 0.03;
        base = { kind: "FORM_FIELD", pageIndex: activePageIndex, xPct, yPct, widthPct: w, heightPct: w * pageAspect, fieldKind: "CHECKBOX", fieldName: nextFieldName() };
        break;
      }
      case "form-radio": {
        const w = 0.025;
        base = {
          kind: "FORM_FIELD",
          pageIndex: activePageIndex,
          xPct,
          yPct,
          widthPct: w,
          heightPct: w * pageAspect,
          fieldKind: "RADIO",
          fieldName: nextRadioGroupName(),
          optionValue: "Option 1"
        };
        break;
      }
      case "form-dropdown":
        base = {
          kind: "FORM_FIELD",
          pageIndex: activePageIndex,
          xPct,
          yPct,
          widthPct: 0.28,
          heightPct: 0.04,
          fieldKind: "DROPDOWN",
          fieldName: nextFieldName(),
          options: ["Option 1", "Option 2"]
        };
        break;
      case "stamp-x":
        base = { kind: "SHAPE", pageIndex: activePageIndex, xPct, yPct, widthPct: 0.05, heightPct: 0.03 * pageAspect, shapeKind: "X_MARK", color: "#dc2626", strokeWidth: 3 };
        break;
      case "stamp-check":
        base = { kind: "SHAPE", pageIndex: activePageIndex, xPct, yPct, widthPct: 0.05, heightPct: 0.03 * pageAspect, shapeKind: "CHECK", color: "#16a34a", strokeWidth: 3 };
        break;
      case "stamp-dot": {
        const w = 0.02;
        base = { kind: "SHAPE", pageIndex: activePageIndex, xPct, yPct, widthPct: w, heightPct: w * pageAspect, shapeKind: "ELLIPSE", color: "#171717", strokeWidth: 2, filled: true };
        break;
      }
    }

    const clampedX = Math.min(1 - base.widthPct, Math.max(0, base.xPct));
    const clampedY = Math.min(1 - base.heightPct, Math.max(0, base.yPct));
    commit([...elements, { id, ...base, xPct: clampedX, yPct: clampedY }]);
    setSelectedId(id);
    // Deliberately not auto-entering edit mode for a freshly placed TEXT element: while editing,
    // the textarea has to own pointerdown (so clicking positions the cursor instead of starting a
    // drag), which meant a text box placed via this path could never be dragged until you first
    // clicked away from it - the exact bug reported here. Every element type (text included) is
    // now selected-and-draggable immediately after placement; the placeholder text below already
    // tells you to double-click to type.
    setActiveTool("select");
  }

  // ---- image / sign placement -----------------------------------------------------------------

  function placeImage(tool: "image" | "sign", imageInfo: { imageRef: number; naturalW: number; naturalH: number }) {
    if (!mainPage) return;
    const pageAspect = mainPage.renderWidth / mainPage.renderHeight;
    const w = tool === "sign" ? 0.28 : 0.25;
    const naturalAspect = imageInfo.naturalH / imageInfo.naturalW;
    const h = Math.min(0.8, w * naturalAspect * pageAspect);
    const id = uid();
    commit([
      ...elements,
      {
        id,
        kind: tool === "sign" ? "SIGN" : "IMAGE",
        pageIndex: activePageIndex,
        xPct: 0.5 - w / 2,
        yPct: 0.5 - h / 2,
        widthPct: w,
        heightPct: h,
        imageRef: imageInfo.imageRef
      }
    ]);
    setSelectedId(id);
    setActiveTool("select");
  }

  /** Registers `blob` as an uploaded image and centers it on the page - shared by the Image
   *  tool's plain file input and the Sign tool's dialog (drawn signatures arrive as a Blob with
   *  no File/input event behind them, so this takes a Blob directly rather than a FileList). */
  function addImageAndPlace(tool: "image" | "sign", blob: Blob) {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const imageRef = images.length;
      setImages(prev => [...prev, { file: blob, url }]);
      placeImage(tool, { imageRef, naturalW: img.naturalWidth, naturalH: img.naturalHeight });
    };
    img.src = url;
  }

  function onImageFileChosen(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (picked) addImageAndPlace("image", picked);
  }

  function onSignatureReady(blob: Blob) {
    setSignDialogOpen(false);
    addImageAndPlace("sign", blob);
  }

  function onToolClick(tool: ActiveTool) {
    if (tool === "image") {
      imageInputRef.current?.click();
      return;
    }
    if (tool === "sign") {
      setSelectedId(null);
      setSignDialogOpen(true);
      return;
    }
    setSelectedId(null);
    setActiveTool(tool);
  }

  // ---- element drag / resize / rotate ---------------------------------------------------------

  function onElementStartMove(e: ReactPointerEvent, el: EditElement) {
    // While this exact element is being edited, its textarea is the one child with real pointer
    // events (see EditPdfElementLayer) specifically so a click there places the text cursor
    // normally - starting a drag here too would call preventDefault() and swallow that click.
    if (el.kind === "TEXT" && editingTextId === el.id) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    // Interacting with a different element while one is mid-edit needs that edit committed and
    // blurred first - React setting pointer-events back to "none" next render does not itself
    // move focus away from an already-focused textarea.
    if (editingTextId && editingTextId !== el.id) {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setSelectedId(el.id);
    moved.current = false;
    dragState.current = {
      id: el.id,
      mode: "move",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startXPct: el.xPct,
      startYPct: el.yPct,
      startWidthPct: el.widthPct,
      startHeightPct: el.heightPct
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onElementStartResize(e: ReactPointerEvent, el: EditElement) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(el.id);
    moved.current = false;
    dragState.current = {
      id: el.id,
      mode: "resize",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startXPct: el.xPct,
      startYPct: el.yPct,
      startWidthPct: el.widthPct,
      startHeightPct: el.heightPct
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onElementStartRotate(e: ReactPointerEvent, el: EditElement) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(el.id);
    if (!mainPage || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerClientX = rect.left + (el.xPct + el.widthPct / 2) * mainPage.renderWidth;
    const centerClientY = rect.top + (el.yPct + el.heightPct / 2) * mainPage.renderHeight;
    moved.current = false;
    rotateState.current = {
      id: el.id,
      centerClientX,
      centerClientY,
      startAngleDeg: (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) / Math.PI,
      startRotationDeg: el.rotationDeg || 0
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onCanvasPointerMove(e: ReactPointerEvent) {
    if (!mainPage) return;

    const rotate = rotateState.current;
    if (rotate) {
      moved.current = true;
      const currentAngleDeg = (Math.atan2(e.clientY - rotate.centerClientY, e.clientX - rotate.centerClientX) * 180) / Math.PI;
      const nextRotation = rotate.startRotationDeg + (currentAngleDeg - rotate.startAngleDeg);
      setElements(prev => prev.map(el => (el.id === rotate.id ? { ...el, rotationDeg: nextRotation } : el)));
      return;
    }

    const drag = dragState.current;
    if (drag) {
      moved.current = true;
      const dxPct = (e.clientX - drag.startClientX) / mainPage.renderWidth;
      const dyPct = (e.clientY - drag.startClientY) / mainPage.renderHeight;
      if (drag.mode === "move") {
        const nextX = clamp01(Math.min(1 - drag.startWidthPct, Math.max(0, drag.startXPct + dxPct)));
        const nextY = clamp01(Math.min(1 - drag.startHeightPct, Math.max(0, drag.startYPct + dyPct)));
        setElements(prev => prev.map(el => (el.id === drag.id ? { ...el, xPct: nextX, yPct: nextY } : el)));
      } else {
        const nextW = Math.max(MIN_BOX_PCT, Math.min(1 - drag.startXPct, drag.startWidthPct + dxPct));
        const nextH = Math.max(MIN_BOX_PCT, Math.min(1 - drag.startYPct, drag.startHeightPct + dyPct));
        setElements(prev => prev.map(el => (el.id === drag.id ? { ...el, widthPct: nextW, heightPct: nextH } : el)));
      }
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawTool(activeTool) && drawState.current) {
      setDraft({ x0: drawState.current.x0, y0: drawState.current.y0, x1: x, y1: y });
    } else if (activeTool === "annotate" && strokeState.current) {
      strokeState.current.push({ x, y });
      setLivePoints([...strokeState.current]);
    }
  }

  function onCanvasPointerUp() {
    if (!mainPage) return;

    if (rotateState.current) {
      if (moved.current) commit(elements);
      rotateState.current = null;
      return;
    }

    if (dragState.current) {
      if (moved.current) commit(elements);
      dragState.current = null;
      return;
    }

    if (isDrawTool(activeTool) && drawState.current && draft) {
      const x0 = Math.min(draft.x0, draft.x1);
      const y0 = Math.min(draft.y0, draft.y1);
      const w = Math.abs(draft.x1 - draft.x0);
      const h = Math.abs(draft.y1 - draft.y0);
      const flipped = (draft.x1 - draft.x0) * (draft.y1 - draft.y0) < 0;
      drawState.current = null;
      setDraft(null);

      // A rectangle/ellipse/whiteout drawn smaller than 8px in EITHER axis is almost certainly an
      // accidental click, not a deliberate shape - but that same test rejects a perfectly
      // horizontal or vertical Line/Arrow outright, since one of its two axes is legitimately
      // near zero by construction. Those two need a single length threshold along the diagonal
      // instead of requiring both axes independently.
      const isLineLike = activeTool === "shape-line" || activeTool === "shape-arrow";
      const bigEnough = isLineLike ? Math.hypot(w, h) >= 8 : w >= 8 && h >= 8;

      if (bigEnough) {
        const id = uid();
        const box = { xPct: x0 / mainPage.renderWidth, yPct: y0 / mainPage.renderHeight, widthPct: w / mainPage.renderWidth, heightPct: h / mainPage.renderHeight };
        const shapeKind = activeTool === "shape-rectangle" ? "RECTANGLE" : activeTool === "shape-ellipse" ? "ELLIPSE" : activeTool === "shape-arrow" ? "ARROW" : "LINE";
        const newElement: EditElement =
          activeTool === "whiteout"
            ? { id, kind: "WHITEOUT", pageIndex: activePageIndex, ...box }
            : {
                id,
                kind: "SHAPE",
                pageIndex: activePageIndex,
                ...box,
                shapeKind,
                color: "#171717",
                strokeWidth: 2,
                filled: activeTool === "shape-ellipse",
                flipped: shapeKind === "LINE" || shapeKind === "ARROW" ? flipped : undefined
              };
        commit([...elements, newElement]);
        setSelectedId(id);
      }
      setActiveTool("select");
      return;
    }

    if (activeTool === "annotate" && strokeState.current) {
      const points: EditPoint[] = strokeState.current.map(p => ({ xPct: p.x / mainPage.renderWidth, yPct: p.y / mainPage.renderHeight }));
      strokeState.current = null;
      setLivePoints(null);
      if (points.length >= 2) {
        commit([...elements, { id: uid(), kind: "ANNOTATE", pageIndex: activePageIndex, xPct: 0, yPct: 0, widthPct: 0, heightPct: 0, color: "#dc2626", strokeWidth: 3, points }]);
      }
      // Annotate stays active for continuous strokes; Select or Escape exits it.
    }
  }

  function onCanvasPointerDown(e: ReactPointerEvent) {
    if (!mainPage) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Placing a TEXT element focuses its textarea (autoFocus) in the same synchronous update
    // this handler triggers - but without this, the browser's own default mousedown behavior
    // (uninterrupted, since nothing here called preventDefault) then shifts focus back to
    // whatever was actually clicked, immediately blurring that textarea and discarding the
    // freshly-set editingTextId before the next paint. The other onStart* handlers already
    // preventDefault(); this one needs it just as much, for the same reason.
    e.preventDefault();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawTool(activeTool)) {
      drawState.current = { x0: x, y0: y };
      setDraft({ x0: x, y0: y, x1: x, y1: y });
    } else if (activeTool === "annotate") {
      strokeState.current = [{ x, y }];
      setLivePoints([{ x, y }]);
    } else if (isClickToPlaceTool(activeTool)) {
      placeAtClick(activeTool, x / mainPage.renderWidth, y / mainPage.renderHeight);
    } else if (activeTool === "select") {
      setSelectedId(null);
    }
  }

  const pageElements = elements.filter(el => el.pageIndex === activePageIndex && el.kind !== "ANNOTATE");
  const pageStrokes = elements.filter(el => el.pageIndex === activePageIndex && el.kind === "ANNOTATE");
  const selected = elements.find(el => el.id === selectedId) || null;
  const ptToPx = mainPage ? mainPage.renderWidth / mainPage.pageWidthPt : 1;

  const countsByPage: Record<number, number> = {};
  for (const el of elements) countsByPage[el.pageIndex] = (countsByPage[el.pageIndex] || 0) + 1;

  function popoverAnchor() {
    if (!selected || !mainPage) return null;
    if (selected.kind === "ANNOTATE") {
      const pts = selected.points || [];
      if (pts.length === 0) return null;
      const xs = pts.map(p => p.xPct);
      const ys = pts.map(p => p.yPct);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return {
        left: minX * mainPage.renderWidth,
        top: minY * mainPage.renderHeight,
        width: (Math.max(...xs) - minX) * mainPage.renderWidth,
        height: (Math.max(...ys) - minY) * mainPage.renderHeight
      };
    }
    return {
      left: selected.xPct * mainPage.renderWidth,
      top: selected.yPct * mainPage.renderHeight,
      width: selected.widthPct * mainPage.renderWidth,
      height: selected.heightPct * mainPage.renderHeight
    };
  }
  const anchor = popoverAnchor();

  return (
    <div className="edit-page-shell">
      <EditPdfToolbar
        activeTool={activeTool}
        onToolClick={onToolClick}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        zoomPct={zoomPct}
        onZoomChange={changeZoom}
        onZoomFit={changeZoomFit}
        onApply={onApply}
        applying={applying}
        hasElements={elements.length > 0}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={e => {
          onImageFileChosen(e.target.files);
          e.target.value = "";
        }}
      />

      <EditPdfSignDialog open={signDialogOpen} onConfirm={onSignatureReady} onClose={() => setSignDialogOpen(false)} />

      <div className="edit-body">
        <EditPdfPageRail
          thumbnails={thumbnails}
          activePageIndex={activePageIndex}
          onSelectPage={setActivePageIndex}
          countsByPage={countsByPage}
          collapsed={railCollapsed}
          onToggleCollapsed={() => setRailCollapsed(prev => !prev)}
        />

        <div className="edit-canvas-scroll" ref={scrollRef}>
          {!mainPage && (
            <div style={{ margin: "auto" }}>
              <Loader2 size={28} className="spin" />
            </div>
          )}
          {mainPage && (
            <div
              ref={canvasRef}
              className={`edit-canvas-wrap tool-${activeTool}`}
              style={{ width: mainPage.renderWidth, height: mainPage.renderHeight }}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerLeave={onCanvasPointerUp}
            >
              <img className="edit-page-img" src={mainPage.dataUrl} alt={`Page ${activePageIndex + 1} preview`} draggable={false} />

              <EditPdfInkLayer mainPage={mainPage} strokes={pageStrokes} livePoints={livePoints} ptToPx={ptToPx} selectedId={selectedId} onSelectStroke={setSelectedId} />

              <EditPdfElementLayer
                mainPage={mainPage}
                elements={pageElements}
                images={images}
                selectedId={selectedId}
                editingTextId={editingTextId}
                ptToPx={ptToPx}
                onStartMove={onElementStartMove}
                onStartResize={onElementStartResize}
                onStartRotate={onElementStartRotate}
                onRemove={removeElement}
                onStartEditingText={id => {
                  setSelectedId(id);
                  setEditingTextId(id);
                }}
                onTextChange={(id, text) => updateLive(id, { text })}
                onTextBlur={commitPending}
              />

              {draft && isDrawTool(activeTool) && (
                <div
                  className="redact-draft"
                  style={{
                    left: Math.min(draft.x0, draft.x1),
                    top: Math.min(draft.y0, draft.y1),
                    width: Math.abs(draft.x1 - draft.x0),
                    height: Math.abs(draft.y1 - draft.y0)
                  }}
                />
              )}

              {selected && anchor && (
                <EditPdfPropertiesPopover
                  element={selected}
                  anchor={anchor}
                  containerWidth={mainPage.renderWidth}
                  containerHeight={mainPage.renderHeight}
                  onChange={updateSelected}
                  onDelete={() => removeElement(selected.id)}
                  onDuplicate={() => duplicateElement(selected.id)}
                  onReorder={direction => reorderElement(selected.id, direction)}
                  onClose={() => setSelectedId(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default EditPdfEditor;
