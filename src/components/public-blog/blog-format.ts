import type { Locale } from "@/i18n/config";
import { getBlogCopy } from "./blog-copy";

export function formatBlogDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(getBlogCopy(locale).dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Sofia",
  }).format(new Date(value));
}
