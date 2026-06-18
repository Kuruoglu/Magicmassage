import type { Locale } from "@/i18n/config";

export function getServicePagePath(locale: Locale, slug: string): string {
  return `/${locale}/services/${slug}`;
}

