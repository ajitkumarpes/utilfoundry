/**
 * The explanatory copy around each tool: why to use it, what it reads, how to
 * get the best result. Kept apart from `lib/tools.ts` so the registry stays a
 * list of behaviour and this file stays a list of words.
 *
 * Every claim here has to be true of this implementation — "processed in your
 * browser" only where nothing is uploaded, language counts that match the
 * worker, and so on.
 */

import type { ToolId } from "@/lib/tools";

export type ReasonIcon =
  | "shield" | "lock" | "zap" | "leaf" | "sparkles" | "layers" | "target" | "eye"
  | "clock" | "offline" | "image" | "globe" | "scan" | "crop" | "code" | "file" | "camera" | "sliders";

export type Tone = "green" | "blue" | "purple" | "amber" | "orange";

export type Reason = { icon: ReasonIcon; tone: Tone; title: string; note: string };

export type FormatId = "jpg" | "png" | "webp" | "avif" | "bmp" | "tiff" | "gif" | "ico" | "heic" | "svg" | "pdf";

export type ToolContent = {
  reasons: Reason[];
  formats?: FormatId[];
  tips?: string[];
  useCases?: string[];
  related?: ToolId[];
};

/* -------------------------------------------------------------------------- */
/* Reusable reasons                                                           */
/* -------------------------------------------------------------------------- */

const FREE: Reason = { icon: "shield", tone: "green", title: "100% Free", note: "No account required" };
const LOCAL: Reason = { icon: "lock", tone: "blue", title: "Your files stay private", note: "Processed in your browser, never uploaded" };
const OFFLINE: Reason = { icon: "offline", tone: "amber", title: "Works offline", note: "Processed locally in your browser" };
const NO_AI: Reason = { icon: "leaf", tone: "orange", title: "No AI in core pipeline", note: "Simple, transparent processing" };
const SERVER_PRIVATE: Reason = { icon: "lock", tone: "green", title: "100% private", note: "Processed on this server, never stored" };
const NO_ACCOUNT: Reason = { icon: "eye", tone: "blue", title: "No account required", note: "Start using immediately" };

const PHOTO_FORMATS: FormatId[] = ["jpg", "png", "webp", "avif", "bmp", "tiff"];

/* -------------------------------------------------------------------------- */

export const TOOL_CONTENT: Partial<Record<ToolId, ToolContent>> = {
  "image-compressor": {
    reasons: [
      FREE,
      { icon: "lock", tone: "blue", title: "Your files stay private", note: "Compressed on this server and never stored" },
      { icon: "zap", tone: "purple", title: "Fast & reliable", note: "Get optimized images in seconds" },
      NO_AI
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "For photos, 60–80% gives the best balance.",
      "Use WebP for smaller file sizes.",
      "Keep the original format if you need transparency.",
      "You can compress up to 20 images at once.",
      "No watermark is ever added."
    ]
  },

  "resize-image": {
    reasons: [
      { icon: "image", tone: "green", title: "Quickly resize images", note: "Perfect for web, social media or documents" },
      { icon: "shield", tone: "blue", title: "Maintain quality", note: "High-quality resampling, no needless loss" },
      { icon: "zap", tone: "purple", title: "Multiple formats", note: "Export as JPG, PNG, WebP or AVIF" },
      { icon: "leaf", tone: "orange", title: "Simple and secure", note: "Processed locally in your browser" }
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Keep the aspect ratio locked to avoid distortion.",
      "Use WebP for smaller file sizes.",
      "Choose the right preset for your platform.",
      "Leave “Prevent enlargement” on for the sharpest result.",
      "Contain fits without cropping; Cover fills the exact size."
    ]
  },

  "remove-metadata": {
    reasons: [
      { icon: "shield", tone: "green", title: "Protect your privacy", note: "Remove GPS location, device info and personal data" },
      { icon: "lock", tone: "blue", title: "Share safely", note: "Keep your images private before sharing online" },
      { icon: "eye", tone: "purple", title: "Clean and lightweight", note: "Strip hidden data and trim the file size" },
      { icon: "file", tone: "orange", title: "Works with all formats", note: "JPG, PNG and WebP cleaned without re-encoding" }
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "JPEG, PNG and WebP are cleaned losslessly — the pixels are not touched.",
      "You can review every field before removing it.",
      "Use this tool before sharing images on social media.",
      "Remove GPS only to keep camera details for a portfolio."
    ]
  },

  "crop-image": {
    reasons: [
      { icon: "crop", tone: "green", title: "Precise control", note: "Crop to the exact pixel area" },
      { icon: "layers", tone: "purple", title: "Multiple aspect ratios", note: "Use presets or a custom size" },
      { icon: "shield", tone: "green", title: "High quality output", note: "No unnecessary loss" },
      OFFLINE
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Use aspect ratio presets for common sizes (1:1 for profile pictures).",
      "Drag the corners to resize, or drag inside the box to move it.",
      "Use the grid to align important elements.",
      "You can also enter exact dimensions.",
      "Rotate or flip before cropping if needed."
    ],
    useCases: ["Profile pictures", "Social media posts", "Product photos", "Documents and scans"]
  },

  "rotate-image": {
    reasons: [
      FREE,
      { icon: "zap", tone: "blue", title: "Fast processing", note: "Rotate images in seconds" },
      { icon: "image", tone: "amber", title: "No quality loss", note: "Quarter turns keep every pixel" },
      { icon: "zap", tone: "purple", title: "Works offline", note: "Processed locally in your browser" }
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Use 90°, 180° or a custom angle.",
      "Preview the result before downloading.",
      "Quarter-turn rotation does not affect image quality.",
      "You can also flip images horizontally or vertically.",
      "Custom angles grow the canvas so no corner is clipped."
    ]
  },

  "flip-image": {
    reasons: [
      FREE,
      { icon: "zap", tone: "purple", title: "Instant processing", note: "Flip images in seconds" },
      { icon: "image", tone: "amber", title: "No quality loss", note: "Original resolution is preserved" },
      { icon: "leaf", tone: "green", title: "Works offline", note: "Processed locally in your browser" }
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Use horizontal flip to create a mirror image.",
      "Use vertical flip to turn the image upside down.",
      "Apply both for a 180° turn.",
      "Flipping does not reduce image quality."
    ]
  },

  "watermark-image": {
    reasons: [
      { icon: "shield", tone: "green", title: "Protect your work", note: "Mark photos before they leave your hands" },
      { icon: "layers", tone: "purple", title: "Text or logo", note: "Type a watermark or upload a PNG logo" },
      { icon: "sliders", tone: "blue", title: "Fully customizable", note: "Size, opacity, position, rotation and tiling" },
      OFFLINE
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "30–50% opacity keeps the photo readable.",
      "Tile the watermark to make it harder to crop out.",
      "Use a transparent PNG for logo watermarks.",
      "Export as PNG to keep text edges crisp."
    ]
  },

  "add-border": {
    reasons: [
      FREE,
      { icon: "layers", tone: "purple", title: "Four border styles", note: "Solid, dashed, dotted or double" },
      { icon: "sliders", tone: "blue", title: "Fully customizable", note: "Colour, thickness and corner shape" },
      OFFLINE
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Grow the output so the border never covers the photo.",
      "Circle corners make instant profile avatars.",
      "Export as PNG to keep rounded corners transparent."
    ]
  },

  "rounded-corners": {
    reasons: [
      FREE,
      { icon: "eye", tone: "purple", title: "Live preview", note: "See every change as you make it" },
      { icon: "sliders", tone: "blue", title: "Per-corner control", note: "Round all, top, bottom or each corner" },
      OFFLINE
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Use Custom to round only the corners that need it.",
      "Add a background colour when exporting as JPG.",
      "Match the radius to your site's cards for a consistent look."
    ]
  },

  "grayscale-image": {
    reasons: [
      FREE,
      { icon: "layers", tone: "purple", title: "Three conversion modes", note: "Desaturate, luminosity or average" },
      { icon: "sliders", tone: "blue", title: "Tone controls", note: "Adjust brightness and contrast as you go" },
      OFFLINE
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Luminosity matches how the eye perceives brightness.",
      "Add a little contrast to stop grey images looking flat.",
      "Grayscale PNGs compress far better than colour ones."
    ]
  },

  "sharpen-image": {
    reasons: [
      FREE,
      { icon: "target", tone: "purple", title: "Unsharp masking", note: "The same technique photo editors use" },
      { icon: "eye", tone: "blue", title: "Real-time preview", note: "Compare before and after side by side" },
      OFFLINE
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Keep noise reduction on for phone photos.",
      "Sharpen last, after resizing, so the detail survives.",
      "Enhance Edges suits architecture and text; leave it off for faces."
    ]
  },

  "blur-image": {
    reasons: [
      FREE,
      { icon: "layers", tone: "purple", title: "Four blur types", note: "Gaussian, motion, box and lens" },
      { icon: "eye", tone: "blue", title: "Real-time preview", note: "Compare before and after side by side" },
      OFFLINE
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "Lens blur keeps the centre sharp, like a wide aperture.",
      "Motion blur suggests speed in action shots.",
      "Turn off “Maintain original size” for much smaller files."
    ]
  },

  "image-converter": {
    reasons: [
      FREE,
      { icon: "zap", tone: "purple", title: "Multiple formats", note: "Convert to JPG, PNG, WebP, AVIF, BMP, TIFF, GIF, ICO" },
      { icon: "clock", tone: "purple", title: "Fast & reliable", note: "Convert up to 20 images at once" },
      NO_AI
    ],
    formats: ["jpg", "png", "webp", "avif", "bmp", "tiff", "gif", "ico"],
    tips: [
      "Use high quality images for better output.",
      "For transparent images, use PNG or WebP.",
      "You can convert multiple images at once.",
      "ICO output is squared and capped at 256 px, as the format requires."
    ]
  },

  "image-to-pdf": {
    reasons: [
      { icon: "file", tone: "orange", title: "Combine multiple images", note: "Convert several images into a single PDF file" },
      FREE,
      { icon: "zap", tone: "purple", title: "Fast & reliable", note: "Generate a PDF in seconds" },
      { icon: "sliders", tone: "amber", title: "Customizable", note: "Page size, orientation, image fit and ordering" }
    ],
    formats: PHOTO_FORMATS,
    tips: [
      "You can select multiple images at once.",
      "Drag and drop to reorder images.",
      "Use high resolution images for better PDF quality.",
      "Choose “Fit to page” to avoid cropping.",
      "Add file-name captions to label each page."
    ]
  },

  "screenshot-to-pdf": {
    reasons: [
      { icon: "camera", tone: "green", title: "Multiple capture options", note: "Capture a screen, window or browser tab" },
      { icon: "layers", tone: "purple", title: "Combine easily", note: "Convert multiple screenshots into one PDF" },
      { icon: "zap", tone: "amber", title: "Fast & reliable", note: "High-quality PDF output" },
      FREE
    ],
    useCases: [
      "Save web pages for offline reading",
      "Create documentation or tutorials",
      "Capture and share error reports",
      "Save chat or email conversations",
      "Build step-by-step guides"
    ],
    tips: [
      "Arrange screenshots in the correct order before creating the PDF.",
      "Use “Fit to page” to avoid cropping.",
      "For best quality, use high-resolution screenshots.",
      "Capture a single window instead of the full screen for tighter pages."
    ]
  },

  "image-to-base64": {
    reasons: [
      { icon: "code", tone: "purple", title: "Easy integration", note: "Use images in HTML, CSS, JSON or APIs" },
      { icon: "lock", tone: "amber", title: "Fast & secure", note: "Processed locally in your browser" },
      { icon: "eye", tone: "green", title: "No account required", note: "Convert images instantly" },
      { icon: "layers", tone: "orange", title: "Multiple formats", note: "JPG, PNG, WebP, GIF, BMP, TIFF and SVG" }
    ],
    useCases: [
      "Embed images in HTML (data URI)",
      "Use images in CSS (background-image)",
      "Send images in JSON payloads",
      "Store images in databases",
      "Use in API requests"
    ],
    related: ["base64-to-image", "image-converter", "resize-image", "image-compressor"]
  },

  "base64-to-image": {
    reasons: [
      { icon: "image", tone: "purple", title: "Convert text to image", note: "Decode Base64 strings into viewable image files" },
      { icon: "file", tone: "orange", title: "Supports multiple formats", note: "JPG, PNG, WebP, GIF, BMP, SVG and more" },
      { icon: "eye", tone: "blue", title: "Instant preview", note: "See your image before downloading" },
      { icon: "lock", tone: "green", title: "Secure & private", note: "Processed locally in your browser" },
      { icon: "shield", tone: "orange", title: "100% Free", note: "No account required" }
    ],
    useCases: [
      "View images from API responses",
      "Decode images from JSON data",
      "Convert Base64 to image files",
      "Save images from databases",
      "Use in development and testing"
    ]
  },

  "background-removal": {
    reasons: [
      { icon: "sparkles", tone: "purple", title: "AI-powered accuracy", note: "Precisely detects and removes backgrounds" },
      { icon: "zap", tone: "orange", title: "Fast & easy", note: "Get a transparent image in seconds" },
      SERVER_PRIVATE,
      NO_ACCOUNT
    ],
    useCases: [
      "Product photos for e-commerce",
      "Profile pictures",
      "Logos and graphics",
      "Social media content",
      "Marketing and presentations",
      "Stickers and cutouts"
    ]
  },

  "image-upscaler": {
    reasons: [
      { icon: "sparkles", tone: "purple", title: "AI-powered enhancement", note: "A super-resolution model, not plain stretching" },
      { icon: "zap", tone: "orange", title: "Sharper & clearer", note: "Increase resolution without the blur" },
      { icon: "image", tone: "amber", title: "Works with any image", note: "Photos, logos, graphics and more" },
      SERVER_PRIVATE,
      NO_ACCOUNT
    ],
    useCases: [
      "Enhance old or low-resolution photos",
      "Improve product images for e-commerce",
      "Enlarge images for printing",
      "Restore scanned photos",
      "Enhance social media images"
    ]
  },

  "ocr-image": {
    reasons: [
      { icon: "target", tone: "blue", title: "High accuracy", note: "Tesseract OCR running on this server" },
      { icon: "globe", tone: "blue", title: "Multiple languages", note: "English, German, French, Spanish and Hindi" },
      { icon: "zap", tone: "orange", title: "Fast processing", note: "Get results in seconds" },
      { icon: "lock", tone: "green", title: "Secure & private", note: "No third-party OCR API is involved" },
      NO_ACCOUNT
    ],
    useCases: [
      "Extract text from scanned documents",
      "Copy text from images or screenshots",
      "Process receipts and invoices",
      "Extract text from photos",
      "Convert images to editable text"
    ]
  },

  "screenshot-to-text": {
    reasons: [
      { icon: "target", tone: "blue", title: "High accuracy", note: "Tuned for sparse UI text" },
      { icon: "globe", tone: "blue", title: "Multiple languages", note: "English, German, French, Spanish and Hindi" },
      { icon: "zap", tone: "orange", title: "Fast processing", note: "Get results in seconds" },
      NO_ACCOUNT,
      { icon: "lock", tone: "green", title: "Private & secure", note: "No third-party OCR API is involved" }
    ],
    useCases: [
      "Extract text from app screenshots",
      "Copy text from error messages",
      "Extract text from charts and dashboards",
      "Save text from social media posts",
      "Convert images to editable text"
    ]
  }
};

export function contentFor(tool: ToolId): ToolContent | undefined {
  return TOOL_CONTENT[tool];
}

/** Display metadata for the format badges. */
export const FORMAT_INFO: Record<FormatId, { label: string; color: string; note: string }> = {
  jpg: { label: "JPG", color: "#f97316", note: "Photos; smallest lossy files" },
  png: { label: "PNG", color: "#2f6fed", note: "Lossless, supports transparency" },
  webp: { label: "WebP", color: "#16a34a", note: "Modern web format, lossy or lossless" },
  avif: { label: "AVIF", color: "#7c4dee", note: "Newest format, best compression" },
  bmp: { label: "BMP", color: "#8d97a7", note: "Uncompressed bitmap" },
  tiff: { label: "TIFF", color: "#8d97a7", note: "Print and archival" },
  gif: { label: "GIF", color: "#0ea5e9", note: "256 colours, animation" },
  ico: { label: "ICO", color: "#2f6fed", note: "Windows and favicon icons" },
  heic: { label: "HEIC", color: "#e8912a", note: "iPhone photos (where the browser can read them)" },
  svg: { label: "SVG", color: "#e8912a", note: "Vector graphics" },
  pdf: { label: "PDF", color: "#dc2626", note: "Documents" }
};

/** Screen sizes offered by the resize presets, largest audience first. */
export const RESIZE_PRESETS: { id: string; label: string; width: number; height: number; brand: "instagram" | "facebook" | "youtube" | "linkedin" | "x" | "print" | "hd" }[] = [
  { id: "instagram-post", label: "Instagram Post", width: 1080, height: 1080, brand: "instagram" },
  { id: "instagram-story", label: "Instagram Story", width: 1080, height: 1920, brand: "instagram" },
  { id: "facebook-post", label: "Facebook Post", width: 1200, height: 630, brand: "facebook" },
  { id: "youtube-thumbnail", label: "YouTube Thumbnail", width: 1280, height: 720, brand: "youtube" },
  { id: "linkedin-post", label: "LinkedIn Post", width: 1200, height: 627, brand: "linkedin" },
  { id: "x-post", label: "X / Twitter Post", width: 1200, height: 675, brand: "x" },
  { id: "full-hd", label: "Full HD", width: 1920, height: 1080, brand: "hd" },
  { id: "a4-print", label: "A4 Print (300 DPI)", width: 2480, height: 3508, brand: "print" }
];
