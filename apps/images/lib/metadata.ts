/**
 * Container and metadata reader.
 *
 * Everything here works on the raw bytes of the file the user picked, in the
 * browser, with no dependency and no upload. Only the parts real cameras and
 * editors actually write are decoded — the goal is an honest report, not a
 * complete implementation of TIFF 6.0.
 */

export type MetadataField = {
  /** Stable key, used for copy/JSON output. */
  key: string;
  label: string;
  value: string;
};

export type GpsFix = {
  latitude: number;
  longitude: number;
  /** Metres above sea level, when the file records it. */
  altitude?: number;
};

export type FileFacts = {
  width: number;
  height: number;
  /** Short format label, e.g. "JPEG". */
  format: string;
  mime: string;
  /** Bits per channel, when the container states it. */
  bitDepth?: number;
  /** "RGB", "sRGB", "Grayscale", … as far as the container reveals. */
  colorSpace?: string;
  /** Horizontal and vertical pixels per inch. */
  dpi?: { x: number; y: number };
  /** Frame count for animated GIF and WebP. */
  frames?: number;
  /** Progressive JPEG / interlaced PNG. */
  progressive?: boolean;
  hasAlpha?: boolean;
  /** EXIF orientation, 1–8. */
  orientation?: number;
};

export type ImageMetadata = {
  file: MetadataField[];
  exif: MetadataField[];
  iptc: MetadataField[];
  xmp: MetadataField[];
  gps: GpsFix | null;
  facts: FileFacts;
  /** How many metadata fields were found outside the File info tab. */
  count: number;
};

export class MetadataError extends Error {}

/* -------------------------------------------------------------------------- */
/* Byte helpers                                                               */
/* -------------------------------------------------------------------------- */

const ascii = (view: DataView, offset: number, length: number) => {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
};

const tag = (view: DataView, offset: number) => ascii(view, offset, 4);

/** Decodes UTF-8 with a latin-1 fallback, so odd IPTC records still read. */
function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

const round = (value: number, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/* -------------------------------------------------------------------------- */
/* EXIF / TIFF                                                                */
/* -------------------------------------------------------------------------- */

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

type IfdValue = number | number[] | string;

const EXIF_TAGS: Record<number, string> = {
  0x010e: "Image Description",
  0x010f: "Camera Make",
  0x0110: "Camera Model",
  0x0112: "Orientation",
  0x011a: "X Resolution",
  0x011b: "Y Resolution",
  0x0128: "Resolution Unit",
  0x0131: "Software",
  0x0132: "Date Modified",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x829a: "Exposure Time",
  0x829d: "F Number",
  0x8822: "Exposure Program",
  0x8827: "ISO",
  0x9003: "Date Taken",
  0x9004: "Date Digitized",
  0x9201: "Shutter Speed",
  0x9202: "Aperture",
  0x9204: "Exposure Bias",
  0x9205: "Max Aperture",
  0x9207: "Metering Mode",
  0x9208: "Light Source",
  0x9209: "Flash",
  0x920a: "Focal Length",
  0x927c: "Maker Note",
  0x9286: "User Comment",
  0xa001: "Color Space",
  0xa002: "Image Width",
  0xa003: "Image Height",
  0xa402: "Exposure Mode",
  0xa403: "White Balance",
  0xa405: "Focal Length (35mm)",
  0xa406: "Scene Capture Type",
  0xa408: "Contrast",
  0xa409: "Saturation",
  0xa40a: "Sharpness",
  0xa420: "Image Unique ID",
  0xa430: "Camera Owner",
  0xa431: "Body Serial Number",
  0xa433: "Lens Make",
  0xa434: "Lens Model",
  0xa435: "Lens Serial Number"
};

const GPS_TAGS: Record<number, string> = {
  0x0001: "GPS Latitude Ref",
  0x0002: "GPS Latitude",
  0x0003: "GPS Longitude Ref",
  0x0004: "GPS Longitude",
  0x0005: "GPS Altitude Ref",
  0x0006: "GPS Altitude",
  0x0007: "GPS Timestamp",
  0x000b: "GPS Precision",
  0x000c: "GPS Speed Ref",
  0x000d: "GPS Speed",
  0x0010: "GPS Direction Ref",
  0x0011: "GPS Direction",
  0x001d: "GPS Date"
};

const ORIENTATION: Record<number, string> = {
  1: "Horizontal (normal)",
  2: "Mirrored horizontally",
  3: "Rotated 180°",
  4: "Mirrored vertically",
  5: "Mirrored horizontally, rotated 270°",
  6: "Rotated 90° clockwise",
  7: "Mirrored horizontally, rotated 90°",
  8: "Rotated 270° clockwise"
};

const ENUMS: Record<number, Record<number, string>> = {
  0x0128: { 1: "None", 2: "Inches", 3: "Centimetres" },
  0x8822: { 0: "Not defined", 1: "Manual", 2: "Program", 3: "Aperture priority", 4: "Shutter priority", 5: "Creative", 6: "Action", 7: "Portrait", 8: "Landscape" },
  0x9207: { 0: "Unknown", 1: "Average", 2: "Centre-weighted", 3: "Spot", 4: "Multi-spot", 5: "Pattern", 6: "Partial" },
  0xa001: { 1: "sRGB", 0xffff: "Uncalibrated" },
  0xa402: { 0: "Auto", 1: "Manual", 2: "Auto bracket" },
  0xa403: { 0: "Auto", 1: "Manual" },
  0xa406: { 0: "Standard", 1: "Landscape", 2: "Portrait", 3: "Night" }
};

type RawEntry = { tag: number; value: IfdValue };

function readIfd(view: DataView, start: number, tiffStart: number, little: boolean, seen: Set<number>): RawEntry[] {
  if (seen.has(start) || start + 2 > view.byteLength) return [];
  seen.add(start);

  const count = view.getUint16(start, little);
  // A directory claiming thousands of entries is corrupt, not ambitious.
  if (count > 512) return [];

  const entries: RawEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = start + 2 + i * 12;
    if (at + 12 > view.byteLength) break;
    const tagId = view.getUint16(at, little);
    const type = view.getUint16(at + 2, little);
    const length = view.getUint32(at + 4, little);
    const size = TYPE_SIZE[type];
    if (!size || length > 1_000_000) continue;

    const bytes = size * length;
    const valueAt = bytes <= 4 ? at + 8 : tiffStart + view.getUint32(at + 8, little);
    if (valueAt < 0 || valueAt + bytes > view.byteLength) continue;

    entries.push({ tag: tagId, value: readValue(view, valueAt, type, length, little) });
  }
  return entries;
}

function readValue(view: DataView, at: number, type: number, length: number, little: boolean): IfdValue {
  if (type === 2) return ascii(view, at, length).trim();
  if (type === 7) return `${length} bytes`;

  const values: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const offset = at + i * TYPE_SIZE[type];
    if (type === 1 || type === 6) values.push(view.getUint8(offset));
    else if (type === 3) values.push(view.getUint16(offset, little));
    else if (type === 8) values.push(view.getInt16(offset, little));
    else if (type === 4) values.push(view.getUint32(offset, little));
    else if (type === 9) values.push(view.getInt32(offset, little));
    else if (type === 11) values.push(view.getFloat32(offset, little));
    else if (type === 12) values.push(view.getFloat64(offset, little));
    else if (type === 5) {
      const denominator = view.getUint32(offset + 4, little);
      values.push(denominator ? view.getUint32(offset, little) / denominator : 0);
    } else if (type === 10) {
      const denominator = view.getInt32(offset + 4, little);
      values.push(denominator ? view.getInt32(offset, little) / denominator : 0);
    }
  }
  return values.length === 1 ? values[0] : values;
}

/** Turns one raw tag into the string a person expects to read. */
function presentExif(tagId: number, value: IfdValue): string {
  if (typeof value === "string") return value;
  const single = Array.isArray(value) ? value[0] : value;

  if (tagId === 0x0112) return `${ORIENTATION[single] ?? "Unknown"} (${single})`;
  if (ENUMS[tagId]) return ENUMS[tagId][single] ?? String(single);
  if (tagId === 0x9209) return single === 0 ? "No flash" : `Flash fired (${single})`;
  if (tagId === 0x829a) return single >= 1 ? `${round(single, 1)} sec` : `1/${Math.round(1 / single)} sec`;
  if (tagId === 0x829d || tagId === 0x9202 || tagId === 0x9205) return `f/${round(single, 1)}`;
  if (tagId === 0x920a) return `${round(single, 2)} mm`;
  if (tagId === 0xa405) return `${Math.round(single)} mm`;
  if (tagId === 0x9204) return `${single > 0 ? "+" : ""}${round(single, 2)} EV`;
  if (tagId === 0x011a || tagId === 0x011b) return `${round(single, 0)} DPI`;
  if (tagId === 0x8827) return `ISO ${Math.round(single)}`;
  if (Array.isArray(value)) return value.map((item) => round(item, 4)).join(", ");
  return String(round(single, 4));
}

/** EXIF stores dates as "YYYY:MM:DD HH:MM:SS"; only the date half uses colons. */
function presentDate(value: string) {
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}` : value;
}

function toDecimal(parts: number[], ref: string) {
  const [degrees = 0, minutes = 0, seconds = 0] = parts;
  const value = degrees + minutes / 60 + seconds / 3600;
  return ref === "S" || ref === "W" ? -value : value;
}

export type ExifResult = { fields: MetadataField[]; gps: GpsFix | null; orientation?: number; colorSpace?: string; dpi?: { x: number; y: number } };

/** Parses a TIFF block — the payload of a JPEG APP1 or a PNG `eXIf` chunk. */
export function parseExif(bytes: Uint8Array): ExifResult {
  const empty: ExifResult = { fields: [], gps: null };
  if (bytes.byteLength < 8) return empty;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return empty;
  const little = order === 0x4949;
  if (view.getUint16(2, little) !== 0x002a) return empty;

  const seen = new Set<number>();
  const ifd0 = readIfd(view, view.getUint32(4, little), 0, little, seen);
  const pointer = (tagId: number) => {
    const found = ifd0.find((entry) => entry.tag === tagId);
    const value = Array.isArray(found?.value) ? found?.value[0] : found?.value;
    return typeof value === "number" ? value : 0;
  };

  const exifIfd = pointer(0x8769) ? readIfd(view, pointer(0x8769), 0, little, seen) : [];
  const gpsIfd = pointer(0x8825) ? readIfd(view, pointer(0x8825), 0, little, seen) : [];

  const fields: MetadataField[] = [];
  const push = (key: string, label: string, value: string) => {
    if (value === "" || value === "0" || fields.some((field) => field.key === key)) return;
    fields.push({ key, label, value });
  };

  for (const entry of [...ifd0, ...exifIfd]) {
    const label = EXIF_TAGS[entry.tag];
    // Pointers and thumbnails are plumbing, not information.
    if (!label || entry.tag === 0x8769 || entry.tag === 0x8825 || entry.tag === 0x927c) continue;
    const value = typeof entry.value === "string" && /Date/.test(label)
      ? presentDate(entry.value)
      : presentExif(entry.tag, entry.value);
    push(`exif.${entry.tag}`, label, value);
  }

  const gpsValues = new Map<number, IfdValue>();
  for (const entry of gpsIfd) {
    gpsValues.set(entry.tag, entry.value);
    const label = GPS_TAGS[entry.tag];
    if (!label || entry.tag === 0x0002 || entry.tag === 0x0004) continue;
    push(`gps.${entry.tag}`, label, Array.isArray(entry.value) ? entry.value.map((item) => round(item, 3)).join(":") : String(entry.value));
  }

  let gps: GpsFix | null = null;
  const latitude = gpsValues.get(0x0002);
  const longitude = gpsValues.get(0x0004);
  if (Array.isArray(latitude) && Array.isArray(longitude) && latitude.length === 3 && longitude.length === 3) {
    const lat = toDecimal(latitude, String(gpsValues.get(0x0001) ?? "N"));
    const lon = toDecimal(longitude, String(gpsValues.get(0x0003) ?? "E"));
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      const rawAltitude = gpsValues.get(0x0006);
      const altitude = typeof rawAltitude === "number" ? rawAltitude : undefined;
      gps = { latitude: round(lat, 6), longitude: round(lon, 6), altitude: altitude ? round(altitude, 1) : undefined };
      fields.unshift({
        key: "gps.location",
        label: "GPS Location",
        value: `${Math.abs(gps.latitude).toFixed(4)}° ${gps.latitude >= 0 ? "N" : "S"}, ${Math.abs(gps.longitude).toFixed(4)}° ${gps.longitude >= 0 ? "E" : "W"}`
      });
    }
  }

  const rawOrientation = ifd0.find((entry) => entry.tag === 0x0112)?.value;
  const rawColorSpace = exifIfd.find((entry) => entry.tag === 0xa001)?.value;
  const xResolution = ifd0.find((entry) => entry.tag === 0x011a)?.value;
  const yResolution = ifd0.find((entry) => entry.tag === 0x011b)?.value;

  return {
    fields,
    gps,
    orientation: typeof rawOrientation === "number" ? rawOrientation : undefined,
    colorSpace: rawColorSpace === 1 ? "sRGB" : rawColorSpace === 0xffff ? "Uncalibrated" : undefined,
    dpi: typeof xResolution === "number" && xResolution > 0
      ? { x: Math.round(xResolution), y: Math.round(typeof yResolution === "number" ? yResolution : xResolution) }
      : undefined
  };
}

/* -------------------------------------------------------------------------- */
/* IPTC (IIM, inside a Photoshop 8BIM resource block)                          */
/* -------------------------------------------------------------------------- */

const IPTC_TAGS: Record<number, string> = {
  5: "Object Name",
  15: "Category",
  20: "Keywords",
  25: "Supplemental Category",
  40: "Special Instructions",
  55: "Date Created",
  80: "Byline",
  85: "Byline Title",
  90: "City",
  92: "Sub-location",
  95: "Province / State",
  101: "Country",
  103: "Transmission Reference",
  105: "Headline",
  110: "Credit",
  115: "Source",
  116: "Copyright Notice",
  120: "Caption",
  122: "Caption Writer"
};

function parseIptc(bytes: Uint8Array): MetadataField[] {
  const fields: MetadataField[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const merged = new Map<number, string[]>();

  for (let at = 0; at + 5 < bytes.byteLength; ) {
    if (view.getUint8(at) !== 0x1c) { at += 1; continue; }
    const record = view.getUint8(at + 1);
    const dataset = view.getUint8(at + 2);
    let length = view.getUint16(at + 3);
    let valueAt = at + 5;
    // The high bit marks an extended length whose size is in the low bits.
    if (length & 0x8000) {
      const lengthSize = length & 0x7fff;
      if (lengthSize !== 4 || valueAt + 4 > bytes.byteLength) break;
      length = view.getUint32(valueAt);
      valueAt += 4;
    }
    if (valueAt + length > bytes.byteLength) break;
    if (record === 2 && IPTC_TAGS[dataset]) {
      const value = decodeText(bytes.subarray(valueAt, valueAt + length)).trim();
      if (value) merged.set(dataset, [...(merged.get(dataset) ?? []), value]);
    }
    at = valueAt + length;
  }

  for (const [dataset, values] of [...merged.entries()].sort((a, b) => a[0] - b[0])) {
    fields.push({ key: `iptc.${dataset}`, label: IPTC_TAGS[dataset], value: values.join(", ") });
  }
  return fields;
}

/** Walks the 8BIM resource blocks looking for resource 0x0404, the IIM payload. */
function parsePhotoshopResource(bytes: Uint8Array): MetadataField[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 0; at + 12 < bytes.byteLength; ) {
    if (tag(view, at) !== "8BIM") break;
    const id = view.getUint16(at + 4);
    const nameLength = view.getUint8(at + 6);
    // The Pascal name is padded so the whole field occupies an even byte count.
    const afterName = at + 6 + 1 + nameLength + ((nameLength + 1) % 2);
    if (afterName + 4 > bytes.byteLength) break;
    const size = view.getUint32(afterName);
    const dataAt = afterName + 4;
    if (dataAt + size > bytes.byteLength) break;
    if (id === 0x0404) return parseIptc(bytes.subarray(dataAt, dataAt + size));
    at = dataAt + size + (size % 2);
  }
  return [];
}

/* -------------------------------------------------------------------------- */
/* XMP                                                                        */
/* -------------------------------------------------------------------------- */

const XMP_LABELS: Record<string, string> = {
  "dc:title": "Title",
  "dc:description": "Description",
  "dc:creator": "Creator",
  "dc:rights": "Rights",
  "dc:subject": "Subject",
  "xmp:CreateDate": "Create Date",
  "xmp:ModifyDate": "Modify Date",
  "xmp:CreatorTool": "Creator Tool",
  "xmp:Rating": "Rating",
  "xmp:Label": "Label",
  "photoshop:Credit": "Credit",
  "photoshop:Headline": "Headline",
  "photoshop:City": "City",
  "photoshop:Country": "Country",
  "photoshop:DateCreated": "Date Created",
  "tiff:Make": "Make",
  "tiff:Model": "Model",
  "exif:LensModel": "Lens Model",
  "aux:Lens": "Lens",
  "crs:Version": "Camera Raw Version",
  "Iptc4xmpCore:Location": "Location"
};

/**
 * XMP is RDF/XML. A full parser is overkill for a viewer, so the well-known
 * properties are pulled out both as attributes and as elements, which is how
 * the two common serialisations write them.
 */
function parseXmp(packet: string): MetadataField[] {
  const fields: MetadataField[] = [];
  const push = (key: string, value: string) => {
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean || fields.some((field) => field.key === `xmp.${key}`)) return;
    fields.push({ key: `xmp.${key}`, label: XMP_LABELS[key] ?? key, value: clean });
  };

  for (const key of Object.keys(XMP_LABELS)) {
    const escaped = key.replace(":", "\\:");
    const attribute = packet.match(new RegExp(`${escaped}="([^"]*)"`));
    if (attribute) { push(key, attribute[1]); continue; }

    const element = packet.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`));
    if (!element) continue;
    const inner = element[1];
    const items = [...inner.matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/g)].map((match) => match[1]);
    push(key, (items.length ? items.join(", ") : inner).replace(/<[^>]+>/g, " "));
  }
  return fields;
}

/* -------------------------------------------------------------------------- */
/* Containers                                                                 */
/* -------------------------------------------------------------------------- */

type Parsed = {
  exif: ExifResult;
  iptc: MetadataField[];
  xmp: MetadataField[];
  facts: Partial<FileFacts>;
};

const JPEG_COLOR: Record<number, string> = { 1: "Grayscale", 3: "YCbCr (RGB)", 4: "CMYK / YCCK" };

function parseJpeg(bytes: Uint8Array, view: DataView): Parsed {
  const result: Parsed = { exif: { fields: [], gps: null }, iptc: [], xmp: [], facts: { format: "JPEG", mime: "image/jpeg" } };
  let at = 2;

  while (at + 4 <= bytes.byteLength) {
    if (view.getUint8(at) !== 0xff) { at += 1; continue; }
    const marker = view.getUint8(at + 1);
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    // Entropy-coded data begins at SOS; nothing after it is metadata.
    if (marker === 0xda || marker === 0xd9) break;

    const length = view.getUint16(at + 2);
    if (length < 2 || at + 2 + length > bytes.byteLength) break;
    const payload = bytes.subarray(at + 4, at + 2 + length);

    if (marker === 0xe0 && ascii(view, at + 4, 5) === "JFIF" && payload.byteLength >= 12) {
      const units = payload[7];
      const x = (payload[8] << 8) | payload[9];
      const y = (payload[10] << 8) | payload[11];
      if (units === 1 && x > 0) result.facts.dpi = { x, y: y || x };
      else if (units === 2 && x > 0) result.facts.dpi = { x: Math.round(x * 2.54), y: Math.round((y || x) * 2.54) };
    } else if (marker === 0xe1 && ascii(view, at + 4, 4) === "Exif") {
      result.exif = parseExif(payload.subarray(6));
    } else if (marker === 0xe1 && ascii(view, at + 4, 28).startsWith("http://ns.adobe.com/xap/1.0/")) {
      result.xmp = parseXmp(decodeText(payload.subarray(29)));
    } else if (marker === 0xed && ascii(view, at + 4, 13) === "Photoshop 3.0") {
      result.iptc = parsePhotoshopResource(payload.subarray(14));
    } else if (marker === 0xfe) {
      const comment = decodeText(payload).trim();
      if (comment) result.xmp.push({ key: "jpeg.comment", label: "Comment", value: comment });
    } else if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      result.facts.bitDepth = payload[0];
      result.facts.height = (payload[1] << 8) | payload[2];
      result.facts.width = (payload[3] << 8) | payload[4];
      result.facts.colorSpace = JPEG_COLOR[payload[5]] ?? `${payload[5]} components`;
      result.facts.progressive = marker === 0xc2 || marker === 0xc6 || marker === 0xca;
      result.facts.hasAlpha = false;
    }

    at += 2 + length;
  }
  return result;
}

const PNG_COLOR: Record<number, string> = {
  0: "Grayscale",
  2: "RGB",
  3: "Indexed (palette)",
  4: "Grayscale + alpha",
  6: "RGB + alpha"
};

function parsePng(bytes: Uint8Array, view: DataView): Parsed {
  const result: Parsed = { exif: { fields: [], gps: null }, iptc: [], xmp: [], facts: { format: "PNG", mime: "image/png" } };
  const text: MetadataField[] = [];
  let frames = 0;
  let at = 8;

  while (at + 8 <= bytes.byteLength) {
    const length = view.getUint32(at);
    const name = tag(view, at + 4);
    const dataAt = at + 8;
    if (length > bytes.byteLength || dataAt + length > bytes.byteLength) break;
    const payload = bytes.subarray(dataAt, dataAt + length);

    if (name === "IHDR") {
      result.facts.width = view.getUint32(dataAt);
      result.facts.height = view.getUint32(dataAt + 4);
      result.facts.bitDepth = payload[8];
      result.facts.colorSpace = PNG_COLOR[payload[9]] ?? "Unknown";
      result.facts.hasAlpha = payload[9] === 4 || payload[9] === 6;
      result.facts.progressive = payload[12] === 1;
    } else if (name === "pHYs" && payload[8] === 1) {
      // Stored as pixels per metre when the unit byte is 1.
      result.facts.dpi = {
        x: Math.round(view.getUint32(dataAt) * 0.0254),
        y: Math.round(view.getUint32(dataAt + 4) * 0.0254)
      };
    } else if (name === "eXIf") {
      result.exif = parseExif(payload);
    } else if (name === "acTL") {
      frames = view.getUint32(dataAt);
    } else if (name === "tEXt" || name === "iTXt" || name === "zTXt") {
      const separator = payload.indexOf(0);
      if (separator > 0) {
        const keyword = decodeText(payload.subarray(0, separator));
        // iTXt adds compression flag, method and two language fields; zTXt and
        // any compressed iTXt need inflate, which is not worth pulling in here.
        const compressed = name === "zTXt" || (name === "iTXt" && payload[separator + 1] === 1);
        if (!compressed) {
          const valueAt = name === "iTXt"
            ? payload.indexOf(0, payload.indexOf(0, separator + 3) + 1) + 1
            : separator + 1;
          const value = decodeText(payload.subarray(valueAt)).trim();
          if (keyword === "XML:com.adobe.xmp") result.xmp.push(...parseXmp(value));
          else if (value) text.push({ key: `png.${keyword}`, label: keyword, value });
        }
      }
    } else if (name === "IEND") {
      break;
    }

    at = dataAt + length + 4;
  }

  if (frames > 1) result.facts.frames = frames;
  result.iptc = text;
  return result;
}

function parseWebp(bytes: Uint8Array, view: DataView): Parsed {
  const result: Parsed = { exif: { fields: [], gps: null }, iptc: [], xmp: [], facts: { format: "WebP", mime: "image/webp" } };
  let frames = 0;
  let at = 12;

  while (at + 8 <= bytes.byteLength) {
    const name = tag(view, at);
    const length = view.getUint32(at + 4, true);
    const dataAt = at + 8;
    if (dataAt + length > bytes.byteLength) break;
    const payload = bytes.subarray(dataAt, dataAt + length);

    if (name === "VP8X") {
      // 24-bit little-endian canvas size, stored minus one.
      result.facts.width = 1 + (payload[4] | (payload[5] << 8) | (payload[6] << 16));
      result.facts.height = 1 + (payload[7] | (payload[8] << 8) | (payload[9] << 16));
      result.facts.hasAlpha = Boolean(payload[0] & 0x10);
    } else if (name === "VP8 " && !result.facts.width) {
      result.facts.width = view.getUint16(dataAt + 6, true) & 0x3fff;
      result.facts.height = view.getUint16(dataAt + 8, true) & 0x3fff;
    } else if (name === "VP8L" && !result.facts.width) {
      const bits = payload[1] | (payload[2] << 8) | (payload[3] << 16) | (payload[4] << 24);
      result.facts.width = (bits & 0x3fff) + 1;
      result.facts.height = ((bits >> 14) & 0x3fff) + 1;
    } else if (name === "ANMF") {
      frames += 1;
    } else if (name === "EXIF") {
      // The spec calls for bare TIFF, but libvips (and so Sharp) keeps JPEG's "Exif\0\0" lead-in.
      result.exif = parseExif(ascii(view, dataAt, 4) === "Exif" ? payload.subarray(6) : payload);
    } else if (name === "XMP ") {
      result.xmp = parseXmp(decodeText(payload));
    }

    at = dataAt + length + (length % 2);
  }

  result.facts.colorSpace = "YUV (RGB)";
  if (frames > 1) result.facts.frames = frames;
  return result;
}

function parseGif(bytes: Uint8Array, view: DataView): Parsed {
  const result: Parsed = {
    exif: { fields: [], gps: null },
    iptc: [],
    xmp: [],
    facts: {
      format: "GIF",
      mime: "image/gif",
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
      hasAlpha: true,
      colorSpace: "Indexed (palette)"
    }
  };

  const packed = bytes[10];
  result.facts.bitDepth = (packed & 0x07) + 1;
  result.facts.frames = countGifFrames(bytes);
  return result;
}

/** Counts image descriptors without decoding any pixels. */
function countGifFrames(bytes: Uint8Array) {
  let at = 13;
  const packed = bytes[10];
  if (packed & 0x80) at += 3 * (1 << ((packed & 0x07) + 1));

  let frames = 0;
  while (at < bytes.byteLength) {
    const block = bytes[at];
    if (block === 0x3b) break;
    if (block === 0x21) {
      at += 2;
      at = skipSubBlocks(bytes, at);
    } else if (block === 0x2c) {
      frames += 1;
      const localPacked = bytes[at + 9];
      at += 10;
      if (localPacked & 0x80) at += 3 * (1 << ((localPacked & 0x07) + 1));
      at += 1; // LZW minimum code size
      at = skipSubBlocks(bytes, at);
    } else {
      break;
    }
  }
  return frames;
}

function skipSubBlocks(bytes: Uint8Array, start: number) {
  let at = start;
  while (at < bytes.byteLength) {
    const size = bytes[at];
    at += 1 + size;
    if (size === 0) break;
  }
  return at;
}

function parseBmp(view: DataView): Parsed {
  const bits = view.getUint16(28, true);
  const ppm = view.getInt32(38, true);
  return {
    exif: { fields: [], gps: null },
    iptc: [],
    xmp: [],
    facts: {
      format: "BMP",
      mime: "image/bmp",
      width: view.getInt32(18, true),
      height: Math.abs(view.getInt32(22, true)),
      bitDepth: bits >= 24 ? 8 : bits,
      hasAlpha: bits === 32,
      colorSpace: bits <= 8 ? "Indexed (palette)" : "RGB",
      dpi: ppm > 0 ? { x: Math.round(ppm * 0.0254), y: Math.round(ppm * 0.0254) } : undefined
    }
  };
}

function parseTiff(bytes: Uint8Array): Parsed {
  const exif = parseExif(bytes);
  const width = exif.fields.find((field) => field.label === "Image Width")?.value;
  const height = exif.fields.find((field) => field.label === "Image Height")?.value;
  return {
    exif,
    iptc: [],
    xmp: [],
    facts: {
      format: "TIFF",
      mime: "image/tiff",
      width: Number(width) || 0,
      height: Number(height) || 0,
      colorSpace: exif.colorSpace
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

function detect(bytes: Uint8Array, view: DataView) {
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.byteLength >= 8 && bytes[0] === 0x89 && ascii(view, 1, 3) === "PNG") return "png";
  if (bytes.byteLength >= 12 && tag(view, 0) === "RIFF" && tag(view, 8) === "WEBP") return "webp";
  if (bytes.byteLength >= 6 && ascii(view, 0, 6).startsWith("GIF8")) return "gif";
  if (bytes.byteLength >= 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (bytes.byteLength >= 8 && (view.getUint16(0) === 0x4949 || view.getUint16(0) === 0x4d4d)) return "tiff";
  return "unknown";
}

export type MetadataInput = { name: string; size: number; type: string; bytes: ArrayBuffer };

/** Reads everything the container will tell us about `input`. */
export function readMetadata(input: MetadataInput, fallback?: { width: number; height: number }): ImageMetadata {
  const bytes = new Uint8Array(input.bytes);
  if (!bytes.byteLength) throw new MetadataError("The file is empty.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const kind = detect(bytes, view);
  const parsed: Parsed = kind === "jpeg" ? parseJpeg(bytes, view)
    : kind === "png" ? parsePng(bytes, view)
      : kind === "webp" ? parseWebp(bytes, view)
        : kind === "gif" ? parseGif(bytes, view)
          : kind === "bmp" ? parseBmp(view)
            : kind === "tiff" ? parseTiff(bytes)
              : {
                exif: { fields: [], gps: null },
                iptc: [],
                xmp: [],
                facts: { format: (input.type.split("/")[1] ?? "unknown").toUpperCase(), mime: input.type || "application/octet-stream" }
              };

  const facts: FileFacts = {
    width: parsed.facts.width || fallback?.width || 0,
    height: parsed.facts.height || fallback?.height || 0,
    format: parsed.facts.format ?? "Unknown",
    mime: parsed.facts.mime ?? input.type ?? "application/octet-stream",
    bitDepth: parsed.facts.bitDepth,
    colorSpace: parsed.exif.colorSpace ?? parsed.facts.colorSpace,
    dpi: parsed.facts.dpi ?? parsed.exif.dpi,
    frames: parsed.facts.frames,
    progressive: parsed.facts.progressive,
    hasAlpha: parsed.facts.hasAlpha,
    orientation: parsed.exif.orientation
  };

  const exif = parsed.exif.fields;
  return {
    file: fileFields(input, facts),
    exif,
    iptc: parsed.iptc,
    xmp: parsed.xmp,
    gps: parsed.exif.gps,
    facts,
    count: exif.length + parsed.iptc.length + parsed.xmp.length
  };
}

/** Reduces a width/height pair to the ratio people recognise, e.g. 4:3. */
export function aspectRatio(width: number, height: number) {
  if (!width || !height) return "—";
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = gcd(width, height) || 1;
  let w = width / divisor;
  let h = height / divisor;
  // 3024:4032 is technically correct and useless; scale it back to 3:4.
  if (w > 32 || h > 32) {
    const ratio = width / height;
    const best = [[1, 1], [5, 4], [4, 3], [3, 2], [16, 10], [16, 9], [2, 1], [21, 9], [4, 5], [3, 4], [2, 3], [9, 16]]
      .map((pair) => ({ pair, error: Math.abs(pair[0] / pair[1] - ratio) }))
      .sort((a, b) => a.error - b.error)[0];
    if (best.error < 0.02) [w, h] = best.pair;
    else return `${round(ratio, 2)}:1`;
  }
  return `${w}:${h}`;
}

function fileFields(input: MetadataInput, facts: FileFacts): MetadataField[] {
  const megapixels = (facts.width * facts.height) / 1_000_000;
  const fields: MetadataField[] = [
    { key: "file.name", label: "File Name", value: input.name },
    { key: "file.format", label: "File Format", value: `${facts.format} (${facts.mime})` },
    { key: "file.size", label: "File Size", value: `${formatSize(input.size)} (${input.size.toLocaleString("en-US")} bytes)` },
    { key: "file.width", label: "Width", value: `${facts.width.toLocaleString("en-US")} pixels` },
    { key: "file.height", label: "Height", value: `${facts.height.toLocaleString("en-US")} pixels` },
    { key: "file.dimensions", label: "Dimensions", value: `${facts.width} × ${facts.height} pixels` },
    { key: "file.aspect", label: "Aspect Ratio", value: `${aspectRatio(facts.width, facts.height)} (${round(facts.width / (facts.height || 1), 2)})` },
    { key: "file.megapixels", label: "Megapixels", value: `${round(megapixels, 2)} MP` }
  ];

  if (facts.dpi) fields.push({ key: "file.dpi", label: "Resolution", value: `${facts.dpi.x} × ${facts.dpi.y} DPI` });
  if (facts.colorSpace) fields.push({ key: "file.colorspace", label: "Color Space", value: facts.colorSpace });
  if (facts.bitDepth) fields.push({ key: "file.bitdepth", label: "Bit Depth", value: `${facts.bitDepth} bits per channel` });
  if (facts.hasAlpha !== undefined) fields.push({ key: "file.alpha", label: "Transparency", value: facts.hasAlpha ? "Supported" : "None" });
  if (facts.frames) fields.push({ key: "file.frames", label: "Frames", value: `${facts.frames} (animated)` });
  if (facts.progressive !== undefined) {
    fields.push({ key: "file.progressive", label: "Encoding", value: facts.progressive ? "Progressive / interlaced" : "Baseline" });
  }
  if (facts.orientation) fields.push({ key: "file.orientation", label: "Orientation", value: ORIENTATION[facts.orientation] ?? String(facts.orientation) });

  return fields;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Flattens a report to the text the Copy button puts on the clipboard. */
export function metadataToText(data: ImageMetadata) {
  const section = (title: string, fields: MetadataField[]) =>
    fields.length ? [`## ${title}`, ...fields.map((field) => `${field.label}: ${field.value}`), ""] : [];

  return [
    ...section("File", data.file),
    ...section("EXIF", data.exif),
    ...section("IPTC", data.iptc),
    ...section("XMP", data.xmp)
  ].join("\n").trim();
}

export function metadataToJson(data: ImageMetadata) {
  const object = (fields: MetadataField[]) =>
    Object.fromEntries(fields.map((field) => [field.label, field.value]));

  return JSON.stringify({
    file: object(data.file),
    exif: object(data.exif),
    iptc: object(data.iptc),
    xmp: object(data.xmp),
    gps: data.gps
  }, null, 2);
}
