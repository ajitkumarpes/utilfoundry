"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { ActiveTool } from "@/lib/editPdfTypes";

type Option = { tool: ActiveTool; label: string; icon: ReactNode; title: string; group?: string };

type Props = {
  label: string;
  options: Option[];
  activeTool: ActiveTool;
  onToolClick: (tool: ActiveTool) => void;
};

/**
 * A toolbar button that expands into a small menu of related tools - e.g. Rectangle/Ellipse/
 * Line/Arrow under one "Shapes" entry, or the Forms menu's text/symbol stamps and form fields,
 * rather than many separate buttons competing for space with everything else in the bar. An
 * option's optional `group` renders a small heading above it whenever it differs from the
 * previous option's group, so a flat options array can still read as sectioned menu.
 *
 * The button's own icon tracks whichever option was picked last (defaulting to the first one),
 * rather than staying fixed on one option's icon regardless of what's actually selected -
 * clicking "Shapes" while Line is the last thing you drew should look like Line, not Rectangle.
 */
export default function EditPdfToolDropdown({ label, options, activeTool, onToolClick }: Props) {
  const [open, setOpen] = useState(false);
  const [lastOption, setLastOption] = useState<Option>(options[0]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isActive = options.some(o => o.tool === activeTool);
  const displayedIcon = options.find(o => o.tool === activeTool)?.icon ?? lastOption.icon;

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  return (
    <div className="edit-tool-dropdown-wrap" ref={containerRef}>
      <button type="button" className={`edit-tool-btn${isActive ? " active" : ""}`} onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open}>
        {displayedIcon} {label} <ChevronDown size={13} />
      </button>
      {open && (
        <div className="edit-tool-dropdown-menu" role="menu">
          {options.map((o, i) => (
            <div key={o.tool}>
              {o.group && o.group !== options[i - 1]?.group && <div className="edit-tool-dropdown-heading">{o.group}</div>}
              <button
                type="button"
                role="menuitem"
                className={`edit-tool-dropdown-item${activeTool === o.tool ? " active" : ""}`}
                title={o.title}
                onClick={() => {
                  onToolClick(o.tool);
                  setLastOption(o);
                  setOpen(false);
                }}
              >
                {o.icon} {o.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
