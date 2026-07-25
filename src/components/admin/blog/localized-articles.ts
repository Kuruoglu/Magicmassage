import type { BlogPostRecord, BlogStatus } from "@/admin/domain";

import { BLOG_LOCALES, type BlogLocale } from "./types";

export const BLOG_ADMIN_LOCALE_ORDER = ["ru", "bg", "ua", "en"] as const satisfies readonly BlogLocale[];

export const BLOG_LOCALE_LABELS: Record<BlogLocale, string> = {
  bg: "BG",
  en: "EN",
  ru: "RU",
  ua: "UA",
};

export type LocalizedBlogArticle = {
  declaredLocales: BlogLocale[];
  key: string;
  primaryPost: BlogPostRecord;
  status: BlogStatus | "Смешанный";
  translations: Partial<Record<BlogLocale, BlogPostRecord>>;
};

function isBlogLocale(locale: string): locale is BlogLocale {
  return BLOG_LOCALES.includes(locale as BlogLocale);
}

export function getBlogPostLocale(post: BlogPostRecord): BlogLocale {
  return post.locales.find(isBlogLocale) ?? "bg";
}

function preferredPost(translations: Partial<Record<BlogLocale, BlogPostRecord>>, fallback: BlogPostRecord) {
  for (const locale of BLOG_ADMIN_LOCALE_ORDER) {
    const translation = translations[locale];
    if (translation) return translation;
  }

  return fallback;
}

export function groupLocalizedBlogArticles(posts: readonly BlogPostRecord[]): LocalizedBlogArticle[] {
  const groups = new Map<string, BlogPostRecord[]>();

  posts.forEach((post) => {
    const key = (post.translationKey ?? post.id).trim() || post.id;
    groups.set(key, [...(groups.get(key) ?? []), post]);
  });

  return [...groups.entries()].map(([key, groupedPosts]) => {
    const translations: Partial<Record<BlogLocale, BlogPostRecord>> = {};
    const declaredLocales = new Set<BlogLocale>();

    groupedPosts.forEach((post) => {
      post.locales.filter(isBlogLocale).forEach((locale) => declaredLocales.add(locale));
      translations[getBlogPostLocale(post)] = post;
    });

    const statuses = new Set(groupedPosts.map((post) => post.status));

    return {
      declaredLocales: BLOG_LOCALES.filter((locale) => declaredLocales.has(locale)),
      key,
      primaryPost: preferredPost(translations, groupedPosts[0]),
      status: statuses.size === 1 ? groupedPosts[0].status : "Смешанный",
      translations,
    };
  });
}

export function getBlogTranslationStatusLabel(post?: BlogPostRecord) {
  return post?.status ?? "Нет перевода";
}
