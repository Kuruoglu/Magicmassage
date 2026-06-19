export const locales = ["bg", "ru", "ua", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "bg";

export function isSupportedLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

const htmlLanguages: Record<Locale, string> = {
  bg: "bg-BG",
  ru: "ru",
  ua: "uk-UA",
  en: "en",
};

export function getHtmlLanguage(locale: Locale): string {
  return htmlLanguages[locale];
}
