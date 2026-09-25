import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Every tool, end to end: a real file through the real page to the real backend and back,
 * and the file that comes back opened and checked for what the tool promises (pages, text,
 * rotation, metadata, encryption...) rather than for a success message.
 *
 * Needs a backend. Set E2E_API_URL when this frontend was built against a local stack
 * (CI starts apps/pdf/docker-compose.yml), or E2E_BASE_URL to run against a deployed site.
 */
const ROUND_TRIP = !!(process.env.E2E_API_URL || process.env.E2E_BASE_URL);
const FIXTURES = join(process.cwd(), "e2e", "fixtures");
const fixture = (name: string) => join(FIXTURES, name);
const covered = new Set<string>();

type PdfDocument = {
  numPages: number;
  getPage(n: number): Promise<{ rotate: number; view: number[]; getTextContent(): Promise<{ items: Array<{ str?: string }> }>; getOperatorList(): Promise<{ fnArray: number[] }>; getAnnotations(): Promise<unknown[]> }>;
  getOutline(): Promise<Array<{ title: string }> | null>;
  getMetadata(): Promise<{ info: Record<string, unknown> }>;
  getAttachments(): Promise<Record<string, unknown> | null>;
  getFieldObjects(): Promise<Record<string, unknown> | null>;
};

async function openPdf(bytes: Buffer, password?: string): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  expect(bytes.subarray(0, 5).toString(), "not a PDF").toBe("%PDF-");
  return (await pdfjs.getDocument({ data: new Uint8Array(bytes), password, useSystemFonts: true }).promise) as unknown as PdfDocument;
}

async function textOf(pdf: PdfDocument, pageNumber = 1) {
  const page = await pdf.getPage(pageNumber);
  return (await page.getTextContent()).items.map((item) => item.str ?? "").join(" ");
}

async function allText(pdf: PdfDocument) {
  const pages: string[] = [];
  for (let index = 1; index <= pdf.numPages; index += 1) pages.push(await textOf(pdf, index));
  return pages.join("\n");
}

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

function tool(slug: string, body: (page: Page) => Promise<void>) {
  covered.add(slug);
  test(slug, async ({ page }) => {
    test.skip(!ROUND_TRIP, "Needs a backend: set E2E_API_URL or E2E_BASE_URL.");
    await page.goto(`/tools/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await body(page);
    await expect(page.locator(".error-box")).toHaveCount(0);
  });
}

async function upload(page: Page, ...names: string[]) {
  await page.locator("main input[type=file]").first().setInputFiles(names.map(fixture));
}

async function saved(download: Promise<import("@playwright/test").Download>) {
  const file = await download;
  return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

/** Clicks the tool's button, then the result link it offers. */
async function run(page: Page, action: string | RegExp, result: string | RegExp) {
  await page.getByRole("button", { name: action }).click();
  const link = page.getByRole("link", { name: result });
  await expect(link).toBeVisible({ timeout: 90_000 });
  return saved(Promise.all([page.waitForEvent("download"), link.click()]).then(([download]) => download));
}

/** Background jobs (Office, OCR) start their download by themselves when they finish. */
async function runJob(page: Page, action: string | RegExp) {
  const download = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: action }).click();
  return saved(download);
}

test.beforeAll(async ({ request }) => {
  if (!ROUND_TRIP) return;
  const api = process.env.E2E_API_URL ?? process.env.E2E_BASE_URL;
  // A page serving 200 says nothing about whether Spring has finished booting.
  await expect
    .poll(async () => (await request.get(`${api}/actuator/health`).catch(() => null))?.status() ?? 0, {
      message: "waiting for the backend to report healthy",
      timeout: 120_000,
      intervals: [1000]
    })
    .toBe(200);
});

test.describe("organize", () => {
  tool("merge-pdf", async (page) => {
    await upload(page, "three-pages.pdf", "two-pages.pdf");
    const pdf = await openPdf((await run(page, /^Merge PDFs/, /Download merged\.pdf/)).bytes);
    expect(pdf.numPages).toBe(5);
    expect(await textOf(pdf, 4)).toContain("Appendix page 1");
  });

  tool("split-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    const names = zipNames((await run(page, /^Split PDF/, /Download split-pages\.zip/)).bytes);
    expect(names.filter((name) => name.endsWith(".pdf"))).toHaveLength(3);
  });

  tool("organize-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByRole("button", { name: "Remove Page 2" }).click();
    const result = await saved(Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download organized PDF (2 pages)" }).click()
    ]).then(([download]) => download));
    const pdf = await openPdf(result.bytes);
    expect(pdf.numPages).toBe(2);
    expect(await textOf(pdf, 2)).toContain("Report page 3");
  });

  tool("rotate-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByRole("button", { name: /^90°/ }).click();
    const pdf = await openPdf((await run(page, /^Rotate PDF/, /Download rotated\.pdf/)).bytes);
    expect((await pdf.getPage(1)).rotate).toBe(90);
  });

  tool("crop-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    const pdf = await openPdf((await run(page, /^Crop PDF/, /Download cropped\.pdf/)).bytes);
    const [x0, y0, x1, y1] = (await pdf.getPage(1)).view;
    expect((x1 - x0) * (y1 - y0), "the page should be smaller than A4").toBeLessThan(595 * 842);
  });

  tool("pages-per-sheet", async (page) => {
    await upload(page, "three-pages.pdf");
    const pdf = await openPdf((await run(page, /^Combine Pages/, /Download pages-per-sheet\.pdf/)).bytes);
    expect(pdf.numPages).toBe(2);
  });

  tool("bookmarks-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByRole("button", { name: /Add bookmark/ }).click();
    await page.locator("main input[type=text]").first().fill("Introduction");
    const pdf = await openPdf((await run(page, /Save Bookmarks/, /Download bookmarked\.pdf/)).bytes);
    expect((await pdf.getOutline())?.map((item) => item.title)).toContain("Introduction");
  });
});

test.describe("edit", () => {
  tool("page-numbers-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByLabel("Start numbering at").fill("7");
    const pdf = await openPdf((await run(page, /Add Page Numbers/, /Download numbered\.pdf/)).bytes);
    expect(await textOf(pdf, 1)).toMatch(/\b7\b/);
    expect(await textOf(pdf, 3)).toMatch(/\b9\b/);
  });

  tool("watermark-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByLabel("Text").fill("DRAFT");
    const pdf = await openPdf((await run(page, /Add Watermark/, /Download/)).bytes);
    expect(await allText(pdf)).toContain("DRAFT");
  });

  tool("header-footer-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByLabel("Top center content").selectOption("TEXT");
    await page.getByLabel("Top center text").fill("ACME Confidential");
    const pdf = await openPdf((await run(page, /Add Header/, /Download/)).bytes);
    expect(await textOf(pdf, 2)).toContain("ACME Confidential");
  });

  tool("edit-metadata", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByLabel("Title").fill("Quarterly report");
    await page.getByLabel("Author").fill("Asha Rao");
    const pdf = await openPdf((await run(page, /Update Metadata/, /Download updated-metadata\.pdf/)).bytes);
    const { info } = await pdf.getMetadata();
    expect([info.Title, info.Author]).toEqual(["Quarterly report", "Asha Rao"]);
  });

  tool("sign-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    const pad = page.locator("canvas.sig-pad");
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 20; step += 1) {
      await page.mouse.move(box.x + 20 + step * 12, box.y + box.height / 2 + Math.sin(step / 2) * 25);
    }
    await page.mouse.up();
    await page.getByRole("button", { name: "Use this signature" }).click();
    const result = await saved(Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Sign PDF" }).click()
    ]).then(([download]) => download));
    const pdf = await openPdf(result.bytes);
    const before = await openPdf(readFileSync(fixture("three-pages.pdf")));
    const images = async (doc: PdfDocument) => (await (await doc.getPage(1)).getOperatorList()).fnArray.length;
    expect(await images(pdf), "the signature should be drawn on page 1").toBeGreaterThan(await images(before));
  });

  tool("redact-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    // Draw only once every thumbnail has rendered: until then the preview is still moving.
    await expect(page.getByRole("img", { name: "Page 3" })).toBeVisible();
    const preview = page.getByRole("img", { name: "Page 1 preview" });
    await expect(preview).toBeVisible();
    await expect.poll(async () => (await preview.boundingBox())?.height ?? 0).toBeGreaterThan(400);
    // The preview starts below the fold; a drag has to happen where the pointer can reach it.
    // "instant": the page scrolls smoothly, and a box measured mid-animation puts the drag elsewhere.
    await preview.evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
    const box = (await preview.boundingBox())!;
    // Over the "Confidential account number" line, 142 pt from the top of an 842 pt page.
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.14);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: /^Redact PDF \(1 area\)/ })).toBeEnabled();
    const result = await saved(Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Redact PDF \(1 area\)/ }).click()
    ]).then(([download]) => download));
    const pdf = await openPdf(result.bytes);
    expect(await textOf(pdf, 1)).not.toContain("4111");
    expect(await textOf(pdf, 1)).toContain("Report page 1");
    expect(await textOf(pdf, 2), "only page 1 was redacted").toContain("4111");
  });
});

test.describe("optimize and repair", () => {
  tool("compress-pdf", async (page) => {
    await upload(page, "with-image.pdf");
    const pdf = await openPdf((await run(page, /^Compress PDF/, /Download compressed\.pdf/)).bytes);
    expect(pdf.numPages).toBe(1);
  });

  tool("grayscale-pdf", async (page) => {
    await upload(page, "with-image.pdf");
    const link = page.getByRole("link", { name: /Download grayscale\.pdf/ });
    await expect(link).toBeVisible({ timeout: 90_000 });
    const result = await saved(Promise.all([page.waitForEvent("download"), link.click()]).then(([download]) => download));
    expect((await openPdf(result.bytes)).numPages).toBe(1);
  });

  tool("repair-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    expect((await openPdf((await run(page, /^Repair PDF/, /Download repaired\.pdf/)).bytes)).numPages).toBe(3);
  });

  tool("flatten-pdf", async (page) => {
    await upload(page, "with-form.pdf");
    const pdf = await openPdf((await run(page, /^Flatten PDF/, /Download/)).bytes);
    expect(await pdf.getFieldObjects(), "no form fields should remain").toBeNull();
    // The filled value is kept as ordinary page content.
    expect(await textOf(pdf, 1)).toContain("Asha Rao");
  });

  tool("sanitize-pdf", async (page) => {
    await upload(page, "with-attachment.pdf");
    const pdf = await openPdf((await run(page, /^Sanitize PDF/, /Download sanitized\.pdf/)).bytes);
    expect(await pdf.getAttachments()).toBeNull();
  });
});

test.describe("security", () => {
  tool("lock-pdf", async (page) => {
    await upload(page, "three-pages.pdf");
    await page.getByLabel("Open password (optional)").fill("open-sesame");
    const { bytes } = await run(page, /^Lock PDF/, /Download locked\.pdf/);
    await expect(openPdf(bytes)).rejects.toThrow(/password/i);
    expect((await openPdf(bytes, "open-sesame")).numPages).toBe(3);
  });

  tool("unlock-pdf", async (page) => {
    await upload(page, "locked.pdf");
    await page.getByLabel("Password").fill("open-sesame");
    const pdf = await openPdf((await run(page, /^Unlock PDF/, /Download unlocked\.pdf/)).bytes);
    expect(await textOf(pdf, 1)).toContain("Report page 1");
  });
});

test.describe("extract", () => {
  tool("pdf-to-text", async (page) => {
    await upload(page, "three-pages.pdf");
    const { bytes } = await run(page, /Extract Text/, /Download extracted\.txt/);
    expect(bytes.toString("utf8")).toContain("Report page 3");
  });

  tool("pdf-to-image", async (page) => {
    await upload(page, "three-pages.pdf");
    const names = zipNames((await run(page, /Convert to Images/, /Download pdf-images\.zip/)).bytes);
    expect(names).toHaveLength(3);
  });

  tool("extract-images", async (page) => {
    await upload(page, "with-image.pdf");
    const { bytes } = await run(page, /Extract Images/, /Download page-1-image-1\.png/);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  });

  tool("extract-attachments", async (page) => {
    await upload(page, "with-attachment.pdf");
    const { bytes } = await run(page, /Extract Attachments/, /Download items\.csv/);
    expect(bytes.toString("utf8")).toContain("widget,4.50");
  });

  tool("extract-links", async (page) => {
    await upload(page, "with-link.pdf");
    const { bytes } = await run(page, /Extract Links/, /Download/);
    expect(bytes.toString("utf8")).toContain("https://utilfoundry.com/tools");
  });

  tool("extract-fonts", async (page) => {
    await upload(page, "embedded-fonts.pdf");
    const { name, bytes } = await run(page, /Extract Fonts/, /Download/);
    // One font comes back as the font itself (a subset: only the glyphs used), several as a ZIP.
    expect(name).toMatch(/\.(zip|ttf|otf)$/);
    const signature = bytes.subarray(0, 4).toString("hex");
    expect(["00010000", "4f54544f", "504b0304"], `unexpected file signature ${signature}`).toContain(signature);
  });
});

test.describe("convert to PDF", () => {
  tool("image-to-pdf", async (page) => {
    await upload(page, "receipt.png", "mark.png");
    const pdf = await openPdf((await run(page, /^Convert to PDF/, /Download converted\.pdf/)).bytes);
    expect(pdf.numPages).toBe(2);
  });

  for (const [slug, file, text] of [
    ["html-to-pdf", "letter.html", "Quarterly letter"],
    ["markdown-to-pdf", "notes.md", "Release notes"],
    ["text-to-pdf", "notes.txt", "Meeting notes"]
  ] as const) {
    tool(slug, async (page) => {
      await upload(page, file);
      const pdf = await openPdf((await run(page, /^Create PDF/, /Download/)).bytes);
      expect(await textOf(pdf, 1)).toContain(text);
    });
  }

  for (const [slug, file, text] of [
    ["word-to-pdf", "letter.docx", "Quarterly letter"],
    ["excel-to-pdf", "sales.xlsx", "North"],
    ["ppt-to-pdf", "deck.pptx", "Report page"]
  ] as const) {
    tool(slug, async (page) => {
      await upload(page, file);
      const pdf = await openPdf((await runJob(page, /^Convert to PDF/)).bytes);
      expect(await allText(pdf)).toContain(text);
    });
  }

  tool("ocr-pdf", async (page) => {
    await upload(page, "scanned.pdf");
    expect(await allText(await openPdf(readFileSync(fixture("scanned.pdf")))), "the scan starts with no text").not.toContain("COFFEE");
    const pdf = await openPdf((await runJob(page, /^Run OCR/)).bytes);
    expect(await allText(pdf)).toContain("COFFEE");
  });
});

test.describe("convert from PDF", () => {
  for (const [slug, action, part] of [
    ["pdf-to-word", /Convert to Word/, "word/document.xml"],
    ["pdf-to-ppt", /Convert to PowerPoint/, "ppt/presentation.xml"]
  ] as const) {
    tool(slug, async (page) => {
      await upload(page, "three-pages.pdf");
      expect(zipNames((await runJob(page, action)).bytes)).toContain(part);
    });
  }
});

test("every tool has a round-trip test here", () => {
  const slugs = readdirSync(join(process.cwd(), "app", "tools"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  expect(slugs.filter((slug) => !covered.has(slug))).toEqual([]);
});
