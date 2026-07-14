import type { Locale } from "@/i18n/config";

export function getBlogPath(locale: Locale) {
  return `/${locale}/blog`;
}

export function getBlogPostPath(locale: Locale, slug: string) {
  return `${getBlogPath(locale)}/${slug}`;
}
