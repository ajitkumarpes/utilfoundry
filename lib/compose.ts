/**
 * Multi-image composition: contact sheets and collages.
 *
 * The layout maths is kept free of the DOM so it can be tested directly; only
 * `drawComposition` touches a canvas.
 */

import { context, createCanvas, roundedPath } from "@/lib/canvas/effects";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";

export type Cell = {
  image: SourceImage;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Caption strip under the cell; zero when captions are off. */
  labelHeight: number;
};

export type Composition = {
  width: number;
  height: number;
  cells: Cell[];
  columns: number;
  rows: number;
};

export type Fit = "fit" | "fill" | "stretch";

const num = (options: ToolOptions, key: string, fallback: number) => {
  const value = Number(options[key]);
  return Number.isFinite(value) ? value : fallback;
};
const str = (options: ToolOptions, key: string, fallback: string) =>
  options[key] === undefined || options[key] === "" ? fallback : String(options[key]);
const flag = (options: ToolOptions, key: string, fallback: boolean) =>
  options[key] === undefined ? fallback : options[key] === true || options[key] === "true";

/** Output width presets, in pixels. */
export const SHEET_WIDTHS: Record<string, number> = {
  "1200": 1200,
  "1600": 1600,
  "2400": 2400,
  a4: 2480, // A4 at 300 dpi
  letter: 2550
};

/* -------------------------------------------------------------------------- */
/* Contact sheet                                                              */
/* -------------------------------------------------------------------------- */

export function layoutContactSheet(images: SourceImage[], options: ToolOptions): Composition {
  const count = images.length;
  if (!count) return { width: 0, height: 0, cells: [], columns: 0, rows: 0 };

  const columns = Math.max(1, Math.min(12, Math.round(num(options, "columns", 4))));
  const rows = Math.ceil(count / columns);
  const sheetWidth = SHEET_WIDTHS[str(options, "sheetWidth", "1600")] ?? 1600;
  const spacing = Math.max(0, Math.round(num(options, "spacing", 10)));
  const showLabels = flag(options, "showFilenames", true);
  const fontSize = Math.max(8, Math.round(num(options, "fontSize", 12)));
  const overlay = str(options, "labelPosition", "below") === "overlay";
  const labelHeight = showLabels && !overlay ? Math.round(fontSize * 1.9) : 0;

  const cellWidth = Math.floor((sheetWidth - spacing * (columns + 1)) / columns);
  if (cellWidth < 16) throw new Error("Reduce the column count or the spacing — the thumbnails would be too small.");

  // One shared cell shape keeps the grid aligned; the average source aspect
  // makes that shape waste the least space for this particular set.
  const averageAspect = images.reduce((total, image) => total + image.width / Math.max(1, image.height), 0) / count;
  const cellHeight = Math.max(24, Math.round(cellWidth / Math.min(2.4, Math.max(0.45, averageAspect))));

  // Flooring the cell width leaves a few pixels over; centring the grid spends
  // them on the outer margin so the sheet is exactly the width that was asked for.
  const leftover = sheetWidth - (spacing + columns * (cellWidth + spacing));
  const originX = spacing + Math.floor(leftover / 2);

  const cells = images.map((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      image,
      x: originX + column * (cellWidth + spacing),
      y: spacing + row * (cellHeight + labelHeight + spacing),
      width: cellWidth,
      height: cellHeight,
      labelHeight
    };
  });

  return {
    width: sheetWidth,
    height: spacing + rows * (cellHeight + labelHeight + spacing),
    cells,
    columns,
    rows
  };
}

/* -------------------------------------------------------------------------- */
/* Collage                                                                    */
/* -------------------------------------------------------------------------- */

export type CollageLayout = "grid" | "mosaic" | "horizontal" | "vertical";

export function layoutCollage(images: SourceImage[], options: ToolOptions): Composition {
  const count = images.length;
  if (!count) return { width: 0, height: 0, cells: [], columns: 0, rows: 0 };

  const layout = str(options, "layout", "grid") as CollageLayout;
  const gap = Math.max(0, Math.round(num(options, "gap", 12)));
  const outerWidth = SHEET_WIDTHS[str(options, "sheetWidth", "1600")] ?? 1600;

  if (layout === "horizontal" || layout === "vertical") return strip(images, layout, outerWidth, gap);
  if (layout === "mosaic" && count >= 3) return mosaic(images, outerWidth, gap);
  return grid(images, outerWidth, gap, num(options, "aspect", 0));
}

/** A single row or column, every image at the same height or width. */
function strip(images: SourceImage[], layout: CollageLayout, outerWidth: number, gap: number): Composition {
  const count = images.length;

  if (layout === "horizontal") {
    const inner = outerWidth - gap * (count + 1);
    const totalAspect = images.reduce((total, image) => total + image.width / Math.max(1, image.height), 0);
    const height = Math.max(40, Math.round(inner / totalAspect));
    let x = gap;
    const cells = images.map((image) => {
      const width = Math.round(height * (image.width / Math.max(1, image.height)));
      const cell = { image, x, y: gap, width, height, labelHeight: 0 };
      x += width + gap;
      return cell;
    });
    return { width: x, height: height + gap * 2, cells, columns: count, rows: 1 };
  }

  const width = outerWidth - gap * 2;
  let y = gap;
  const cells = images.map((image) => {
    const height = Math.round(width / Math.max(0.2, image.width / Math.max(1, image.height)));
    const cell = { image, x: gap, y, width, height, labelHeight: 0 };
    y += height + gap;
    return cell;
  });
  return { width: outerWidth, height: y, cells, columns: 1, rows: count };
}

/** Even grid; `aspect` of 0 lets the rows take the shape of the sources. */
function grid(images: SourceImage[], outerWidth: number, gap: number, aspect: number): Composition {
  const count = images.length;
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const cellWidth = Math.floor((outerWidth - gap * (columns + 1)) / columns);

  const averageAspect = images.reduce((total, image) => total + image.width / Math.max(1, image.height), 0) / count;
  const cellHeight = Math.max(40, Math.round(cellWidth / (aspect > 0 ? aspect : Math.min(2.2, Math.max(0.5, averageAspect)))));

  const cells = images.map((image, index) => ({
    image,
    x: gap + (index % columns) * (cellWidth + gap),
    y: gap + Math.floor(index / columns) * (cellHeight + gap),
    width: cellWidth,
    height: cellHeight,
    labelHeight: 0
  }));

  return {
    width: gap + columns * (cellWidth + gap),
    height: gap + rows * (cellHeight + gap),
    cells,
    columns,
    rows
  };
}

/**
 * Hero layout: the first image takes a large square on the left and the rest
 * stack down a narrower column on the right.
 */
function mosaic(images: SourceImage[], outerWidth: number, gap: number): Composition {
  const [hero, ...rest] = images;
  const heroWidth = Math.round((outerWidth - gap * 3) * 0.64);
  const sideWidth = outerWidth - gap * 3 - heroWidth;
  const sideCount = rest.length;
  const sideHeight = Math.floor((heroWidth - gap * (sideCount - 1)) / sideCount);
  const height = Math.max(heroWidth, sideHeight * sideCount + gap * (sideCount - 1));

  const cells: Cell[] = [{ image: hero, x: gap, y: gap, width: heroWidth, height, labelHeight: 0 }];
  rest.forEach((image, index) => {
    cells.push({
      image,
      x: gap * 2 + heroWidth,
      y: gap + index * (sideHeight + gap),
      width: sideWidth,
      height: sideHeight,
      labelHeight: 0
    });
  });

  return { width: outerWidth, height: height + gap * 2, cells, columns: 2, rows: sideCount };
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

/** Source rectangle for drawing `image` into a `width` × `height` box. */
export function fitRect(image: { width: number; height: number }, width: number, height: number, fit: Fit) {
  if (fit === "stretch") return { sx: 0, sy: 0, sw: image.width, sh: image.height, dx: 0, dy: 0, dw: width, dh: height };

  if (fit === "fill") {
    // Cover: crop the overflowing axis out of the source.
    const scale = Math.max(width / image.width, height / image.height);
    const sw = Math.min(image.width, width / scale);
    const sh = Math.min(image.height, height / scale);
    return {
      sx: (image.width - sw) / 2,
      sy: (image.height - sh) / 2,
      sw,
      sh,
      dx: 0,
      dy: 0,
      dw: width,
      dh: height
    };
  }

  const scale = Math.min(width / image.width, height / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  return { sx: 0, sy: 0, sw: image.width, sh: image.height, dx: (width - dw) / 2, dy: (height - dh) / 2, dw, dh };
}

/** Trims a caption with an ellipsis so it never runs past its cell. */
function ellipsize(ctx: CanvasRenderingContext2D, label: string, maxWidth: number) {
  if (ctx.measureText(label).width <= maxWidth) return label;
  let text = label;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

/**
 * Renders a composition. `scale` below 1 draws a proportional miniature — every
 * distance, radius and type size shrinks together, so the preview is a faithful
 * likeness of the exported file rather than an approximation of it.
 */
export function drawComposition(composition: Composition, options: ToolOptions, scale = 1): HTMLCanvasElement {
  if (!composition.cells.length) throw new Error("Add at least two images first.");

  const canvas = createCanvas(composition.width * scale, composition.height * scale);
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = "high";

  const transparent = flag(options, "transparent", false);
  if (!transparent) {
    ctx.fillStyle = str(options, "background", "#FFFFFF");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const fit = str(options, "fit", "fit") as Fit;
  const radius = Math.max(0, num(options, "radius", 0)) * scale;
  const showLabels = flag(options, "showFilenames", false);
  const fontSize = Math.max(5, num(options, "fontSize", 12) * scale);
  const overlay = str(options, "labelPosition", "below") === "overlay";
  const shadow = flag(options, "shadow", false);

  for (const source of composition.cells) {
    const cell = {
      ...source,
      x: source.x * scale,
      y: source.y * scale,
      width: source.width * scale,
      height: source.height * scale,
      labelHeight: source.labelHeight * scale
    };
    ctx.save();
    if (shadow) {
      ctx.shadowColor = "rgba(17, 28, 61, 0.22)";
      ctx.shadowBlur = Math.max(6, radius + 10);
      ctx.shadowOffsetY = 4;
    }
    if (radius > 0) {
      roundedPath(ctx, cell.x, cell.y, cell.width, cell.height, [radius, radius, radius, radius]);
      ctx.clip();
    } else if (shadow) {
      // A shadow needs something opaque to fall from when there is no clip.
      ctx.fillStyle = str(options, "background", "#FFFFFF");
      ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
    }
    ctx.shadowColor = "transparent";

    const box = fitRect(cell.image, cell.width, cell.height, fit);
    ctx.drawImage(
      cell.image.element,
      box.sx, box.sy, box.sw, box.sh,
      cell.x + box.dx, cell.y + box.dy, box.dw, box.dh
    );
    ctx.restore();

    if (!showLabels) continue;

    ctx.save();
    ctx.font = `500 ${Math.round(fontSize)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const label = ellipsize(ctx, cell.image.name, cell.width - 12 * scale);

    if (overlay) {
      const stripHeight = Math.max(2, Math.round(fontSize * 2));
      ctx.fillStyle = "rgba(17, 28, 61, 0.62)";
      ctx.fillRect(cell.x, cell.y + cell.height - stripHeight, cell.width, stripHeight);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, cell.x + cell.width / 2, cell.y + cell.height - stripHeight / 2);
    } else {
      ctx.fillStyle = str(options, "labelColor", "#40506b");
      ctx.fillText(label, cell.x + cell.width / 2, cell.y + cell.height + cell.labelHeight / 2);
    }
    ctx.restore();
  }

  return canvas;
}

export function composeFor(tool: string, images: SourceImage[], options: ToolOptions) {
  return tool === "image-collage" ? layoutCollage(images, options) : layoutContactSheet(images, options);
}
