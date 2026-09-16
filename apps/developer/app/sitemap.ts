import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://dev.utilfoundry.com";

/**
 * Every tool page. `/` is left out on purpose: it redirects to the first tool, and a
 * sitemap entry that redirects is a soft error to a crawler.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return TOOLS.map((tool) => ({
    url: `${SITE}/${tool.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
}
