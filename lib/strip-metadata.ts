/**
 * Lossless metadata removal.
 *
 * Re-encoding an image through a canvas does drop metadata, but it also
 * recompresses every pixel. Here the container is edited instead: metadata
 * segments and chunks are removed or rewritten and the compressed image data is
 * copied through untouched, byte for byte.
 *
 * Colour profiles are kept on purpose. They are not personal data, and dropping
 * one makes wide-gamut photos render with visibly wrong colours.
 */

import { crc32 } from "@/lib/zip";

export type StripMode = "all" | "gps" | "camera" | "software";

export type StripResult = {
  bytes: Uint8Array;
  mime: string;
  /** Plain-language list of what was taken out, for the result panel. */
  removed: string[];
};

/** Tags that identify the camera, lens or owner. */
const CAMERA_TAGS = new Set([0x010f, 0x0110, 0x927c, 0xa430, 0xa431, 0xa432, 0xa433, 0xa434, 0xa435]);
/** Tags that name the software or computer that produced the file. */
const SOFTWARE_TAGS = new Set([0x000b, 0x0131, 0x013c]);

const EXIF_POINTER = 0x8769;
const GPS_POINTER = 0x8825;
const INTEROP_POINTER = 0xa005;
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };

type RawEntry = { tag: number; type: number; count: number; data: Uint8Array };

const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, Math.min(bytes.length, at + length)));

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

/* -------------------------------------------------------------------------- */
/* TIFF (the EXIF payload) — read raw entries, write a trimmed copy             */
/* -------------------------------------------------------------------------- */

function readIfd(tiff: Uint8Array, view: DataView, start: number, little: boolean): RawEntry[] {
  if (start < 8 || start + 2 > tiff.length) return [];
  const count = view.getUint16(start, little);
  if (count > 512) return [];
  const entries: RawEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = start + 2 + index * 12;
    if (at + 12 > tiff.length) break;
    const type = view.getUint16(at + 2, little);
    const size = TYPE_SIZE[type];
    if (!size) continue;
    const valueCount = view.getUint32(at + 4, little);
    const bytes = size * valueCount;
    if (bytes > tiff.length) continue;
    const from = bytes <= 4 ? at + 8 : view.getUint32(at + 8, little);
    if (from + bytes > tiff.length) continue;
    entries.push({ tag: view.getUint16(at, little), type, count: valueCount, data: tiff.slice(from, from + bytes) });
  }
  return entries;
}

function pointerOf(entries: RawEntry[], tag: number, little: boolean) {
  const entry = entries.find((item) => item.tag === tag);
  if (!entry || entry.data.length < 4) return 0;
  return new DataView(entry.data.buffer, entry.data.byteOffset, 4).getUint32(0, little);
}

/**
 * Serialises one directory at `offset`. Values over four bytes go in a heap
 * directly after it; word alignment is kept because some readers insist.
 */
function writeIfd(entries: RawEntry[], offset: number, little: boolean): Uint8Array {
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);
  const directorySize = 2 + sorted.length * 12 + 4;
  const directory = new Uint8Array(directorySize);
  const view = new DataView(directory.buffer);
  const heap: Uint8Array[] = [];
  let heapSize = 0;

  view.setUint16(0, sorted.length, little);
  sorted.forEach((entry, index) => {
    const at = 2 + index * 12;
    view.setUint16(at, entry.tag, little);
    view.setUint16(at + 2, entry.type, little);
    view.setUint32(at + 4, entry.count, little);
    if (entry.data.length <= 4) {
      directory.set(entry.data, at + 8);
    } else {
      view.setUint32(at + 8, offset + directorySize + heapSize, little);
      heap.push(entry.data);
      heapSize += entry.data.length;
      if (heapSize % 2) { heap.push(new Uint8Array(1)); heapSize += 1; }
    }
  });
  // Next-IFD offset stays 0: IFD1 is the embedded thumbnail, which is dropped —
  // it can show the photo before it was cropped.
  return concat([directory, ...heap]);
}

function pointerEntry(tag: number, value: number, little: boolean): RawEntry {
  const data = new Uint8Array(4);
  new DataView(data.buffer).setUint32(0, value, little);
  return { tag, type: 4, count: 1, data };
}

/**
 * Returns a copy of the TIFF block without the fields `mode` targets, or null
 * when nothing worth keeping is left.
 */
export function rebuildExif(tiff: Uint8Array, mode: Exclude<StripMode, "all">): { bytes: Uint8Array | null; removed: string[] } {
  const removed: string[] = [];
  if (tiff.length < 8) return { bytes: null, removed };
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return { bytes: null, removed };
  const little = order === 0x4949;

  const ifd0 = readIfd(tiff, view, view.getUint32(4, little), little);
  const exif = readIfd(tiff, view, pointerOf(ifd0, EXIF_POINTER, little), little);
  let gps = readIfd(tiff, view, pointerOf(ifd0, GPS_POINTER, little), little);

  const drop = (entries: RawEntry[]) => entries.filter((entry) => {
    if (entry.tag === EXIF_POINTER || entry.tag === GPS_POINTER || entry.tag === INTEROP_POINTER) return false;
    // MakerNotes are vendor blobs that often hold serial numbers and use
    // absolute offsets that would break once moved, so they never survive.
    if (entry.tag === 0x927c) { if (!removed.includes("Maker notes")) removed.push("Maker notes"); return false; }
    if (mode === "camera" && CAMERA_TAGS.has(entry.tag)) return false;
    if (mode === "software" && SOFTWARE_TAGS.has(entry.tag)) return false;
    return true;
  });

  const before = ifd0.length + exif.length + gps.length;
  const keptIfd0 = drop(ifd0);
  const keptExif = drop(exif);
  if (mode === "gps" && gps.length) { removed.push("GPS location"); gps = []; }
  if (mode === "camera" && ifd0.concat(exif).some((entry) => CAMERA_TAGS.has(entry.tag) && entry.tag !== 0x927c)) removed.push("Camera and lens details");
  if (mode === "software" && ifd0.concat(exif).some((entry) => SOFTWARE_TAGS.has(entry.tag))) removed.push("Software details");

  if (!keptIfd0.length && !keptExif.length && !gps.length) return { bytes: null, removed };

  // Pointers are placeholders until the blocks before them have been measured.
  const withPointers = (exifAt: number, gpsAt: number) => [
    ...keptIfd0,
    ...(keptExif.length ? [pointerEntry(EXIF_POINTER, exifAt, little)] : []),
    ...(gps.length ? [pointerEntry(GPS_POINTER, gpsAt, little)] : [])
  ];
  const measured = writeIfd(withPointers(0, 0), 8, little);
  const exifAt = 8 + measured.length;
  const exifBlock = keptExif.length ? writeIfd(keptExif, exifAt, little) : new Uint8Array(0);
  const gpsAt = exifAt + exifBlock.length;
  const gpsBlock = gps.length ? writeIfd(gps, gpsAt, little) : new Uint8Array(0);
  const ifd0Block = writeIfd(withPointers(exifAt, gpsAt), 8, little);

  const header = new Uint8Array(8);
  const headerView = new DataView(header.buffer);
  headerView.setUint16(0, order);
  headerView.setUint16(2, 0x2a, little);
  headerView.setUint32(4, 8, little);

  if (before === keptIfd0.length + keptExif.length + gps.length && !removed.length) {
    return { bytes: tiff.slice(), removed };
  }
  return { bytes: concat([header, ifd0Block, exifBlock, gpsBlock]), removed };
}

/* -------------------------------------------------------------------------- */
/* JPEG                                                                       */
/* -------------------------------------------------------------------------- */

function segment(marker: number, payload: Uint8Array) {
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = ((payload.length + 2) >> 8) & 0xff;
  out[3] = (payload.length + 2) & 0xff;
  out.set(payload, 4);
  return out;
}

function stripJpeg(bytes: Uint8Array, mode: StripMode): StripResult {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  const removed = new Set<string>();
  let at = 2;

  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) throw new Error("This JPEG has a damaged header.");
    const marker = bytes[at + 1];
    if (marker === 0xff) { at += 1; continue; } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(at, at + 2));
      at += 2;
      continue;
    }
    // Start of scan: everything from here is compressed image data, kept verbatim.
    if (marker === 0xda || marker === 0xd9) { parts.push(bytes.subarray(at)); break; }

    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) throw new Error("This JPEG has a damaged segment.");
    const payload = bytes.subarray(at + 4, end);
    const whole = bytes.subarray(at, end);

    if (marker === 0xe1 && ascii(payload, 0, 4) === "Exif") {
      if (mode === "all") {
        removed.add("EXIF");
      } else {
        const rebuilt = rebuildExif(payload.subarray(6), mode);
        rebuilt.removed.forEach((item) => removed.add(item));
        if (rebuilt.bytes) parts.push(segment(0xe1, concat([payload.subarray(0, 6), rebuilt.bytes])));
      }
    } else if (marker === 0xe1) {
      // XMP (and extended XMP) repeats EXIF fields in XML, so it goes in every
      // mode — otherwise "remove GPS" could leave the coordinates behind.
      removed.add("XMP");
    } else if (marker === 0xed) {
      if (mode === "all" || mode === "gps") removed.add("IPTC");
      else parts.push(whole);
    } else if (marker === 0xfe) {
      if (mode === "all") removed.add("Comments");
      else parts.push(whole);
    } else if (marker === 0xe2 && ascii(payload, 0, 11) !== "ICC_PROFILE") {
      // APP2 also carries MPF, which embeds secondary images and depth maps.
      if (mode === "all") removed.add("Embedded previews");
      else parts.push(whole);
    } else if (marker >= 0xe3 && marker <= 0xef && marker !== 0xee) {
      if (mode === "all") removed.add("Vendor data");
      else parts.push(whole);
    } else {
      parts.push(whole); // APP0 JFIF, APP14 Adobe, ICC, tables, frame headers
    }
    at = end;
  }

  return { bytes: concat(parts), mime: "image/jpeg", removed: [...removed] };
}

/* -------------------------------------------------------------------------- */
/* PNG                                                                        */
/* -------------------------------------------------------------------------- */

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let index = 0; index < 4; index += 1) out[4 + index] = type.charCodeAt(index);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function stripPng(bytes: Uint8Array, mode: StripMode): StripResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  const removed = new Set<string>();
  let at = 8;

  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    const type = ascii(bytes, at + 4, 4);
    const end = at + 12 + length;
    if (end > bytes.length) throw new Error("This PNG has a damaged chunk.");
    const data = bytes.subarray(at + 8, at + 8 + length);
    const whole = bytes.subarray(at, end);

    if (type === "eXIf") {
      if (mode === "all") removed.add("EXIF");
      else {
        const rebuilt = rebuildExif(data, mode);
        rebuilt.removed.forEach((item) => removed.add(item));
        if (rebuilt.bytes) parts.push(chunk("eXIf", rebuilt.bytes));
      }
    } else if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const isXmp = ascii(data, 0, 17) === "XML:com.adobe.xmp";
      if (isXmp) removed.add("XMP");
      else if (mode === "all") removed.add("Text notes");
      else parts.push(whole);
    } else if (type === "tIME") {
      if (mode === "all") removed.add("Timestamps");
      else parts.push(whole);
    } else {
      parts.push(whole);
    }
    at = end;
    if (type === "IEND") break;
  }

  return { bytes: concat(parts), mime: "image/png", removed: [...removed] };
}

/* -------------------------------------------------------------------------- */
/* WebP                                                                       */
/* -------------------------------------------------------------------------- */

function stripWebp(bytes: Uint8Array, mode: StripMode): StripResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  const removed = new Set<string>();
  let at = 12;
  let hasExif = false;
  let vp8xIndex = -1;

  while (at + 8 <= bytes.length) {
    const type = ascii(bytes, at, 4);
    const length = view.getUint32(at + 4, true);
    const end = at + 8 + length + (length % 2);
    const data = bytes.subarray(at + 8, at + 8 + length);
    const whole = bytes.subarray(at, Math.min(end, bytes.length));

    if (type === "EXIF") {
      if (mode === "all") removed.add("EXIF");
      else {
        // Some writers (libvips among them) keep JPEG's "Exif\0\0" lead-in; keep
        // whatever convention the file already used.
        const lead = ascii(data, 0, 4) === "Exif" ? data.subarray(0, 6) : new Uint8Array(0);
        const rebuilt = rebuildExif(data.subarray(lead.length), mode);
        rebuilt.removed.forEach((item) => removed.add(item));
        if (rebuilt.bytes) {
          const payload = concat([lead, rebuilt.bytes]);
          const size = payload.length;
          const padded = new Uint8Array(8 + size + (size % 2));
          const padView = new DataView(padded.buffer);
          padded.set([0x45, 0x58, 0x49, 0x46]);
          padView.setUint32(4, size, true);
          padded.set(payload, 8);
          parts.push(padded);
          hasExif = true;
        }
      }
    } else if (type === "XMP ") {
      removed.add("XMP");
    } else {
      if (type === "VP8X") vp8xIndex = parts.length;
      parts.push(whole.slice());
    }
    at = end;
  }

  // The extended header advertises which metadata chunks follow; it has to
  // stop claiming the ones that were just removed.
  if (vp8xIndex >= 0) {
    const vp8x = parts[vp8xIndex];
    vp8x[8] = (vp8x[8] & ~0x0c) | (hasExif ? 0x08 : 0);
  }

  const body = concat(parts);
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46]);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  return { bytes: concat([header, body]), mime: "image/webp", removed: [...removed] };
}

/* -------------------------------------------------------------------------- */

export function canStripLosslessly(bytes: Uint8Array) {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return true;
  return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
}

/**
 * Removes metadata without touching the image data. Returns null for formats
 * this cannot edit in place; callers fall back to re-encoding those.
 */
export function stripMetadata(bytes: Uint8Array, mode: StripMode): StripResult | null {
  if (!canStripLosslessly(bytes)) return null;
  if (bytes[0] === 0xff) return stripJpeg(bytes, mode);
  if (bytes[0] === 0x89) return stripPng(bytes, mode);
  return stripWebp(bytes, mode);
}

export const STRIP_MODES: { value: StripMode; label: string; note: string }[] = [
  { value: "all", label: "Remove all metadata", note: "Recommended" },
  { value: "gps", label: "Remove GPS location only", note: "Keeps camera and date details" },
  { value: "camera", label: "Remove camera information only", note: "Make, model, lens and serial numbers" },
  { value: "software", label: "Remove software information only", note: "Editing apps and computer names" }
];
