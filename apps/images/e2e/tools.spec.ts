import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { READY_TOOLS } from "../lib/tools";

/**
 * Every tool, used the way a visitor uses it: a real file in, the real button, and the
 * result checked for what it is supposed to be (format, size, pixels, pages, text) rather
 * than for a success message. The OCR and model tools need the Python worker; they run
 * when E2E_IMAGE_WORKER is set (CI starts one) and are skipped, visibly, otherwise.
 */

const SAMPLES = "public/samples";
const WORKER = !!process.env.E2E_IMAGE_WORKER;
const covered = new Set<string>();

function tool(id: string, body: (page: Page) => Promise<void>, options: { worker?: boolean } = {}) {
  covered.add(id);
  test(id, async ({ page }) => {
    test.skip(!!options.worker && !WORKER, "needs the image worker (set E2E_IMAGE_WORKER)");
    await page.goto(`/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await body(page);
  });
}

async function upload(page: Page, ...files: string[]) {
  await page.locator("input[type=file]").first().setInputFiles(files);
}

/** Clicks `name` and returns what the browser saved. */
async function download(page: Page, name: string | RegExp) {
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name }).first().click();
  const file = await saved;
  return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

/** A photo-like 1200 × 900 JPEG: red rises left to right, green top to bottom. */
let photo: string;
let solid: string;
test.beforeAll(async ({}, testInfo) => {
  const width = 1200;
  const height = 900;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      pixels[at] = Math.round((x / width) * 255);
      pixels[at + 1] = Math.round((y / height) * 255);
      pixels[at + 2] = 140;
    }
  }
  photo = testInfo.outputPath("photo.jpg");
  await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toFile(photo);
  solid = testInfo.outputPath("solid.png");
  await sharp({ create: { width: 400, height: 300, channels: 3, background: "#3366cc" } }).png().toFile(solid);
});

const meta = (bytes: Buffer) => sharp(bytes).metadata();

/** File names inside a ZIP, from its central directory. */
function zipNames(bytes: Buffer): string[] {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end, "not a ZIP file").toBeGreaterThan(-1);
  const count = bytes.readUInt16LE(end + 10);
  let at = bytes.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const nameLength = bytes.readUInt16LE(at + 28);
    const extra = bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
    names.push(bytes.subarray(at + 46, at + 46 + nameLength).toString("utf8"));
    at += 46 + nameLength + extra;
  }
  return names;
}

test.describe("optimize", () => {
  tool("image-compressor", async (page) => {
    await upload(page, photo);
    await page.getByRole("radio", { name: "WebP", exact: true }).click();
    await page.getByRole("button", { name: /^Compress Image/ }).click();
    const result = await download(page, "Download photo.jpg");
    const info = await meta(result.bytes);
    expect([info.format, info.width, info.height]).toEqual(["webp", 1200, 900]);
    expect(result.bytes.length).toBeLessThan(readFileSync(photo).length);
  });

  tool("resize-image", async (page) => {
    await upload(page, photo);
    await page.getByLabel("Width (px)").fill("600");
    await page.getByRole("button", { name: /^Resize Image/ }).click();
    const info = await meta((await download(page, "Download Image")).bytes);
    expect([info.width, info.height]).toEqual([600, 450]);
  });

  tool("remove-metadata", async (page) => {
    const source = `${SAMPLES}/photo-exif.jpg`;
    expect((await meta(readFileSync(source))).exif, "the sample should carry EXIF").toBeTruthy();
    await upload(page, source);
    await page.getByRole("button", { name: /^Remove Metadata/ }).click();
    const info = await meta((await download(page, "Download Image")).bytes);
    expect(info.exif).toBeUndefined();
    expect(info.xmp).toBeUndefined();
  });
});

test.describe("transform", () => {
  tool("crop-image", async (page) => {
    await upload(page, photo);
    await page.getByRole("radio", { name: "1:1 Square" }).click();
    await page.getByRole("button", { name: /^Crop Image/ }).click();
    const info = await meta((await download(page, "Download Image")).bytes);
    expect(info.width).toBe(info.height);
    expect(info.width).toBeGreaterThan(100);
  });

  tool("rotate-image", async (page) => {
    await upload(page, photo);
    await page.getByRole("button", { name: /^Rotate Right/ }).click();
    await page.getByRole("button", { name: /^Apply Changes/ }).click();
    const info = await meta((await download(page, "Download Image")).bytes);
    expect([info.width, info.height]).toEqual([900, 1200]);
  });

  tool("flip-image", async (page) => {
    await upload(page, photo);
    await page.getByRole("button", { name: /^Flip Horizontal/ }).click();
    await page.getByRole("button", { name: /^Apply Flip/ }).click();
    const { bytes } = await download(page, "Download Image");
    const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const red = (x: number) => data[(450 * info.width + x) * info.channels];
    // The source gets redder to the right; mirrored, it gets redder to the left.
    expect(red(20)).toBeGreaterThan(red(info.width - 20) + 150);
  });

  for (const [id, check] of [
    ["watermark-image", async (bytes: Buffer) => expect((await meta(bytes)).width).toBe(1200)],
    ["add-border", async (bytes: Buffer) => {
      const info = await meta(bytes);
      expect(info.width).toBeGreaterThanOrEqual(1200);
    }],
    ["rounded-corners", async (bytes: Buffer) => {
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(data[3], "the corner should be transparent").toBe(0);
      expect(data[((info.height / 2) * info.width + info.width / 2) * 4 + 3], "the centre should be opaque").toBe(255);
    }],
    ["grayscale-image", async (bytes: Buffer) => {
      const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const [x, y] of [[100, 100], [900, 300], [600, 800]]) {
        const at = (y * info.width + x) * info.channels;
        expect(new Set([data[at], data[at + 1], data[at + 2]]).size, `pixel ${x},${y}`).toBe(1);
      }
    }],
    ["sharpen-image", async (bytes: Buffer) => expect((await meta(bytes)).width).toBe(1200)],
    ["blur-image", async (bytes: Buffer) => expect((await meta(bytes)).width).toBeGreaterThan(500)]
  ] as const) {
    tool(id, async (page) => {
      await upload(page, photo);
      const result = await download(page, "Download Image");
      expect(result.name).toBe(`photo-${id}.png`);
      expect((await meta(result.bytes)).format).toBe("png");
      await check(result.bytes);
    });
  }
});

test.describe("convert", () => {
  tool("image-converter", async (page) => {
    await upload(page, photo);
    // AVIF has no browser encoder, so this goes through the server's libvips path.
    await page.getByRole("radio", { name: "AVIF", exact: true }).click();
    await page.getByRole("button", { name: /^Convert 1 Image to AVIF/ }).click();
    const info = await meta((await download(page, "Download photo.jpg")).bytes);
    expect([info.format, info.width, info.height]).toEqual(["heif", 1200, 900]);
  });

  tool("image-to-pdf", async (page) => {
    await upload(page, photo, `${SAMPLES}/leaf.jpg`);
    await page.getByRole("button", { name: /^Create PDF/ }).click();
    const pdf = await PDFDocument.load((await download(page, "Download PDF")).bytes);
    expect(pdf.getPageCount()).toBe(2);
  });

  tool("screenshot-to-pdf", async (page) => {
    await upload(page, `${SAMPLES}/dashboard.png`);
    await page.getByRole("button", { name: /^Create PDF/ }).click();
    const pdf = await PDFDocument.load((await download(page, "Download PDF")).bytes);
    expect(pdf.getPageCount()).toBe(1);
  });

  tool("image-to-base64", async (page) => {
    const source = `${SAMPLES}/mark.png`;
    await upload(page, source);
    const result = await download(page, /^Download \.txt/);
    expect(result.bytes.toString("utf8")).toBe(`data:image/png;base64,${readFileSync(source).toString("base64")}`);
  });

  tool("base64-to-image", async (page) => {
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#228833" } }).png().toBuffer();
    await page.getByRole("textbox", { name: "Base64 image payload" }).fill(`data:image/png;base64,${png.toString("base64")}`);
    await page.getByRole("button", { name: /^Generate Image/ }).click();
    const info = await meta((await download(page, /^Download/)).bytes);
    expect([info.width, info.height]).toEqual([64, 48]);
  });

  tool("favicon-generator", async (page) => {
    await upload(page, `${SAMPLES}/mark.png`);
    // Each file's name and its sizes share a narrow column; they once ran over each other.
    const rows = page.locator(".file-check");
    await expect(rows).toHaveCount(7);
    const overlapping = await rows.evaluateAll((elements) => elements.filter((row) => {
      const name = row.querySelector("b")!.getBoundingClientRect();
      const detail = row.querySelector("small")!.getBoundingClientRect();
      return !(name.bottom <= detail.top || detail.bottom <= name.top || name.right <= detail.left || detail.right <= name.left);
    }).map((row) => row.querySelector("b")!.textContent));
    expect(overlapping).toEqual([]);
    const names = zipNames((await download(page, /Download All Files/)).bytes);
    for (const name of ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "site.webmanifest"]) {
      expect(names).toContain(name);
    }
  });

  tool("gif-to-frames", async (page) => {
    await upload(page, `${SAMPLES}/loader.gif`);
    await expect(page.getByText(/16 frames ready to export/)).toBeVisible();
    const names = zipNames((await download(page, /Download Frames/)).bytes);
    expect(names.filter((name) => name.endsWith(".png"))).toHaveLength(16);
  });
});

test.describe("AI & OCR", () => {
  tool("background-removal", async (page) => {
    await upload(page, `${SAMPLES}/portrait.jpg`);
    await page.getByRole("button", { name: /^Run Background Removal/ }).click();
    // A cut-out on plain white looks like it still has a background; the checkerboard says it does not.
    const result = page.getByRole("img", { name: "Result" });
    await expect(result).toBeVisible();
    expect(await result.evaluate((img) => getComputedStyle(img.parentElement!).backgroundImage)).toContain("gradient");
    const { bytes } = await download(page, "Download PNG");
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => data[(Math.round(y) * info.width + Math.round(x)) * 4 + 3];
    expect(alpha(2, 2), "the background should be cleared").toBe(0);
    expect([...data.filter((_, index) => index % 4 === 3)].some((value) => value === 255), "the subject should remain").toBe(true);
  }, { worker: true });

  tool("image-upscaler", async (page) => {
    const source = `${SAMPLES}/mark.png`;
    const before = await meta(readFileSync(source));
    await upload(page, source);
    await page.getByRole("button", { name: "2×", exact: true }).click();
    await page.getByRole("button", { name: /^Run Image Upscaler/ }).click();
    const info = await meta((await download(page, "Download PNG")).bytes);
    expect([info.width, info.height]).toEqual([before.width! * 2, before.height! * 2]);
  }, { worker: true });

  tool("ocr-image", async (page) => {
    await upload(page, `${SAMPLES}/receipt.png`);
    await page.getByRole("button", { name: /^Run OCR Image/ }).click();
    await expect(page.getByText(/Text extracted successfully/)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("main")).toContainText("COFFEE HOUSE");
    await expect(page.locator("main")).toContainText("Latte");
  }, { worker: true });

  tool("screenshot-to-text", async (page) => {
    await upload(page, `${SAMPLES}/dashboard.png`);
    await page.getByRole("button", { name: /^Run Screenshot to Text/ }).click();
    await expect(page.getByText(/Text extracted successfully/)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("main")).toContainText("Project Dashboard");
  }, { worker: true });
});

test.describe("utility", () => {
  tool("image-metadata-viewer", async (page) => {
    await upload(page, `${SAMPLES}/photo-exif.jpg`);
    await expect(page.getByText(/metadata fields found/)).toBeVisible();
    const json = JSON.parse((await download(page, /Download as JSON/)).bytes.toString("utf8"));
    expect(JSON.stringify(json)).toMatch(/Make|Model|GPS/);
  });

  tool("image-dimensions", async (page) => {
    await upload(page, photo);
    await expect(page.locator("main")).toContainText(/1,?200\s*×\s*900/);
  });

  tool("image-compare", async (page) => {
    const inputs = page.locator("input[type=file]");
    await inputs.nth(0).setInputFiles(`${SAMPLES}/compare-before.jpg`);
    await inputs.nth(1).setInputFiles(`${SAMPLES}/compare-after.jpg`);
    await expect(page.getByText(/Comparison complete/)).toBeVisible();
    await expect(page.locator("main")).toContainText(/pixels differ \([\d.]+%\)/);
  });

  tool("color-picker", async (page) => {
    await upload(page, solid);
    await expect(page.locator("main")).toContainText("#3366CC");
  });

  tool("color-palette-extractor", async (page) => {
    await upload(page, solid);
    await expect(page.getByText(/Palette extracted successfully/)).toBeVisible();
    await expect(page.locator("main")).toContainText("#3366CC");
  });

  for (const [id, button] of [["contact-sheet", /^Download Sheet/], ["image-collage", /^Download Collage/]] as const) {
    tool(id, async (page) => {
      await upload(page, photo, `${SAMPLES}/leaf.jpg`);
      const info = await meta((await download(page, button)).bytes);
      expect(info.format).toBe("png");
      expect(info.width).toBe(1600);
    });
  }
});

test("every live tool has a browser test here", () => {
  expect(READY_TOOLS.map((item) => item.id).filter((id) => !covered.has(id))).toEqual([]);
});
