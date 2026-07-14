import type { Metadata } from "next";

import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import type { PublicBlogPost } from "@/lib/public-content";
import { getBlogCopy } from "./blog-copy";
import { getBlogPath, getBlogPostPath } from "./blog-routes";

const languageTags: Record<Locale, string> = {
  bg: "bg-BG",
  ru: "ru",
  ua: "uk-UA",
  en: "en",
};

const openGraphLocales: Record<Locale, string> = {
  bg: "bg_BG",
  ru: "ru_RU",
  ua: "uk_UA",
  en: "en_GB",
};

function blogLanguageAlternates(pathFor: (locale: Locale) => string) {
  return {
    ...Object.fromEntries(locales.map((locale) => [languageTags[locale], pathFor(locale)])),
    "x-default": pathFor("bg"),
  };
}

export function createBlogIndexMetadata(locale: Locale): Metadata {
  const copy = getBlogCopy(locale);
  const canonical = getBlogPath(locale);

  return {
    title: copy.blogTitle,
    description: copy.intro,
    alternates: {
      canonical,
      languages: blogLanguageAlternates(getBlogPath),
    },
    openGraph: {
      title: `${copy.blogTitle} | Magic Massage Natali`,
      description: copy.intro,
      locale: openGraphLocales[locale],
      type: "website",
      url: canonical,
    },
  };
}

export function createBlogPostMetadata(locale: Locale, post: PublicBlogPost): Metadata {
  const copy = getBlogCopy(locale);
  const fallbackCanonical = getBlogPostPath(locale, post.slug);
  const canonical = post.seo.canonicalUrl || fallbackCanonical;
  const title = post.seo.ogTitle || post.title;
  const description = post.seo.description || post.seo.ogDescription || copy.articleFallbackDescription;
  const configuredLanguages = Object.fromEntries(
    Object.entries(post.seo.hreflang).flatMap(([item, url]) => {
      if (!url || !locales.includes(item as Locale)) return [];
      return [[languageTags[item as Locale], url]];
    }),
  );
  const currentLanguage = languageTags[locale];
  const languages = {
    ...configuredLanguages,
    [currentLanguage]: canonical,
    "x-default": configuredLanguages[languageTags.bg] ?? canonical,
  };
  const image = post.seo.ogImage ?? post.coverMedia;

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description: post.seo.ogDescription || description,
      locale: openGraphLocales[locale],
      type: "article",
      url: canonical,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: post.author ? [post.author] : undefined,
      images: image ? [{ alt: image.altText || post.title, url: image.url }] : undefined,
    },
    robots: post.seo.robots,
  };
}
