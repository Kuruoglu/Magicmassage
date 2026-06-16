import type { MetadataRoute } from "next";

import { locales } from "@/i18n/config";
import { getPublicPagePath } from "@/navigation/public-routes";
import { getPublicSitemapPages } from "@/seo/public-page-metadata";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    getPublicSitemapPages().map((page) => ({
      url: `${siteUrl}${getPublicPagePath(locale, page)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: page === "home" && locale === "bg" ? 1 : 0.85,
    })),
  );
}
