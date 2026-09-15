/**
 * Base64 image payloads: parsing what people paste, and the snippets the
 * encoder offers. Pure functions, shared by both Base64 tools and the tests.
 */

export type DecodedPayload = {
  bytes: Uint8Array;
  /** Base64 normalised to the standard alphabet, padded, with no whitespace. */
  base64: string;
  /** What the bytes actually are, from their signature. */
  mime: string | null;
  /** What a data URI claimed, if there was one. */
  declared: string | null;
};

const DATA_URI = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?((?:;[a-z0-9-]+=[^;,]*)*)(;base64)?,/i;

/** Reads the leading bytes: the only trustworthy answer to "what is this file". */
export function sniffImageType(bytes: Uint8Array): string | null {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes[0] === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 4) === "ftyp" && /avi[fs]/.test(ascii(8, 4))) return "image/avif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "image/x-icon";
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[3] === 0x2a)) return "image/tiff";
  const head = ascii(0, Math.min(bytes.length, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

/**
 * Accepts a data URI or bare Base64, standard or URL-safe, with or without
 * padding and line breaks. Throws with a message fit to show the user.
 */
export function decodeBase64Payload(text: string, maxBytes = 32 * 1024 * 1024): DecodedPayload {
  let body = text.trim();
  if (!body) throw new Error("Paste a Base64 string first.");

  let declared: string | null = null;
  const uri = body.match(DATA_URI);
  if (uri) {
    if (!uri[3]) throw new Error("That data URI is not Base64-encoded.");
    declared = uri[1]?.toLowerCase() ?? null;
    body = body.slice(uri[0].length);
  }

  body = body.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(body)) throw new Error("That text contains characters that are not valid in Base64.");
  const unpadded = body.replace(/=+$/, "");
  if (unpadded.length % 4 === 1) throw new Error("That Base64 string is incomplete; it may have been cut off.");
  const base64 = unpadded + "=".repeat((4 - (unpadded.length % 4)) % 4);
  if ((base64.length / 4) * 3 > maxBytes + 2) throw new Error("The decoded image would be larger than 32 MB.");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (!bytes.length) throw new Error("That Base64 string is empty.");

  return { bytes, base64, mime: sniffImageType(bytes), declared };
}

export type SnippetMode = "data-uri" | "raw" | "html" | "css" | "json";

export const SNIPPET_MODES: { value: SnippetMode; label: string }[] = [
  { value: "data-uri", label: "Data URL (with prefix)" },
  { value: "raw", label: "Raw Base64" },
  { value: "html", label: "HTML <img> tag" },
  { value: "css", label: "CSS background" },
  { value: "json", label: "JSON" }
];

/** Wraps a data URI in the chosen form, ready to paste. */
export function toSnippet(mode: SnippetMode, dataUri: string, meta: { name: string; width: number; height: number }) {
  const [, payload = ""] = dataUri.split(",");
  const mime = dataUri.slice(5, dataUri.indexOf(";"));
  const alt = meta.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/"/g, "&quot;");
  switch (mode) {
    case "raw": return payload;
    case "html": return `<img src="${dataUri}" alt="${alt}" width="${meta.width}" height="${meta.height}" />`;
    case "css": return `background-image: url("${dataUri}");`;
    case "json": return JSON.stringify({ name: meta.name, mime, width: meta.width, height: meta.height, data: payload }, null, 2);
    default: return dataUri;
  }
}
