export type RenderedPage = {
  pageIndex: number;
  dataUrl: string;
  renderWidth: number;
  renderHeight: number;
  /** The page's own size in PDF points (pdf.js viewport at scale 1) — renderWidth / pageWidthPt
   *  converts a screen pixel to the points the backend places elements in. */
  pageWidthPt: number;
  pageHeightPt: number;
};

type PageViewportLike = { width: number; height: number };
type RenderablePage = {
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PageViewportLike;
  }): { promise: Promise<unknown> };
};

async function loadPdfDocument(file: File) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  // No eval: the site's Content-Security-Policy forbids it, and pdf.js has a slower path without it.
  return pdfjsLib.getDocument({ data: buffer, isEvalSupported: false }).promise;
}

async function renderPageToDataUrl(
  page: RenderablePage,
  viewport: PageViewportLike
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    await page.render({ canvasContext: ctx, viewport }).promise;
  }
  return canvas.toDataURL("image/png");
}

export async function renderAllPageThumbnails(file: File, scale = 0.45): Promise<RenderedPage[]> {
  const pdf = await loadPdfDocument(file);
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale });
    const dataUrl = await renderPageToDataUrl(page, viewport);
    pages.push({
      pageIndex: i - 1,
      dataUrl,
      renderWidth: viewport.width,
      renderHeight: viewport.height,
      pageWidthPt: baseViewport.width,
      pageHeightPt: baseViewport.height
    });
  }

  return pages;
}

export async function renderSinglePage(file: File, pageIndex: number, targetWidth: number): Promise<RenderedPage> {
  const pdf = await loadPdfDocument(file);
  const page = await pdf.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const dataUrl = await renderPageToDataUrl(page, viewport);
  return {
    pageIndex,
    dataUrl,
    renderWidth: viewport.width,
    renderHeight: viewport.height,
    pageWidthPt: baseViewport.width,
    pageHeightPt: baseViewport.height
  };
}
