/**
 * Animated image frame extraction.
 *
 * GIF is decoded here in full — header, LZW, interlacing and frame disposal —
 * because that is the format the tool is built around and the browser gives no
 * way to read individual frames out of an <img>. Other animated formats go
 * through WebCodecs' ImageDecoder when the browser has it.
 */

export type AnimationFrame = {
  index: number;
  /** Fully composited RGBA pixels, always the size of the logical screen. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  /** Display time in milliseconds. */
  delay: number;
};

export type Animation = {
  width: number;
  height: number;
  frames: AnimationFrame[];
  /** 0 means loop forever; undefined means the file did not say. */
  loopCount?: number;
  format: "GIF" | "WebP" | "PNG" | "AVIF";
};

export class AnimationError extends Error {}

/** Browsers cap what is sensible to hold in memory; so do we. */
const MAX_FRAMES = 400;

/** `subarray` widens the buffer type, so slices are held under this alias. */
type Bytes = Uint8Array<ArrayBufferLike>;

/* -------------------------------------------------------------------------- */
/* GIF                                                                        */
/* -------------------------------------------------------------------------- */

type GifImageBlock = {
  left: number;
  top: number;
  width: number;
  height: number;
  interlaced: boolean;
  palette: Bytes;
  transparentIndex: number;
  delay: number;
  disposal: number;
  indices: Uint8Array;
};

function readSubBlocks(bytes: Uint8Array, start: number): { data: Uint8Array; next: number } {
  const chunks: Uint8Array[] = [];
  let at = start;
  let total = 0;
  while (at < bytes.length) {
    const size = bytes[at];
    at += 1;
    if (size === 0) break;
    if (at + size > bytes.length) throw new AnimationError("This GIF is truncated.");
    chunks.push(bytes.subarray(at, at + size));
    total += size;
    at += size;
  }
  const data = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return { data, next: at };
}

/**
 * Variable-width LZW as GIF uses it: codes grow from `minCodeSize + 1` bits and
 * reset whenever the clear code appears.
 */
function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const output = new Uint8Array(pixelCount);

  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4096);

  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let previous = -1;
  let bitBuffer = 0;
  let bitCount = 0;
  let at = 0;
  let written = 0;

  for (let code = 0; code < clearCode; code += 1) { prefix[code] = -1; suffix[code] = code; }

  while (written < pixelCount) {
    while (bitCount < codeSize) {
      if (at >= data.length) return output;
      bitBuffer |= data[at] << bitCount;
      at += 1;
      bitCount += 8;
    }
    const code = bitBuffer & ((1 << codeSize) - 1);
    bitBuffer >>= codeSize;
    bitCount -= codeSize;

    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
      previous = -1;
      continue;
    }
    if (code === endCode) break;

    let current = code;
    let top = 0;
    // A code can legitimately reference the entry about to be created; that is
    // the KwKwK case, handled by seeding the stack with the first byte.
    if (current >= nextCode) {
      if (previous < 0) throw new AnimationError("This GIF has a corrupt compressed stream.");
      stack[top] = suffix[previous];
      top += 1;
      current = previous;
    }
    while (current >= clearCode) {
      stack[top] = suffix[current];
      top += 1;
      current = prefix[current];
      if (top >= stack.length) throw new AnimationError("This GIF has a corrupt compressed stream.");
    }
    stack[top] = suffix[current];
    top += 1;

    for (let i = top - 1; i >= 0 && written < pixelCount; i -= 1) {
      output[written] = stack[i];
      written += 1;
    }

    if (previous >= 0 && nextCode < 4096) {
      prefix[nextCode] = previous;
      suffix[nextCode] = suffix[current];
      nextCode += 1;
      if ((nextCode & (nextCode - 1)) === 0 && nextCode < 4096 && codeSize < 12) codeSize += 1;
    }
    previous = code;
  }

  return output;
}

/** GIF interlacing writes rows in four passes; this puts them back in order. */
function deinterlace(indices: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(indices.length);
  const passes: [number, number][] = [[0, 8], [4, 8], [2, 4], [1, 2]];
  let source = 0;
  for (const [start, step] of passes) {
    for (let row = start; row < height; row += step) {
      out.set(indices.subarray(source * width, (source + 1) * width), row * width);
      source += 1;
    }
  }
  return out;
}

function parseGif(bytes: Uint8Array): Animation {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (!signature.startsWith("GIF8")) throw new AnimationError("That file is not a GIF.");

  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const packed = bytes[10];
  let at = 13;

  let globalPalette: Bytes = new Uint8Array(0);
  if (packed & 0x80) {
    const size = 3 * (1 << ((packed & 0x07) + 1));
    globalPalette = bytes.subarray(at, at + size);
    at += size;
  }

  const blocks: GifImageBlock[] = [];
  let loopCount: number | undefined;
  let delay = 0;
  let disposal = 0;
  let transparentIndex = -1;

  while (at < bytes.length) {
    const marker = bytes[at];

    if (marker === 0x3b) break;

    if (marker === 0x21) {
      const label = bytes[at + 1];
      at += 2;
      if (label === 0xf9) {
        const size = bytes[at];
        const flags = bytes[at + 1];
        disposal = (flags >> 2) & 0x07;
        transparentIndex = flags & 0x01 ? bytes[at + 4] : -1;
        // Stored in hundredths of a second. Zero means "as fast as possible",
        // which every renderer clamps; 100 ms is the long-standing convention.
        const hundredths = view.getUint16(at + 2, true);
        delay = hundredths === 0 ? 100 : hundredths * 10;
        at += size + 1;
        at = readSubBlocks(bytes, at).next;
      } else if (label === 0xff) {
        const size = bytes[at];
        const name = String.fromCharCode(...bytes.subarray(at + 1, at + 1 + 11));
        at += size + 1;
        const { data, next } = readSubBlocks(bytes, at);
        if (name.startsWith("NETSCAPE") && data.length >= 3) loopCount = data[1] | (data[2] << 8);
        at = next;
      } else {
        at = readSubBlocks(bytes, at + 1).next;
      }
      continue;
    }

    if (marker !== 0x2c) throw new AnimationError("This GIF contains a block we cannot read.");

    const left = view.getUint16(at + 1, true);
    const top = view.getUint16(at + 3, true);
    const frameWidth = view.getUint16(at + 5, true);
    const frameHeight = view.getUint16(at + 7, true);
    const localFlags = bytes[at + 9];
    at += 10;

    let palette: Bytes = globalPalette;
    if (localFlags & 0x80) {
      const size = 3 * (1 << ((localFlags & 0x07) + 1));
      palette = bytes.subarray(at, at + size);
      at += size;
    }
    if (!palette.length) throw new AnimationError("This GIF has no colour table.");

    const minCodeSize = bytes[at];
    at += 1;
    const { data, next } = readSubBlocks(bytes, at);
    at = next;

    if (!frameWidth || !frameHeight) continue;
    const pixelCount = frameWidth * frameHeight;
    const raw = lzwDecode(data, minCodeSize, pixelCount);

    blocks.push({
      left,
      top,
      width: frameWidth,
      height: frameHeight,
      interlaced: Boolean(localFlags & 0x40),
      palette,
      transparentIndex,
      delay,
      disposal,
      indices: localFlags & 0x40 ? deinterlace(raw, frameWidth, frameHeight) : raw
    });

    if (blocks.length >= MAX_FRAMES) break;
    delay = 0;
    disposal = 0;
    transparentIndex = -1;
  }

  if (!blocks.length) throw new AnimationError("No frames could be read from this GIF.");

  return { width, height, frames: composite(blocks, width, height), loopCount, format: "GIF" };
}

/**
 * Applies each block onto the running canvas, honouring the disposal method so
 * a frame that only stores what changed still comes out as a whole picture.
 */
function composite(blocks: GifImageBlock[], width: number, height: number): AnimationFrame[] {
  const canvas = new Uint8ClampedArray(width * height * 4);
  const frames: AnimationFrame[] = [];
  let previous: Uint8ClampedArray | null = null;

  blocks.forEach((block, index) => {
    if (block.disposal === 3) previous = canvas.slice();

    for (let y = 0; y < block.height; y += 1) {
      const targetY = block.top + y;
      if (targetY < 0 || targetY >= height) continue;
      for (let x = 0; x < block.width; x += 1) {
        const targetX = block.left + x;
        if (targetX < 0 || targetX >= width) continue;
        const paletteIndex = block.indices[y * block.width + x];
        if (paletteIndex === block.transparentIndex) continue;
        const from = paletteIndex * 3;
        if (from + 2 >= block.palette.length) continue;
        const to = (targetY * width + targetX) * 4;
        canvas[to] = block.palette[from];
        canvas[to + 1] = block.palette[from + 1];
        canvas[to + 2] = block.palette[from + 2];
        canvas[to + 3] = 255;
      }
    }

    frames.push({ index, pixels: canvas.slice(), width, height, delay: block.delay });

    if (block.disposal === 2) {
      // Restore to background: clear just the rectangle this frame painted.
      for (let y = block.top; y < Math.min(height, block.top + block.height); y += 1) {
        canvas.fill(0, (y * width + block.left) * 4, (y * width + Math.min(width, block.left + block.width)) * 4);
      }
    } else if (block.disposal === 3 && previous) {
      canvas.set(previous);
    }
  });

  return frames;
}

/* -------------------------------------------------------------------------- */
/* WebCodecs, for everything that is not a GIF                                 */
/* -------------------------------------------------------------------------- */

type ImageDecoderLike = {
  tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number; repetitionCount: number } };
  decode(options: { frameIndex: number }): Promise<{ image: VideoFrame }>;
  close(): void;
};

type ImageDecoderConstructor = {
  new(init: { data: ArrayBuffer | Uint8Array; type: string }): ImageDecoderLike;
  isTypeSupported(type: string): Promise<boolean>;
};

function imageDecoder(): ImageDecoderConstructor | null {
  const candidate = (globalThis as { ImageDecoder?: ImageDecoderConstructor }).ImageDecoder;
  return typeof candidate === "function" ? candidate : null;
}

async function decodeWithWebCodecs(bytes: Uint8Array, mime: string, format: Animation["format"]): Promise<Animation> {
  const Decoder = imageDecoder();
  if (!Decoder) {
    throw new AnimationError(`Your browser cannot split ${format} animations. Chrome, Edge and Safari 17+ can, or you can upload a GIF.`);
  }
  if (!(await Decoder.isTypeSupported(mime))) {
    throw new AnimationError(`Your browser cannot decode ${format} animations.`);
  }

  const decoder = new Decoder({ data: bytes, type: mime });
  try {
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const count = Math.min(track?.frameCount ?? 1, MAX_FRAMES);
    if (count < 1) throw new AnimationError("No frames could be read from this file.");

    const frames: AnimationFrame[] = [];
    let width = 0;
    let height = 0;

    for (let index = 0; index < count; index += 1) {
      const { image } = await decoder.decode({ frameIndex: index });
      width = image.displayWidth;
      height = image.displayHeight;
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new AnimationError("This browser blocked canvas access.");
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, width, height);
      frames.push({
        index,
        pixels: data.data,
        width,
        height,
        delay: image.duration ? Math.round(image.duration / 1000) : 100
      });
      image.close();
    }

    return { width, height, frames, loopCount: track?.repetitionCount, format };
  } finally {
    decoder.close();
  }
}

/* -------------------------------------------------------------------------- */

const MIME_BY_SIGNATURE: { test: (bytes: Uint8Array) => boolean; mime: string; format: Animation["format"] }[] = [
  { test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46, mime: "image/gif", format: "GIF" },
  {
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57,
    mime: "image/webp",
    format: "WebP"
  },
  { test: (b) => b[0] === 0x89 && b[1] === 0x50, mime: "image/png", format: "PNG" }
];

/** Reads every frame of an animated image, whatever container it arrives in. */
export async function decodeAnimation(buffer: ArrayBuffer): Promise<Animation> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) throw new AnimationError("That file is too small to be an animation.");

  const match = MIME_BY_SIGNATURE.find((entry) => entry.test(bytes));
  if (!match) throw new AnimationError("Upload a GIF or an animated WebP.");

  if (match.format === "GIF") return parseGif(bytes);
  return decodeWithWebCodecs(bytes, match.mime, match.format);
}

/** Picks the frames the user asked for: all of them, every Nth, or a range. */
export function selectFrames(frames: AnimationFrame[], mode: string, nth: number, from: number, to: number) {
  if (mode === "nth") {
    const step = Math.max(2, Math.floor(nth));
    return frames.filter((_, index) => index % step === 0);
  }
  if (mode === "range") {
    const start = Math.max(1, Math.min(from, to));
    const end = Math.min(frames.length, Math.max(from, to));
    return frames.slice(start - 1, end);
  }
  return frames;
}

/** Total run time of the animation, in seconds. */
export function animationDuration(frames: AnimationFrame[]) {
  return Math.round(frames.reduce((total, frame) => total + frame.delay, 0) / 100) / 10;
}
