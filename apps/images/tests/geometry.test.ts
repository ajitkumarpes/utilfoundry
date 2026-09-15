import { describe, expect, it } from "vitest";
import {
  applyOrientation, describeOrientation, dragRect, fitToRatio, initialCrop, isQuarterTurn,
  NO_CHANGE, normalizeAngle, normalizeRect, planResize, resolveResizeTarget, rotatedSize, type Rect, type ResizeRequest
} from "@/lib/geometry";

const bounds = { width: 1600, height: 1000 };
const ratioOf = (rect: Rect) => rect.width / rect.height;

describe("crop rectangle basics", () => {
  it("rounds to whole pixels and keeps the box inside the image", () => {
    expect(normalizeRect({ x: -20.4, y: 990, width: 100.6, height: 40 }, bounds))
      .toEqual({ x: 0, y: 960, width: 101, height: 40 });
    expect(normalizeRect({ x: 0, y: 0, width: 5000, height: 5000 }, bounds))
      .toEqual({ x: 0, y: 0, width: 1600, height: 1000 });
  });

  it("starts free selections at 80%, centred", () => {
    expect(initialCrop(bounds, null)).toEqual({ x: 160, y: 100, width: 1280, height: 800 });
  });

  it("starts ratio selections at the largest centred box of that shape", () => {
    const square = initialCrop(bounds, 1);
    expect(square).toEqual({ x: 400, y: 100, width: 800, height: 800 });
    const wide = initialCrop(bounds, 16 / 9);
    expect(ratioOf(wide)).toBeCloseTo(16 / 9, 1);
    expect(wide.width).toBeLessThanOrEqual(1280);
  });

  it("reshapes to a ratio around the current centre", () => {
    const start: Rect = { x: 400, y: 200, width: 800, height: 400 };
    const square = fitToRatio(start, 1, bounds);
    expect(square.width).toBe(square.height);
    expect(square.x + square.width / 2).toBeCloseTo(800, 0);
    expect(square.y + square.height / 2).toBeCloseTo(400, 0);
  });

  it("shrinks rather than overflowing when the ratio does not fit", () => {
    const tall = fitToRatio({ x: 0, y: 0, width: 1600, height: 1000 }, 9 / 16, bounds);
    expect(tall.height).toBe(1000);
    expect(tall.width).toBe(563);
  });
});

describe("dragging the crop box", () => {
  const start: Rect = { x: 400, y: 300, width: 400, height: 300 };

  it("moves the whole box but never past the image edge", () => {
    expect(dragRect(start, "move", 50, -20, bounds, null)).toMatchObject({ x: 450, y: 280, width: 400, height: 300 });
    expect(dragRect(start, "move", 5000, 5000, bounds, null)).toMatchObject({ x: 1200, y: 700 });
    expect(dragRect(start, "move", -5000, -5000, bounds, null)).toMatchObject({ x: 0, y: 0 });
  });

  it("resizes a free corner independently on each axis", () => {
    expect(dragRect(start, "se", 100, 50, bounds, null)).toEqual({ x: 400, y: 300, width: 500, height: 350 });
    expect(dragRect(start, "nw", -100, -50, bounds, null)).toEqual({ x: 300, y: 250, width: 500, height: 350 });
  });

  it("stops an edge at the minimum size instead of turning the box inside out", () => {
    const squashed = dragRect(start, "w", 1000, 0, bounds, null, 16);
    expect(squashed.width).toBe(16);
    expect(squashed.x + squashed.width).toBe(800);
  });

  it("clamps a free edge at the image boundary", () => {
    expect(dragRect(start, "e", 5000, 0, bounds, null).width).toBe(1200);
    expect(dragRect(start, "n", 0, -5000, bounds, null).y).toBe(0);
  });

  it("keeps a locked ratio exactly while dragging a corner", () => {
    const locked = { ...start, height: 225 }; // 16:9
    const grown = dragRect(locked, "se", 160, 0, bounds, 16 / 9);
    expect(ratioOf(grown)).toBeCloseTo(16 / 9, 6);
    expect(grown.x).toBe(400);
    expect(grown.y).toBe(300);
    expect(grown.width).toBe(560);
  });

  it("pivots a locked corner on the opposite corner", () => {
    const grown = dragRect(start, "nw", -100, -100, bounds, 4 / 3);
    expect(ratioOf(grown)).toBeCloseTo(4 / 3, 6);
    expect(grown.x + grown.width).toBeCloseTo(800, 6);
    expect(grown.y + grown.height).toBeCloseTo(600, 6);
  });

  it("stops a locked corner at the edge rather than bending the ratio", () => {
    const grown = dragRect(start, "se", 5000, 5000, bounds, 4 / 3);
    expect(ratioOf(grown)).toBeCloseTo(4 / 3, 6);
    expect(grown.x + grown.width).toBeLessThanOrEqual(1600 + 1e-9);
    expect(grown.y + grown.height).toBeLessThanOrEqual(1000 + 1e-9);
  });

  it("drags a locked side edge around the box's midline", () => {
    const grown = dragRect(start, "e", 80, 0, bounds, 4 / 3);
    expect(ratioOf(grown)).toBeCloseTo(4 / 3, 6);
    expect(grown.x).toBe(400);
    expect(grown.y + grown.height / 2).toBeCloseTo(450, 6);
  });

  it("drags a locked top edge around the box's vertical midline", () => {
    const grown = dragRect(start, "n", 0, -60, bounds, 4 / 3);
    expect(ratioOf(grown)).toBeCloseTo(4 / 3, 6);
    expect(grown.y + grown.height).toBeCloseTo(600, 6);
    expect(grown.x + grown.width / 2).toBeCloseTo(600, 6);
  });
});

describe("rotation", () => {
  it("normalises angles into (-180, 180]", () => {
    expect(normalizeAngle(270)).toBe(-90);
    expect(normalizeAngle(-270)).toBe(90);
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(540)).toBe(180);
    expect(normalizeAngle(-45)).toBe(-45);
  });

  it("recognises quarter turns", () => {
    expect(isQuarterTurn(90)).toBe(true);
    expect(isQuarterTurn(-180)).toBe(true);
    expect(isQuarterTurn(360)).toBe(true);
    expect(isQuarterTurn(45)).toBe(false);
  });

  it("swaps dimensions exactly on a quarter turn", () => {
    expect(rotatedSize({ width: 100, height: 50 }, 90)).toEqual({ width: 50, height: 100 });
    expect(rotatedSize({ width: 100, height: 50 }, 180)).toEqual({ width: 100, height: 50 });
    expect(rotatedSize({ width: 100, height: 50 }, -90)).toEqual({ width: 50, height: 100 });
  });

  it("grows the canvas for a free angle so no corner is clipped", () => {
    expect(rotatedSize({ width: 100, height: 50 }, 45)).toEqual({ width: 106, height: 106 });
  });

  it("composes toolbar actions", () => {
    const twice = applyOrientation(applyOrientation(NO_CHANGE, "right"), "right");
    expect(twice.rotation).toBe(180);
    expect(applyOrientation(NO_CHANGE, "left").rotation).toBe(-90);
    const flipped = applyOrientation(applyOrientation(NO_CHANGE, "flipH"), "flipH");
    expect(flipped.flipH).toBe(false);
  });

  it("describes the result in words", () => {
    expect(describeOrientation(NO_CHANGE)).toBe("Original");
    expect(describeOrientation({ rotation: -90, flipH: true, flipV: false })).toBe("−90°, flipped horizontally");
  });
});

describe("resize target", () => {
  const source = { width: 1600, height: 1000 };
  const request = (extra: Partial<ResizeRequest>): ResizeRequest => ({
    mode: "pixels", width: 0, height: 0, percentage: 100, keepAspect: true, preventEnlargement: true, ...extra
  });

  it("derives the height from the width when the ratio is locked", () => {
    expect(resolveResizeTarget(source, request({ width: 800 }))).toEqual({ width: 800, height: 500 });
  });

  it("derives the width from the height when only the height is set", () => {
    expect(resolveResizeTarget(source, request({ height: 500 }))).toEqual({ width: 800, height: 500 });
  });

  it("uses both sides as given when the ratio is unlocked", () => {
    expect(resolveResizeTarget(source, request({ width: 800, height: 800, keepAspect: false }))).toEqual({ width: 800, height: 800 });
  });

  it("never enlarges when asked not to", () => {
    expect(resolveResizeTarget(source, request({ width: 3200 }))).toEqual({ width: 1600, height: 1000 });
    expect(resolveResizeTarget(source, request({ mode: "percentage", percentage: 200 }))).toEqual({ width: 1600, height: 1000 });
  });

  it("enlarges when allowed", () => {
    expect(resolveResizeTarget(source, request({ mode: "percentage", percentage: 150, preventEnlargement: false }))).toEqual({ width: 2400, height: 1500 });
  });

  it("shrinks a preset box uniformly so its shape survives", () => {
    const square = resolveResizeTarget(source, request({ mode: "preset", width: 1080, height: 1080 }));
    expect(square).toEqual({ width: 1000, height: 1000 });
  });

  it("falls back to the source size when nothing is set", () => {
    expect(resolveResizeTarget(source, request({}))).toEqual({ width: 1600, height: 1000 });
  });
});

describe("resize plan", () => {
  const source = { width: 1600, height: 1000 };
  const box = { width: 500, height: 500 };

  it("cover fills the box and crops the centre", () => {
    const plan = planResize(source, box, "cover");
    expect(plan.canvas).toEqual(box);
    expect(plan).toMatchObject({ sx: 300, sy: 0, sw: 1000, sh: 1000, dw: 500, dh: 500 });
  });

  it("contain letterboxes inside the full box", () => {
    const plan = planResize(source, box, "contain");
    expect(plan.canvas).toEqual(box);
    expect(plan).toMatchObject({ dw: 500, dh: 313, dx: 0, dy: 94, sw: 1600 });
  });

  it("inside shrinks the canvas to the fitted image", () => {
    expect(planResize(source, box, "inside").canvas).toEqual({ width: 500, height: 313 });
  });

  it("fill stretches the whole image to the box", () => {
    expect(planResize(source, box, "fill")).toMatchObject({ canvas: box, sw: 1600, sh: 1000, dw: 500, dh: 500 });
  });
});
