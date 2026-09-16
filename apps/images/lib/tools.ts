export type ToolId =
  // Optimize
  | "image-compressor"
  | "resize-image"
  | "remove-metadata"
  // Transform
  | "crop-image"
  | "rotate-image"
  | "flip-image"
  | "watermark-image"
  | "add-border"
  | "rounded-corners"
  | "grayscale-image"
  | "sharpen-image"
  | "blur-image"
  // Convert
  | "image-converter"
  | "image-to-pdf"
  | "screenshot-to-pdf"
  | "image-to-base64"
  | "base64-to-image"
  | "favicon-generator"
  | "gif-to-frames"
  // AI & OCR
  | "background-removal"
  | "image-upscaler"
  | "ocr-image"
  | "screenshot-to-text"
  // Utility
  | "image-metadata-viewer"
  | "image-dimensions"
  | "image-compare"
  | "color-picker"
  | "color-palette-extractor"
  | "contact-sheet"
  | "image-collage";

export type ToolCategory = "Optimize" | "Transform" | "Convert" | "AI & OCR" | "Utility";

/** Where the work happens. `canvas` never leaves the browser; `worker` calls the Python service. */
export type ToolEngine =
  | "canvas"
  /** Encoded by Sharp on this app's own server: no third party, nothing stored. */
  | "server"
  | "worker"
  | "pdf"
  | "text"
  | "inspect"
  | "color"
  | "compose"
  | "favicon"
  | "frames"
  | "diff"
  | "none";

/** What the second column shows while the user tweaks settings. */
export type PreviewKind = "single" | "compare" | "pages" | "text" | "table" | "swatches" | "grid" | "none";

export type ToolDefinition = {
  id: ToolId;
  /** Sidebar label, also the page H1. */
  name: string;
  /** One-line sidebar caption. */
  tagline: string;
  /** Subtitle of the upload step. */
  uploadNote: string;
  /** Sentence under the H1. */
  description: string;
  category: ToolCategory;
  engine: ToolEngine;
  preview: PreviewKind;
  /** Accepts more than one file at a time. */
  multiple: boolean;
  /** Needs a pasted Base64 payload instead of a file. */
  needsBase64: boolean;
  output: "image" | "pdf" | "text";
  /** Five chips under the page heading. */
  highlights: string[];
  /** Label on the primary action button. */
  action: string;
  /** Message shown in the status bar once input is ready. */
  readyTitle: string;
  readyNote: string;
  /** Tools listed in the sidebar but not implemented in this release. */
  comingSoon?: true;
};

const COMMON_FORMATS = "JPG, PNG, WebP, BMP, TIFF";

export const TOOLS: ToolDefinition[] = [
  {
    id: "image-compressor",
    name: "Image Compressor",
    tagline: "Shrink image size",
    uploadNote: "Choose up to 20 images to compress",
    description: "Shrink image size with controlled quality. Keep the best balance between file size and visual quality.",
    category: "Optimize",
    engine: "server",
    preview: "compare",
    multiple: true,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed on our server", "No AI in core pipeline"],
    action: "Compress Images",
    readyTitle: "Your compressed images are ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "resize-image",
    name: "Resize Image",
    tagline: "Change dimensions",
    uploadNote: "Choose an image to resize",
    description: "Change image dimensions without unnecessary quality loss.",
    category: "Optimize",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Download Image",
    readyTitle: "Your resized image is ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "remove-metadata",
    name: "Remove Metadata",
    tagline: "Remove EXIF, GPS etc.",
    uploadNote: "Choose an image to clean",
    description: "Remove EXIF metadata, GPS location and other hidden information from your images.",
    category: "Optimize",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Download Image",
    readyTitle: "Your clean image is ready!",
    readyNote: "All metadata has been removed from the image."
  },
  {
    id: "crop-image",
    name: "Crop Image",
    tagline: "Extract exact area",
    uploadNote: "Choose an image to crop",
    description: "Extract the exact area you need from your image. Choose aspect ratio or set custom dimensions.",
    category: "Transform",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Download Image",
    readyTitle: "Your cropped image is ready!",
    readyNote: "Download your image or adjust the crop area."
  },
  {
    id: "rotate-image",
    name: "Rotate Image",
    tagline: "Rotate by 90°, 180° or 270°",
    uploadNote: "Choose an image to rotate",
    description: "Rotate your images by 90°, 180° or any angle. Preview the result before downloading.",
    category: "Transform",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Download Image",
    readyTitle: "Your rotated image is ready!",
    readyNote: "Download your image or try a different angle."
  },
  {
    id: "flip-image",
    name: "Flip Image",
    tagline: "Flip horizontally or vertically",
    uploadNote: "Choose an image to flip",
    description: "Flip your images horizontally or vertically. Preview the result before downloading.",
    category: "Transform",
    engine: "canvas",
    preview: "compare",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Download Image",
    readyTitle: "Your flipped image is ready!",
    readyNote: "Download your image or try the other direction."
  },
  {
    id: "watermark-image",
    name: "Watermark Image",
    tagline: "Add text or image watermark",
    uploadNote: "Choose an image to watermark",
    description: "Add text or image watermark to your photos. Protect your images with custom watermarks.",
    category: "Transform",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Multiple watermark types", "Fully customizable", "High quality output"],
    action: "Download Image",
    readyTitle: "Your watermarked image is ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "add-border",
    name: "Add Border",
    tagline: "Add custom border",
    uploadNote: "Choose an image to add a border",
    description: "Add a custom border to your images. Choose color, thickness, and style to make your images stand out.",
    category: "Transform",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Multiple border styles", "Fully customizable", "High quality output"],
    action: "Download Image",
    readyTitle: "Your bordered image is ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "rounded-corners",
    name: "Rounded Corners",
    tagline: "Make rounded corners",
    uploadNote: "Choose an image to round the corners",
    description: "Add rounded corners to your images. Choose the corner radius and preview in real-time.",
    category: "Transform",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Live preview", "Multiple corner styles", "High quality output"],
    action: "Download Image",
    readyTitle: "Your image with rounded corners is ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "grayscale-image",
    name: "Grayscale Image",
    tagline: "Convert to black & white",
    uploadNote: "Choose an image to convert to grayscale",
    description: "Convert your images to black and white. Remove color while keeping perfect detail and contrast.",
    category: "Transform",
    engine: "canvas",
    preview: "compare",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Multiple grayscale modes", "High quality output", "Supports all popular formats"],
    action: "Download Image",
    readyTitle: "Your grayscale image is ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "sharpen-image",
    name: "Sharpen Image",
    tagline: "Enhance image clarity",
    uploadNote: "Choose an image to sharpen",
    description: "Enhance the clarity and details of your images. Make blurry images look sharper with adjustable intensity.",
    category: "Transform",
    engine: "canvas",
    preview: "compare",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Unsharp masking", "Preview in real-time", "Supports all popular formats"],
    action: "Download Image",
    readyTitle: "Your sharpened image is ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "blur-image",
    name: "Blur Image",
    tagline: "Apply blur effect",
    uploadNote: "Choose an image to apply blur",
    description: "Apply blur to your images. Adjust the blur intensity to create a soft, smooth effect.",
    category: "Transform",
    engine: "canvas",
    preview: "compare",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Multiple blur types", "Real-time preview", "High quality output"],
    action: "Download Image",
    readyTitle: "Your blurred image is ready!",
    readyNote: "Download your image or try different settings."
  },
  {
    id: "image-converter",
    name: "Image Converter",
    tagline: "JPG, PNG, WebP, etc.",
    uploadNote: "Choose up to 20 images to convert",
    description: "Convert your images to different formats like JPG, PNG, WebP, AVIF, BMP, TIFF, GIF, ICO etc.",
    category: "Convert",
    engine: "server",
    preview: "single",
    multiple: true,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed on our server", "No AI in core pipeline"],
    action: "Convert Images",
    readyTitle: "Your converted images are ready!",
    readyNote: "Download each file, or all of them as a ZIP."
  },
  {
    id: "image-to-pdf",
    name: "Image to PDF",
    tagline: "Convert images to PDF",
    uploadNote: "Choose one or more images to convert to PDF",
    description: "Convert your images to a high-quality PDF file. Arrange, reorder and customize before downloading.",
    category: "Convert",
    engine: "pdf",
    preview: "pages",
    multiple: true,
    needsBase64: false,
    output: "pdf",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Create PDF",
    readyTitle: "Ready to convert!",
    readyNote: "Click convert to create your PDF file."
  },
  {
    id: "screenshot-to-pdf",
    name: "Screenshot to PDF",
    tagline: "Convert screenshots to PDF",
    uploadNote: "Capture your screen or choose screenshots",
    description: "Capture your screen or upload screenshots and convert them into a high-quality PDF file.",
    category: "Convert",
    engine: "pdf",
    preview: "pages",
    multiple: true,
    needsBase64: false,
    output: "pdf",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Create PDF",
    readyTitle: "Ready to convert!",
    readyNote: "Click convert to create your PDF file."
  },
  {
    id: "image-to-base64",
    name: "Image to Base64",
    tagline: "Convert image to Base64",
    uploadNote: "Choose an image to encode",
    description: "Convert your image file to a Base64 encoded string. Useful for embedding images in HTML, CSS, JSON or APIs.",
    category: "Convert",
    engine: "text",
    preview: "text",
    multiple: false,
    needsBase64: false,
    output: "text",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Copy Base64",
    readyTitle: "Base64 generated successfully!",
    readyNote: "Copy the output or download it as a text file."
  },
  {
    id: "base64-to-image",
    name: "Base64 to Image",
    tagline: "Decode Base64 to image",
    uploadNote: "Paste a Base64 payload to decode",
    description: "Decode a Base64 encoded string and convert it back to an image file. Useful for viewing or downloading images from text data.",
    category: "Convert",
    engine: "canvas",
    preview: "single",
    multiple: false,
    needsBase64: true,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed locally", "No AI in core pipeline"],
    action: "Download Image",
    readyTitle: "Your image is ready!",
    readyNote: "Download the decoded image."
  },
  {
    id: "favicon-generator",
    name: "Favicon Generator",
    tagline: "Create favicon from image",
    uploadNote: "Choose an image to convert to a favicon",
    description: "Create a favicon from your image in every size web, iOS and Android ask for, packaged with a manifest and the markup to paste.",
    category: "Convert",
    engine: "favicon",
    preview: "grid",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Multiple sizes", "Processed locally", "Instant download"],
    action: "Download All Files (ZIP)",
    readyTitle: "Your favicon set is ready!",
    readyNote: "Download the ZIP or grab an individual size."
  },
  {
    id: "gif-to-frames",
    name: "GIF to Frames",
    tagline: "Extract frames from GIF",
    uploadNote: "Choose an animated GIF to split",
    description: "Extract the individual frames from a GIF animation. Download them one at a time or all together as a ZIP.",
    category: "Convert",
    engine: "frames",
    preview: "grid",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Instant results", "Supports animated WebP", "Processed locally"],
    action: "Download Frames (ZIP)",
    readyTitle: "Frames extracted successfully!",
    readyNote: "Download every frame as a ZIP, or save one on its own."
  },
  {
    id: "background-removal",
    name: "Background Removal",
    tagline: "Remove image background",
    uploadNote: "Choose an image with a clear subject",
    description: "Remove image backgrounds automatically with AI. Get a clean, transparent background in seconds.",
    category: "AI & OCR",
    engine: "worker",
    preview: "compare",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed on our server", "AI-powered"],
    action: "Download PNG",
    readyTitle: "Background removed successfully!",
    readyNote: "Your image is ready to download with a transparent background."
  },
  {
    id: "image-upscaler",
    name: "Image Upscaler",
    tagline: "Enhance image quality",
    uploadNote: "Choose an image to upscale",
    description: "Increase image resolution and enhance quality with AI. Make your images sharper, clearer, and larger.",
    category: "AI & OCR",
    engine: "worker",
    preview: "compare",
    multiple: false,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Processed on our server", "AI-powered"],
    action: "Download PNG",
    readyTitle: "Image upscaled successfully!",
    readyNote: "Your high-resolution image is ready to download."
  },
  {
    id: "ocr-image",
    name: "OCR Image",
    tagline: "Extract text from images",
    uploadNote: "Choose an image containing text",
    description: "Extract text from images using AI-powered OCR. Works on printed text in many languages, entirely on this server.",
    category: "AI & OCR",
    engine: "worker",
    preview: "text",
    multiple: false,
    needsBase64: false,
    output: "text",
    highlights: ["100% Free", "No account required", "Processed on our server", "AI-powered"],
    action: "Download Text",
    readyTitle: "Text extracted successfully!",
    readyNote: "Your image has been processed using OCR."
  },
  {
    id: "screenshot-to-text",
    name: "Screenshot to Text",
    tagline: "Extract text from screenshots",
    uploadNote: "Choose a screenshot containing text",
    description: "Turn screenshot content into editable text, tuned for sparse UI layouts rather than dense pages.",
    category: "AI & OCR",
    engine: "worker",
    preview: "text",
    multiple: false,
    needsBase64: false,
    output: "text",
    highlights: ["100% Free", "No account required", "Processed on our server", "AI-powered OCR"],
    action: "Download Text",
    readyTitle: "Text extracted successfully!",
    readyNote: "Your screenshot has been processed using OCR."
  },
  {
    id: "image-metadata-viewer",
    name: "Image Metadata Viewer",
    tagline: "Inspect EXIF and GPS",
    uploadNote: "Choose an image to view its metadata",
    description: "View detailed metadata and EXIF information from your images. Check camera settings, location, date, and more.",
    category: "Utility",
    engine: "inspect",
    preview: "table",
    multiple: false,
    needsBase64: false,
    output: "text",
    highlights: ["100% Free", "No account required", "View EXIF, IPTC, XMP", "Processed locally", "Fast and secure"],
    action: "Download as JSON",
    readyTitle: "Metadata extracted successfully!",
    readyNote: "Copy the report or download it as JSON."
  },
  {
    id: "image-dimensions",
    name: "Image Dimensions",
    tagline: "Check width and height",
    uploadNote: "Choose an image to check its dimensions",
    description: "View and analyse the dimensions, resolution and size information of your images. Read straight from the file header.",
    category: "Utility",
    engine: "inspect",
    preview: "table",
    multiple: false,
    needsBase64: false,
    output: "text",
    highlights: ["100% Free", "No account required", "Instant results", "Processed locally", "Supports all popular formats"],
    action: "Copy All Information",
    readyTitle: "Dimensions read successfully!",
    readyNote: "Copy the details or move on to the resize tool."
  },
  {
    id: "image-compare",
    name: "Image Compare",
    tagline: "Compare two images",
    uploadNote: "Choose two images to compare",
    description: "Compare two images side by side and highlight the differences. Adjust the sensitivity to catch more or fewer changes.",
    category: "Utility",
    engine: "diff",
    preview: "compare",
    multiple: true,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Instant comparison", "Processed locally", "High quality output"],
    action: "Download Result",
    readyTitle: "Comparison complete!",
    readyNote: "Switch views or download the difference map."
  },
  {
    id: "color-picker",
    name: "Color Picker",
    tagline: "Pick colors from image",
    uploadNote: "Choose an image to pick colors from",
    description: "Pick any colour from your image and get its codes in HEX, RGB, HSL, HSV and CMYK. Click or use the arrow keys for pixel-level control.",
    category: "Utility",
    engine: "color",
    preview: "single",
    multiple: false,
    needsBase64: false,
    output: "text",
    highlights: ["100% Free", "No account required", "Instant results", "Processed locally", "Works on all devices"],
    action: "Copy All Color Codes",
    readyTitle: "Colour picked!",
    readyNote: "Copy any notation, or keep sampling the image."
  },
  {
    id: "color-palette-extractor",
    name: "Color Palette Extractor",
    tagline: "Extract dominant colors",
    uploadNote: "Choose an image to extract colors from",
    description: "Extract the dominant colours from your image and generate a palette. Copy the codes or download the palette as PNG or JSON.",
    category: "Utility",
    engine: "color",
    preview: "swatches",
    multiple: false,
    needsBase64: false,
    output: "text",
    highlights: ["100% Free", "No account required", "Instant results", "Processed locally", "Supports all popular formats"],
    action: "Copy Palette",
    readyTitle: "Palette extracted successfully!",
    readyNote: "Copy the palette or download it as PNG or JSON."
  },
  {
    id: "contact-sheet",
    name: "Contact Sheet",
    tagline: "Build a thumbnail sheet",
    uploadNote: "Choose the images for the sheet",
    description: "Combine multiple images into a single contact sheet with a customisable layout, spacing and captions.",
    category: "Utility",
    engine: "compose",
    preview: "grid",
    multiple: true,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Customisable layout", "Live preview", "High quality output"],
    action: "Download Sheet",
    readyTitle: "Your contact sheet is ready!",
    readyNote: "Download the sheet or adjust the layout."
  },
  {
    id: "image-collage",
    name: "Image Collage",
    tagline: "Combine images into one",
    uploadNote: "Choose the images for the collage",
    description: "Combine several images into a single collage. Choose a layout, spacing and corner style, then download the result.",
    category: "Utility",
    engine: "compose",
    preview: "grid",
    multiple: true,
    needsBase64: false,
    output: "image",
    highlights: ["100% Free", "No account required", "Multiple layouts", "Live preview", "High quality output"],
    action: "Download Collage",
    readyTitle: "Your collage is ready!",
    readyNote: "Download the collage or try a different layout."
  }
];

export const NAV_GROUPS: { label: string; category: ToolCategory }[] = [
  { label: "OPTIMIZE", category: "Optimize" },
  { label: "TRANSFORM", category: "Transform" },
  { label: "CONVERT", category: "Convert" },
  { label: "AI & OCR", category: "AI & OCR" },
  { label: "UTILITY", category: "Utility" }
];

export const TOOLS_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

export const READY_TOOLS = TOOLS.filter((tool) => !tool.comingSoon);

export const DEFAULT_TOOL: ToolId = "image-compressor";

export function isToolId(value: string): value is ToolId {
  return TOOLS_BY_ID.has(value as ToolId);
}

export function getTool(value: string): ToolDefinition | undefined {
  return TOOLS_BY_ID.get(value as ToolId);
}

export function acceptedFormats(tool: ToolDefinition) {
  if (tool.category === "AI & OCR") return COMMON_FORMATS;
  if (tool.id === "gif-to-frames") return "GIF, animated WebP";
  if (tool.id === "favicon-generator") return "PNG, JPG, WebP, SVG";
  if (tool.id === "image-converter") return "JPG, PNG, WebP, AVIF, GIF, BMP, TIFF, ICO, and HEIC in Safari";
  if (tool.id === "image-to-pdf") return `${COMMON_FORMATS}, GIF, HEIC`;
  return `${COMMON_FORMATS}, GIF`;
}

export const FORMAT_LABELS = ["jpeg", "png", "webp", "avif"] as const;
export type OutputFormat = (typeof FORMAT_LABELS)[number];

export function safeInteger(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function parseBase64(value: string): { buffer: Buffer; mime?: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s);
  const encoded = match?.[2] ?? trimmed;
  if (!encoded || encoded.length > 45_000_000 || !/^[a-zA-Z0-9+/=\s]+$/.test(encoded)) {
    throw new Error("Enter a valid Base64 image payload.");
  }
  const normalized = encoded.replace(/\s/g, "");
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > 32 * 1024 * 1024) throw new Error("The decoded image must be between 1 byte and 32 MB.");
  return { buffer, mime: match?.[1] };
}
