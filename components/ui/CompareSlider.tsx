"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

type Side = { src: string; alt: string; label: string; meta?: string };

/**
 * Before/after with a draggable divider: `before` shows to the left of the
 * handle, `after` to the right. Both must share an aspect ratio.
 */
export function CompareSlider({ before, after, transparent = false }: { before: Side; after: Side; transparent?: boolean }) {
  const [split, setSplit] = useState(50);
  return (
    <div className={`slider-stage ${transparent ? "checkerboard" : ""}`}>
      <img src={after.src} alt={after.alt} />
      <div className="slider-top" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
        <img src={before.src} alt={before.alt} />
      </div>
      <span className="slider-label is-left">{before.label}</span>
      <span className="slider-label is-right">{after.label}</span>
      {before.meta && <span className="slider-meta is-left">{before.meta}</span>}
      {after.meta && <span className="slider-meta is-right">{after.meta}</span>}
      <span className="slider-handle" style={{ left: `${split}%` }} aria-hidden>
        <i><ChevronsLeftRight size={16} /></i>
      </span>
      <input
        className="slider-input"
        type="range"
        min={0}
        max={100}
        value={split}
        aria-label={`Comparison position: ${before.label} on the left, ${after.label} on the right`}
        onChange={(event) => setSplit(Number(event.target.value))}
      />
    </div>
  );
}
