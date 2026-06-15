import type { Metadata } from "next";

import type { Locale } from "@/i18n/config";

const metadataByLocale: Record<Locale, { title: string; description: string }> = {
  bg: {
    title: "Масаж в Бургас",
    description: "Персонален масаж и спокойна грижа в Magic Massage Natali, Бургас.",
  },
  ru: {
    title: "Массаж в Бургасе",
    description: "Персональный массаж и бережная забота в Magic Massage Natali, Бургас.",
  },
  ua: {
    title: "Масаж у Бургасі",
    description: "Персональний масаж і дбайлива турбота в Magic Massage Natali, Бургас.",
  },
};

export function createHomeMetadata(locale: Locale): Metadata {
  const localized = metadataByLocale[locale];

  return {
    title: localized.title,
    description: localized.description,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        "bg-BG": "/bg",
        ru: "/ru",
        "uk-UA": "/ua",
        "x-default": "/bg",
      },
    },
    openGraph: {
      title: `${localized.title} | Magic Massage Natali`,
      description: localized.description,
      type: "website",
      locale: locale === "ua" ? "uk_UA" : locale === "bg" ? "bg_BG" : "ru_RU",
      images: ["/media/hero/hero-massage-session.jpg"],
    },
  };
}
