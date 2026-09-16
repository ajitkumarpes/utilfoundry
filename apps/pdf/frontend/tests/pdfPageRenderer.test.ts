import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const renderSpy = vi.fn();

/** A stand-in for pdfjs: real rendering needs a worker and a canvas implementation. */
vi.mock("pdfjs-dist", () => {
  const makePage = () => ({
    getViewport: ({ scale }: { scale: number }) => ({
      width: PAGE_WIDTH * scale,
      height: PAGE_HEIGHT * scale,
    }),
    render: (options: unknown) => {
      renderSpy(options);
      return { promise: Promise.resolve() };
    },
  });
  return {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: () => ({
      promise: Promise.resolve({ numPages: 3, getPage: async () => makePage() }),
    }),
  };
});

import { renderAllPageThumbnails, renderSinglePage } from "../lib/pdfPageRenderer";

function pdfFile() {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "sample.pdf", {
    type: "application/pdf",
  });
}

/** getContext is heavily overloaded, so the stub is cast to the whole signature. */
function stubCanvasContext(context: CanvasRenderingContext2D | null) {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => context,
  ) as unknown as HTMLCanvasElement["getContext"];
}

beforeEach(() => {
  renderSpy.mockClear();
  stubCanvasContext({} as CanvasRenderingContext2D);
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,stub");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderAllPageThumbnails", () => {
  it("renders one thumbnail per page, indexed from zero", async () => {
    const pages = await renderAllPageThumbnails(pdfFile());

    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.pageIndex)).toEqual([0, 1, 2]);
    for (const page of pages) expect(page.dataUrl).toBe("data:image/png;base64,stub");
  });

  it("applies the default scale to the page dimensions", async () => {
    const [first] = await renderAllPageThumbnails(pdfFile());

    expect(first.renderWidth).toBeCloseTo(PAGE_WIDTH * 0.45);
    expect(first.renderHeight).toBeCloseTo(PAGE_HEIGHT * 0.45);
  });

  it("honours a caller-supplied scale", async () => {
    const [first] = await renderAllPageThumbnails(pdfFile(), 1.5);

    expect(first.renderWidth).toBeCloseTo(PAGE_WIDTH * 1.5);
    expect(first.renderHeight).toBeCloseTo(PAGE_HEIGHT * 1.5);
  });

  it("draws each page onto a canvas context", async () => {
    await renderAllPageThumbnails(pdfFile());
    expect(renderSpy).toHaveBeenCalledTimes(3);
  });

  it("still returns a result when the canvas has no 2d context", async () => {
    stubCanvasContext(null);

    const pages = await renderAllPageThumbnails(pdfFile());

    expect(pages).toHaveLength(3);
    expect(renderSpy).not.toHaveBeenCalled();
  });
});

describe("renderSinglePage", () => {
  it("scales the page to the requested width", async () => {
    const page = await renderSinglePage(pdfFile(), 0, 300);

    // scale = target / natural width, so the height follows the same ratio.
    expect(page.renderWidth).toBeCloseTo(300);
    expect(page.renderHeight).toBeCloseTo(PAGE_HEIGHT * (300 / PAGE_WIDTH));
  });

  it("keeps the caller's zero-based page index", async () => {
    const page = await renderSinglePage(pdfFile(), 2, 600);

    expect(page.pageIndex).toBe(2);
    expect(page.dataUrl).toBe("data:image/png;base64,stub");
  });

  it("can enlarge beyond the natural width", async () => {
    const page = await renderSinglePage(pdfFile(), 0, 1200);

    expect(page.renderWidth).toBeCloseTo(1200);
    expect(page.renderHeight).toBeCloseTo(PAGE_HEIGHT * 2);
  });
});
