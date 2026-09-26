"use client";

import type { RenderedPage } from "@/lib/pdfPageRenderer";
import { EditElement } from "@/lib/editPdfTypes";

type ScreenPoint = { x: number; y: number };

type Props = {
  mainPage: RenderedPage;
  strokes: EditElement[];
  livePoints: ScreenPoint[] | null;
  ptToPx: number;
  selectedId: string | null;
  onSelectStroke: (id: string) => void;
};

/** Committed freehand strokes plus the one currently being drawn, as one SVG overlay. */
export default function EditPdfInkLayer({ mainPage, strokes, livePoints, ptToPx, selectedId, onSelectStroke }: Props) {
  const px = (pct: number) => pct * mainPage.renderWidth;
  const py = (pct: number) => pct * mainPage.renderHeight;

  return (
    <svg className="edit-ink-layer" width={mainPage.renderWidth} height={mainPage.renderHeight}>
      {strokes.map(el => (
        <polyline
          key={el.id}
          points={(el.points || []).map(p => `${px(p.xPct)},${py(p.yPct)}`).join(" ")}
          fill="none"
          stroke={el.color || "#dc2626"}
          strokeWidth={(el.strokeWidth || 3) * ptToPx}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: el.id === selectedId ? "none" : "stroke", cursor: "pointer" }}
          onPointerDown={e => {
            e.stopPropagation();
            onSelectStroke(el.id);
          }}
        />
      ))}
      {livePoints && livePoints.length > 1 && (
        <polyline
          points={livePoints.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#dc2626"
          strokeWidth={3 * ptToPx}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
