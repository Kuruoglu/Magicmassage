import type { Locale } from "@/i18n/config";

export const publicPageKeys = ["home", "services", "about", "contacts"] as const;

export type PublicPageKey = (typeof publicPageKeys)[number];

const pageSegments: Record<PublicPageKey, string> = {
  home: "",
  services: "services",
  about: "about",
  contacts: "contacts",
};

export function getPublicPagePath(locale: Locale, page: PublicPageKey): string {
  const segment = pageSegments[page];
  return segment ? `/${locale}/${segment}` : `/${locale}`;
}

export function getLocaleSwitchPath(locale: Locale, page: PublicPageKey): string {
  return getPublicPagePath(locale, page);
}
