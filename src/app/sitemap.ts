import type { MetadataRoute } from "next";

import { getBlogPath, getBlogPostPath } from "@/components/public-blog/blog-routes";
import { getPublicShellRuntime, getRuntimeBlogPosts } from "@/content/public-content-runtime";
import { locales } from "@/i18n/config";
import { getPublicPagePath } from "@/navigation/public-routes";
import { getServicePagePath } from "@/navigation/service-routes";
import { getPublicSitemapPages } from "@/seo/public-page-metadata";
import { publicContentLastModified } from "@/seo/content-dates";
import { siteUrl } from "@/seo/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const runtimeByLocale = await Promise.all(
    locales.map(async (locale) => {
      const [posts, shell] = await Promise.all([getRuntimeBlogPosts(locale), getPublicShellRuntime(locale)]);
      return { locale, posts, shell };
    }),
  );

  return runtimeByLocale.flatMap(({ locale, posts, shell }) => {
    const latestBlogUpdate = posts.map((post) => post.updatedAt).sort().at(-1);
    const publicPages = getPublicSitemapPages().filter(
      (page) => page !== "giftCertificates" || shell.giftCertificatesEnabled,
    );

    return [
      ...publicPages.map((page) => ({
        url: `${siteUrl}${getPublicPagePath(locale, page)}`,
        lastModified: publicContentLastModified,
        changeFrequency: "weekly" as const,
        priority: page === "home" && locale === "bg" ? 1 : 0.85,
      })),
      ...shell.services.map((service) => ({
        url: `${siteUrl}${getServicePagePath(locale, service.slug)}`,
        lastModified: publicContentLastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      {
        url: `${siteUrl}${getBlogPath(locale)}`,
        ...(latestBlogUpdate ? { lastModified: latestBlogUpdate } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.75,
      },
      ...posts.map((post) => ({
        url: `${siteUrl}${getBlogPostPath(locale, post.slug)}`,
        lastModified: post.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  });
}
