import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const TOOL_ROUTES = [
  "merge-pdf",
  "split-pdf",
  "organize-pdf",
  "rotate-pdf",
  "crop-pdf",
  "ocr-pdf",
  "image-to-pdf",
  "pdf-to-image",
  "word-to-pdf",
  "excel-to-pdf",
  "ppt-to-pdf",
  "pdf-to-word",
  "pdf-to-ppt",
  "compress-pdf",
  "grayscale-pdf",
  "extract-images",
  "watermark-pdf",
  "page-numbers-pdf",
  "lock-pdf",
  "unlock-pdf",
  "sign-pdf",
  "redact-pdf",
  "repair-pdf",
  "pdf-to-text",
  "edit-metadata",
  "pages-per-sheet",
  "bookmarks-pdf",
  "sanitize-pdf",
  "header-footer-pdf",
  "text-to-pdf"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...TOOL_ROUTES.map(slug => ({
      url: `${SITE_URL}/tools/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8
    }))
  ];
}
