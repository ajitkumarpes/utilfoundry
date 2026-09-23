import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://dev.utilfoundry.com";

/**
 * The catalog, every tool page, then the legal pages. `/` is left out on purpose: it
 * redirects to the first tool, and a sitemap entry that redirects is a soft error to a crawler.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE}/tools`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    ...TOOLS.map((tool) => ({
      url: `${SITE}/${tool.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
