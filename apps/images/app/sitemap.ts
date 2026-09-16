import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://images.utilfoundry.com";

/**
 * Every live tool page. `/` redirects to the first tool so it is left out, and any tool
 * flagged `comingSoon` is excluded — there is nothing there worth indexing yet.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return TOOLS.filter((tool) => !tool.comingSoon).map((tool) => ({
    url: `${SITE}/${tool.id}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
}
