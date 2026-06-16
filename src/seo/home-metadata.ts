import type { Locale } from "@/i18n/config";
import { createPublicPageMetadata } from "./public-page-metadata";

export function createHomeMetadata(locale: Locale) {
  return createPublicPageMetadata(locale, "home");
}
