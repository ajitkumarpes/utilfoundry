import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { animationDuration, decodeAnimation, selectFrames, type AnimationFrame } from "@/lib/gif";

function bytes(name: string) {
  const buffer = readFileSync(new URL(`../public/samples/${name}`, import.meta.url));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe("GIF decoding", () => {
  it("reads every frame at the logical screen size", async () => {
    const animation = await decodeAnimation(bytes("loader.gif"));
    expect(animation.format).toBe("GIF");
    expect(animation.width).toBe(320);
    expect(animation.height).toBe(200);
    expect(animation.frames).toHaveLength(16);
    for (const frame of animation.frames) {
      expect(frame.pixels).toHaveLength(320 * 200 * 4);
      expect(frame.width).toBe(320);
      expect(frame.delay).toBe(80);
    }
  });

  it("reads the Netscape loop count", async () => {
    const animation = await decodeAnimation(bytes("loader.gif"));
    expect(animation.loopCount).toBe(0);
  });

  it("composites every frame to full opacity", async () => {
    const animation = await decodeAnimation(bytes("loader.gif"));
    const last = animation.frames.at(-1)!;
    let transparent = 0;
    for (let at = 3; at < last.pixels.length; at += 4) if (last.pixels[at] === 0) transparent += 1;
    expect(transparent).toBe(0);
  });

  it("produces visibly different frames", async () => {
    const animation = await decodeAnimation(bytes("loader.gif"));
    const [first, middle] = [animation.frames[0], animation.frames[8]];
    let different = 0;
    for (let at = 0; at < first.pixels.length; at += 4) {
      if (first.pixels[at] !== middle.pixels[at]) different += 1;
    }
    expect(different).toBeGreaterThan(500);
  });

  it("finds the brand orange the dots were drawn in", async () => {
    const animation = await decodeAnimation(bytes("loader.gif"));
    const { pixels } = animation.frames[0];
    let orange = 0;
    for (let at = 0; at < pixels.length; at += 4) {
      if (pixels[at] > 200 && pixels[at + 1] > 50 && pixels[at + 1] < 120 && pixels[at + 2] < 80) orange += 1;
    }
    expect(orange).toBeGreaterThan(400);
  });

  it("rejects files that are not animations", async () => {
    await expect(decodeAnimation(bytes("landscape.jpg"))).rejects.toThrow(/GIF or an animated WebP/);
    await expect(decodeAnimation(new ArrayBuffer(4))).rejects.toThrow(/too small/);
  });
});

describe("frame selection", () => {
  const frames = Array.from({ length: 10 }, (_, index) => ({ index, delay: 80 } as AnimationFrame));

  it("returns everything by default", () => {
    expect(selectFrames(frames, "all", 2, 1, 10)).toHaveLength(10);
  });

  it("takes every Nth frame starting at the first", () => {
    const picked = selectFrames(frames, "nth", 3, 1, 10);
    expect(picked.map((frame) => frame.index)).toEqual([0, 3, 6, 9]);
  });

  it("clamps a range to what exists and tolerates a reversed one", () => {
    expect(selectFrames(frames, "range", 2, 3, 5).map((frame) => frame.index)).toEqual([2, 3, 4]);
    expect(selectFrames(frames, "range", 2, 5, 3).map((frame) => frame.index)).toEqual([2, 3, 4]);
    expect(selectFrames(frames, "range", 2, 8, 99).map((frame) => frame.index)).toEqual([7, 8, 9]);
  });

  it("sums the delays into a run time", () => {
    expect(animationDuration(frames)).toBe(0.8);
  });
});
