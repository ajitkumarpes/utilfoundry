/**
 * Regenerates the sample assets that ship in public/samples.
 *
 * Only the assets the newer tools need are produced here; the photographs were
 * added by hand. Run with `npm run samples` after changing anything below.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import sharp from "sharp";

const OUT = new URL("../public/samples/", import.meta.url);
const sample = (name) => fileURLToPath(new URL(name, OUT));
mkdirSync(OUT, { recursive: true });

const write = (name, bytes) => {
  writeFileSync(sample(name), bytes);
  console.log(`  ${name}  ${(bytes.length / 1024).toFixed(1)} KB`);
};

/* -------------------------------------------------------------------------- */
/* EXIF                                                                        */
/* -------------------------------------------------------------------------- */

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/**
 * Builds one big-endian TIFF IFD. `entries` are `{ tag, type, values }`; values
 * longer than four bytes are appended after the directory and referenced by the
 * offset the real format requires.
 */
function buildIfd(entries, ifdOffset, nextIfdOffset = 0) {
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);
  const directorySize = 2 + sorted.length * 12 + 4;
  const heap = [];
  let heapSize = 0;

  const directory = Buffer.alloc(directorySize);
  directory.writeUInt16BE(sorted.length, 0);

  sorted.forEach((entry, index) => {
    const at = 2 + index * 12;
    const payload = encodeValues(entry.type, entry.values);
    const count = entry.type === 2 ? payload.length : entry.values.length;
    directory.writeUInt16BE(entry.tag, at);
    directory.writeUInt16BE(entry.type, at + 2);
    directory.writeUInt32BE(count, at + 4);
    if (payload.length <= 4) {
      payload.copy(directory, at + 8);
    } else {
      directory.writeUInt32BE(ifdOffset + directorySize + heapSize, at + 8);
      heap.push(payload);
      heapSize += payload.length;
      if (heapSize % 2 === 1) { heap.push(Buffer.alloc(1)); heapSize += 1; }
    }
  });

  directory.writeUInt32BE(nextIfdOffset, 2 + sorted.length * 12);
  return Buffer.concat([directory, ...heap]);
}

function encodeValues(type, values) {
  if (type === 2) {
    const text = `${values[0]}\0`;
    return Buffer.from(text, "latin1");
  }
  const size = TYPE_SIZE[type];
  const buffer = Buffer.alloc(values.length * size);
  values.forEach((value, index) => {
    const at = index * size;
    if (type === 1 || type === 7) buffer.writeUInt8(value, at);
    else if (type === 3) buffer.writeUInt16BE(value, at);
    else if (type === 4) buffer.writeUInt32BE(value, at);
    else if (type === 5) { buffer.writeUInt32BE(value[0], at); buffer.writeUInt32BE(value[1], at + 4); }
    else if (type === 10) { buffer.writeInt32BE(value[0], at); buffer.writeInt32BE(value[1], at + 4); }
  });
  return buffer;
}

/** Degrees → the three rationals EXIF stores GPS coordinates as. */
function gpsRationals(decimal) {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60 * 1000);
  return [[degrees, 1], [minutes, 1], [seconds, 1000]];
}

function buildExif({ width, height, latitude, longitude }) {
  // IFD0 sits at offset 8; the sub-directories are laid out after it, so each
  // block has to be measured before the pointers into it can be written.
  const dateTime = "2026:03:12 10:24:32";

  const exifEntries = [
    { tag: 0x829a, type: 5, values: [[1, 1216]] },
    { tag: 0x829d, type: 5, values: [[18, 10]] },
    { tag: 0x8827, type: 3, values: [50] },
    { tag: 0x9003, type: 2, values: [dateTime] },
    { tag: 0x9004, type: 2, values: [dateTime] },
    { tag: 0x9207, type: 3, values: [5] },
    { tag: 0x9209, type: 3, values: [16] },
    { tag: 0x920a, type: 5, values: [[686, 100]] },
    { tag: 0xa001, type: 3, values: [1] },
    { tag: 0xa002, type: 4, values: [width] },
    { tag: 0xa003, type: 4, values: [height] },
    { tag: 0xa405, type: 3, values: [26] },
    { tag: 0xa434, type: 2, values: ["UtilFoundry 26mm f/1.8"] }
  ];
  const gpsEntries = [
    { tag: 0x0000, type: 1, values: [2, 3, 0, 0] },
    { tag: 0x0001, type: 2, values: [latitude >= 0 ? "N" : "S"] },
    { tag: 0x0002, type: 5, values: gpsRationals(latitude) },
    { tag: 0x0003, type: 2, values: [longitude >= 0 ? "E" : "W"] },
    { tag: 0x0004, type: 5, values: gpsRationals(longitude) },
    { tag: 0x0005, type: 1, values: [0] },
    { tag: 0x0006, type: 5, values: [[14320, 100]] }
  ];

  const ifd0Entries = [
    { tag: 0x010f, type: 2, values: ["UtilFoundry"] },
    { tag: 0x0110, type: 2, values: ["Foundry One Pro"] },
    { tag: 0x0112, type: 3, values: [1] },
    { tag: 0x011a, type: 5, values: [[72, 1]] },
    { tag: 0x011b, type: 5, values: [[72, 1]] },
    { tag: 0x0128, type: 3, values: [2] },
    { tag: 0x0131, type: 2, values: ["UtilFoundry Images 1.0"] },
    { tag: 0x0132, type: 2, values: [dateTime] },
    { tag: 0x8769, type: 4, values: [0] },
    { tag: 0x8825, type: 4, values: [0] }
  ];

  // Build once to measure, then again with the real pointers.
  const measured = buildIfd(ifd0Entries, 8);
  const exifOffset = 8 + measured.length;
  const exifBlock = buildIfd(exifEntries, exifOffset);
  const gpsOffset = exifOffset + exifBlock.length;

  const withPointers = ifd0Entries.map((entry) =>
    entry.tag === 0x8769 ? { ...entry, values: [exifOffset] }
      : entry.tag === 0x8825 ? { ...entry, values: [gpsOffset] }
        : entry);
  const ifd0 = buildIfd(withPointers, 8);
  const gpsBlock = buildIfd(gpsEntries, gpsOffset);

  const header = Buffer.alloc(8);
  header.write("MM", 0, "latin1");
  header.writeUInt16BE(0x002a, 2);
  header.writeUInt32BE(8, 4);

  return Buffer.concat([header, ifd0, exifBlock, gpsBlock]);
}

/** Splices an APP1 EXIF segment in right after the JPEG SOI marker. */
function withExif(jpeg, exif) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("Not a JPEG.");
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), exif]);
  const segment = Buffer.alloc(4);
  segment.writeUInt16BE(0xffe1, 0);
  segment.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), segment, payload, jpeg.subarray(2)]);
}

/* -------------------------------------------------------------------------- */
/* Assets                                                                      */
/* -------------------------------------------------------------------------- */

async function photoWithExif() {
  const base = await sharp(sample("landscape.jpg")).resize(1600).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const { width, height } = await sharp(base).metadata();
  return withExif(base, buildExif({ width, height, latitude: 37.8651, longitude: -119.5383 }));
}

/**
 * A before/after pair for Image Compare. Both go through the identical decode →
 * encode path, so every 8 × 8 block the boat does not touch encodes to the same
 * bytes and the diff lands on the boat alone rather than on JPEG noise.
 */
async function comparePair() {
  const { width, height } = await sharp(sample("landscape.jpg")).metadata();
  const cx = Math.round(width * 0.62);
  const cy = Math.round(height * 0.78);
  const boat = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <ellipse cx="${cx}" cy="${cy}" rx="46" ry="13" fill="#d83a1b"/>
       <rect x="${cx - 6}" y="${cy - 40}" width="4" height="40" fill="#f6f2ea"/>
       <path d="M${cx} ${cy - 38} l34 26 h-34 z" fill="#f6f2ea"/>
     </svg>`
  );
  const settings = { quality: 82, mozjpeg: true };
  return Promise.all([
    sharp(sample("landscape.jpg")).jpeg(settings).toBuffer(),
    sharp(sample("landscape.jpg")).composite([{ input: boat, blend: "over" }]).jpeg(settings).toBuffer()
  ]);
}

/** Square brand tile, the natural thing to feed the favicon generator. */
async function markPng() {
  const svg = Buffer.from(
    `<svg width="512" height="512" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
       <rect width="64" height="64" rx="14" fill="#111827"/>
       <path d="M18 17V33C18 42.5 23.6 48 32 48C40.4 48 46 42.5 46 33V17" stroke="#F4B183" stroke-width="5" stroke-linecap="round" fill="none"/>
       <path d="M16 51H48" stroke="#F4B183" stroke-width="5" stroke-linecap="round"/>
       <path d="M50 11L52.5 16.5L58 19L52.5 21.5L50 27L47.5 21.5L42 19L47.5 16.5L50 11Z" fill="#F4B183"/>
     </svg>`
  );
  return sharp(svg).png({ compressionLevel: 9 }).toBuffer();
}

/** A short looping animation, the input GIF to Frames is built around. */
async function loaderGif() {
  const W = 320;
  const H = 200;
  const FRAMES = 16;
  const frames = [];

  for (let frame = 0; frame < FRAMES; frame += 1) {
    const pixels = Buffer.alloc(W * H * 4);
    const phase = (frame / FRAMES) * Math.PI * 2;
    // Flat navy backdrop: a gradient would blow the 256-colour palette and the
    // file size with it, for a sample nobody looks at that closely.
    for (let at = 0; at < pixels.length; at += 4) {
      pixels[at] = 17;
      pixels[at + 1] = 28;
      pixels[at + 2] = 61;
      pixels[at + 3] = 255;
    }
    // Three dots orbiting the centre, the classic loader shape.
    for (let dot = 0; dot < 3; dot += 1) {
      const angle = phase + (dot * Math.PI * 2) / 3;
      const cx = W / 2 + Math.cos(angle) * 62;
      const cy = H / 2 + Math.sin(angle) * 42;
      const radius = 16 + Math.sin(angle) * 4;
      for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(H, Math.ceil(cy + radius)); y += 1) {
        for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(W, Math.ceil(cx + radius)); x += 1) {
          const distance = Math.hypot(x - cx, y - cy);
          if (distance > radius) continue;
          const edge = Math.min(1, radius - distance);
          const at = (y * W + x) * 4;
          pixels[at] = pixels[at] * (1 - edge) + 240 * edge;
          pixels[at + 1] = pixels[at + 1] * (1 - edge) + 78 * edge;
          pixels[at + 2] = pixels[at + 2] * (1 - edge) + 35 * edge;
        }
      }
    }
    frames.push(pixels);
  }

  return sharp(Buffer.concat(frames), { raw: { width: W, height: H * FRAMES, channels: 4, pageHeight: H } })
    .gif({ loop: 0, delay: new Array(FRAMES).fill(80) })
    .toBuffer();
}

/* -------------------------------------------------------------------------- */
/* Documents — real text, so the OCR and screenshot tools have something to read */
/* -------------------------------------------------------------------------- */

const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SANS = "Helvetica, Arial, sans-serif";
const MONO = "Courier New, Courier, monospace";
const SERIF = "Georgia, Times New Roman, serif";

/** One line of SVG text. Everything is 20 px or larger — the size OCR reads reliably. */
function line(x, y, value, { size = 24, weight = 400, fill = "#111827", family = SANS, anchor = "start", style = "normal" } = {}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function svgDocument(width, height, background, body) {
  return sharp(Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="100%" height="100%" fill="${background}"/>${body}</svg>`
  )).png({ compressionLevel: 9 }).toBuffer();
}

function invoice() {
  let body = line(70, 130, "INVOICE", { size: 58, weight: 700 });
  ["Acme Technologies Ltd.", "123 Business Park", "Bangalore, KA 560001", "India"]
    .forEach((text, index) => { body += line(70, 195 + index * 34, text); });
  body += line(70, 370, "Invoice No: INV-2024-0815");
  body += line(70, 406, "Date: Aug 15, 2024");
  body += line(70, 442, "Bill To: Tech Solutions Pvt. Ltd.");

  body += `<rect x="70" y="490" width="860" height="56" fill="#eef1f6"/>`;
  const header = [["Description", 90, "start"], ["Qty", 600, "end"], ["Unit Price", 775, "end"], ["Amount", 910, "end"]];
  header.forEach(([text, x, anchor]) => { body += line(x, 527, text, { weight: 700, anchor }); });
  [["Website Development", "1", "$1,200", "$1,200"], ["Maintenance (1 Year)", "1", "$300", "$300"]]
    .forEach((row, index) => {
      const y = 596 + index * 56;
      row.forEach((text, column) => { body += line(header[column][1], y, text, { anchor: header[column][2] }); });
      body += `<line x1="70" x2="930" y1="${y + 20}" y2="${y + 20}" stroke="#d9dfe8" stroke-width="2"/>`;
    });

  [["Subtotal", "$1,500"], ["Tax (18%)", "$270"]].forEach(([label, value], index) => {
    body += line(640, 740 + index * 42, label);
    body += line(910, 740 + index * 42, value, { anchor: "end" });
  });
  body += `<line x1="620" x2="930" y1="812" y2="812" stroke="#111827" stroke-width="2"/>`;
  body += line(640, 856, "Total", { size: 30, weight: 700 });
  body += line(910, 856, "$1,770", { size: 30, weight: 700, anchor: "end" });
  body += line(70, 1180, "Thank you for your business!", { size: 28 });
  return svgDocument(1000, 1300, "#ffffff", body);
}

function receipt() {
  let body = line(380, 110, "COFFEE HOUSE", { size: 44, weight: 700, family: MONO, anchor: "middle" });
  body += line(380, 158, "123 Main Street", { size: 24, family: MONO, anchor: "middle" });
  body += line(380, 192, "Order #4721  14:32", { size: 24, family: MONO, anchor: "middle" });
  const rule = (y) => `<line x1="70" x2="690" y1="${y}" y2="${y}" stroke="#111827" stroke-width="2" stroke-dasharray="10 8"/>`;
  body += rule(232);
  [["Latte", "4.50"], ["Croissant", "3.00"], ["Cappuccino", "4.00"], ["Blueberry Muffin", "3.25"]]
    .forEach(([item, price], index) => {
      body += line(80, 292 + index * 50, item, { size: 28, family: MONO });
      body += line(680, 292 + index * 50, price, { size: 28, family: MONO, anchor: "end" });
    });
  body += rule(500);
  [["Subtotal", "14.75"], ["Tax", "1.18"]].forEach(([label, value], index) => {
    body += line(80, 558 + index * 50, label, { size: 28, family: MONO });
    body += line(680, 558 + index * 50, value, { size: 28, family: MONO, anchor: "end" });
  });
  body += line(80, 684, "TOTAL", { size: 36, weight: 700, family: MONO });
  body += line(680, 684, "15.93", { size: 36, weight: 700, family: MONO, anchor: "end" });
  body += rule(730);
  body += line(380, 800, "Paid by card", { size: 26, family: MONO, anchor: "middle" });
  body += line(380, 880, "Thank you! Come again.", { size: 28, family: MONO, anchor: "middle" });
  return svgDocument(760, 1000, "#fdfcf8", body);
}

function quote() {
  let body = `<rect x="70" y="120" width="10" height="440" fill="#f04e23"/>`;
  ["The Future", "Belongs to", "Those Who", "Build It."].forEach((text, index) => {
    body += line(120, 210 + index * 105, text, { size: 88, family: SERIF, fill: "#1f2937" });
  });
  body += line(122, 660, "UtilFoundry Journal", { size: 32, family: SERIF, style: "italic", fill: "#4b5563" });
  return svgDocument(1000, 750, "#f7f2e8", body);
}

/** Light text on a dark ground — the case the worker has to invert before reading. */
function poster() {
  let body = "";
  [["DREAM", "#ffffff"], ["PLAN", "#ffffff"], ["DO", "#ffb38a"], ["REPEAT", "#ffffff"]].forEach(([text, fill], index) => {
    body += line(450, 250 + index * 170, text, { size: 132, weight: 700, fill, anchor: "middle" });
  });
  return svgDocument(900, 900, "#111827", body);
}

/** A believable app screenshot for Screenshot to Text and Screenshot to PDF. */
function dashboard() {
  const W = 1440;
  const H = 900;
  let body = `<rect x="0" y="0" width="240" height="${H}" fill="#ffffff"/>`;
  body += `<rect x="240" y="0" width="1" height="${H}" fill="#e5e9f0"/>`;
  body += line(36, 64, "UtilFoundry", { size: 28, weight: 700 });
  ["Overview", "Projects", "Reports", "Team", "Settings"].forEach((text, index) => {
    if (index === 0) body += `<rect x="20" y="${108 + index * 56}" width="200" height="44" rx="8" fill="#fff0eb"/>`;
    body += line(40, 138 + index * 56, text, { size: 22, fill: index === 0 ? "#f04e23" : "#374151", weight: index === 0 ? 700 : 400 });
  });

  body += line(290, 92, "Project Dashboard", { size: 40, weight: 700 });
  body += line(290, 134, "Welcome back. Here is what changed this week.", { size: 22, fill: "#6b7280" });

  [["12", "Total Projects", "#2f6fed"], ["8", "In Progress", "#e8912a"], ["3", "Completed", "#16a34a"], ["1", "On Hold", "#dc2626"]]
    .forEach(([value, label, color], index) => {
      const x = 290 + index * 280;
      body += `<rect x="${x}" y="180" width="256" height="140" rx="14" fill="#ffffff" stroke="#e5e9f0" stroke-width="2"/>`;
      body += `<rect x="${x + 24}" y="206" width="10" height="34" rx="4" fill="${color}"/>`;
      body += line(x + 48, 238, value, { size: 44, weight: 700 });
      body += line(x + 24, 292, label, { size: 22, fill: "#4b5563" });
    });

  body += `<rect x="290" y="350" width="700" height="500" rx="14" fill="#ffffff" stroke="#e5e9f0" stroke-width="2"/>`;
  body += line(318, 398, "Project Progress", { size: 26, weight: 700 });
  body += `<polyline points="340,760 440,720 540,735 640,660 740,640 840,590 940,560" fill="none" stroke="#2f6fed" stroke-width="5"/>`;
  body += `<polyline points="340,790 440,770 540,760 640,720 740,705 840,680 940,650" fill="none" stroke="#f04e23" stroke-width="5" stroke-dasharray="12 10"/>`;
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].forEach((month, index) => {
    body += line(340 + index * 100, 830, month, { size: 20, fill: "#6b7280", anchor: "middle" });
  });

  body += `<rect x="1020" y="350" width="370" height="500" rx="14" fill="#ffffff" stroke="#e5e9f0" stroke-width="2"/>`;
  body += line(1048, 398, "Recent Activity", { size: 26, weight: 700 });
  [["Design system updated", "2 hours ago"], ["New feature deployed", "5 hours ago"], ["Bug fixed in authentication", "1 day ago"], ["Quarterly report shared", "2 days ago"]]
    .forEach(([title, when], index) => {
      const y = 462 + index * 92;
      body += `<circle cx="1060" cy="${y - 8}" r="9" fill="${["#2f6fed", "#e8912a", "#16a34a", "#7c4dee"][index]}"/>`;
      body += line(1084, y, title, { size: 21 });
      body += line(1084, y + 32, when, { size: 19, fill: "#6b7280" });
    });

  return svgDocument(W, H, "#f5f7fb", body);
}

console.log("Generating sample assets…");
write("photo-exif.jpg", await photoWithExif());
const [before, after] = await comparePair();
write("compare-before.jpg", before);
write("compare-after.jpg", after);
write("mark.png", await markPng());
write("loader.gif", await loaderGif());
write("invoice.png", await invoice());
write("receipt.png", await receipt());
write("quote.png", await quote());
write("poster.png", await poster());
write("dashboard.png", await dashboard());
console.log("Done.");
