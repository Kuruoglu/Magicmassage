import type { MetadataRoute } from "next";

import { getServiceSlugs } from "@/content/public-pages";
import { locales } from "@/i18n/config";
import { getPublicPagePath } from "@/navigation/public-routes";
import { getServicePagePath } from "@/navigation/service-routes";
import { getPublicSitemapPages } from "@/seo/public-page-metadata";
import { siteUrl } from "@/seo/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    [
      ...getPublicSitemapPages().map((page) => ({
        url: `${siteUrl}${getPublicPagePath(locale, page)}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: page === "home" && locale === "bg" ? 1 : 0.85,
      })),
      ...getServiceSlugs(locale).map((slug) => ({
        url: `${siteUrl}${getServicePagePath(locale, slug)}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ],
  );
}
