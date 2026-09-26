"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { RenderedPage } from "@/lib/pdfPageRenderer";

type Props = {
  thumbnails: RenderedPage[];
  activePageIndex: number;
  onSelectPage: (pageIndex: number) => void;
  countsByPage: Record<number, number>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export default function EditPdfPageRail({ thumbnails, activePageIndex, onSelectPage, countsByPage, collapsed, onToggleCollapsed }: Props) {
  if (thumbnails.length < 2) return null;

  if (collapsed) {
    return (
      <div className="edit-page-rail edit-page-rail-collapsed">
        <button type="button" className="edit-rail-toggle" onClick={onToggleCollapsed} title="Show page thumbnails" aria-label="Show page thumbnails">
          <PanelLeftOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="edit-page-rail">
      <button type="button" className="edit-rail-toggle" onClick={onToggleCollapsed} title="Hide page thumbnails" aria-label="Hide page thumbnails">
        <PanelLeftClose size={16} />
      </button>
      {thumbnails.map(page => {
        const count = countsByPage[page.pageIndex] || 0;
        return (
          <button
            key={page.pageIndex}
            type="button"
            className={`edit-rail-thumb${page.pageIndex === activePageIndex ? " active" : ""}`}
            onClick={() => onSelectPage(page.pageIndex)}
          >
            <img src={page.dataUrl} alt={`Page ${page.pageIndex + 1}`} />
            <span className="rail-page-num">{page.pageIndex + 1}</span>
            {count > 0 && <span className="rail-badge">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
