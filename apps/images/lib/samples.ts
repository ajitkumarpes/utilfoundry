import type { ToolId } from "@/lib/tools";

export type Sample = { src: string; alt: string; name: string };

const PHOTOS: Sample[] = [
  { src: "/samples/landscape.jpg", alt: "Mountain lake", name: "mountain-lake.jpg" },
  { src: "/samples/city.jpg", alt: "City skyline at dusk", name: "city-skyline.jpg" },
  { src: "/samples/leaf.jpg", alt: "Green leaf", name: "green-leaf.jpg" },
  { src: "/samples/portrait.jpg", alt: "Portrait", name: "portrait.jpg" },
  { src: "/samples/sunset.jpg", alt: "Beach sunset", name: "beach-sunset.jpg" }
];

const DOCUMENTS: Sample[] = [
  { src: "/samples/invoice.png", alt: "Invoice", name: "invoice.png" },
  { src: "/samples/quote.png", alt: "Printed quote", name: "quote.png" },
  { src: "/samples/receipt.png", alt: "Receipt", name: "receipt.png" },
  { src: "/samples/poster.png", alt: "Poster with light text on a dark background", name: "poster.png" }
];

/** An app screen, which is what the screenshot tools are really for. */
const DASHBOARD: Sample = { src: "/samples/dashboard.png", alt: "Project dashboard screenshot", name: "dashboard.png" };

/** Carries real EXIF, GPS and lens data, so the inspectors have something to show. */
const EXIF_PHOTO: Sample = { src: "/samples/photo-exif.jpg", alt: "Mountain lake with camera metadata", name: "photo-exif.jpg" };

/** A second take of the mountain scene, for the before/after comparison. */
export const COMPARE_PAIR: [Sample, Sample] = [
  { src: "/samples/compare-before.jpg", alt: "Mountain lake", name: "lake-before.jpg" },
  { src: "/samples/compare-after.jpg", alt: "The same lake with a boat added", name: "lake-after.jpg" }
];

const ANIMATIONS: Sample[] = [
  { src: "/samples/loader.gif", alt: "Looping loader animation", name: "loader.gif" }
];

const MARKS: Sample[] = [
  { src: "/samples/mark.png", alt: "Square brand mark", name: "mark.png" },
  { src: "/samples/poster.png", alt: "Poster with block text", name: "poster.png" },
  { src: "/samples/leaf.jpg", alt: "Green leaf", name: "green-leaf.jpg" }
];

const TEXT_TOOLS = new Set<ToolId>(["ocr-image", "screenshot-to-text", "screenshot-to-pdf"]);
const INSPECTORS = new Set<ToolId>(["image-metadata-viewer", "image-dimensions"]);

export function samplesFor(tool: ToolId): Sample[] {
  if (tool === "screenshot-to-text" || tool === "screenshot-to-pdf") return [DASHBOARD, ...DOCUMENTS];
  if (TEXT_TOOLS.has(tool)) return DOCUMENTS;
  if (tool === "background-removal" || tool === "image-upscaler") return [PHOTOS[3], PHOTOS[0], PHOTOS[2], PHOTOS[1]];
  if (tool === "gif-to-frames") return ANIMATIONS;
  if (tool === "favicon-generator") return MARKS;
  // Metadata removal needs a file that actually carries some to show its work.
  if (INSPECTORS.has(tool) || tool === "remove-metadata") return [EXIF_PHOTO, ...PHOTOS.slice(0, 4)];
  // A screenshot PNG is where palette compression pays off most, so offer one.
  if (tool === "image-compressor") return [PHOTOS[0], DASHBOARD, PHOTOS[3], PHOTOS[1]];
  if (tool === "image-compare") return COMPARE_PAIR;
  return PHOTOS;
}
