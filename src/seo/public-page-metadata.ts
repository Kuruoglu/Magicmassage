import type { Metadata } from "next";

import type { Locale } from "@/i18n/config";
import {
  getPublicPagePath,
  publicPageKeys,
  type PublicPageKey,
} from "@/navigation/public-routes";

const metadataByLocale: Record<
  Locale,
  Record<PublicPageKey, { title: string; description: string }>
> = {
  bg: {
    home: {
      title: "Масаж в Бургас",
      description: "Персонален масаж и спокойна грижа в Magic Massage Natali, Бургас.",
    },
    services: {
      title: "Видове масаж в Бургас",
      description: "Класически, релаксиращ, дълбокотъканен и други масажи в Magic Massage Natali.",
    },
    about: {
      title: "За Magic Massage Natali",
      description: "Научете повече за Натали, студиото и индивидуалния подход към всеки сеанс.",
    },
    contacts: {
      title: "Контакти и записване",
      description: "Адрес, телефон и информация за записване в Magic Massage Natali в Бургас.",
    },
  },
  ru: {
    home: {
      title: "Массаж в Бургасе",
      description: "Персональный массаж и бережная забота в Magic Massage Natali, Бургас.",
    },
    services: {
      title: "Виды массажа в Бургасе",
      description: "Классический, расслабляющий, глубокий массаж тканей и другие процедуры.",
    },
    about: {
      title: "О Magic Massage Natali",
      description: "Подробнее о Натали, салоне и индивидуальном подходе к каждому сеансу.",
    },
    contacts: {
      title: "Контакты и запись",
      description: "Адрес, телефон и информация для записи в Magic Massage Natali в Бургасе.",
    },
  },
  ua: {
    home: {
      title: "Масаж у Бургасі",
      description: "Персональний масаж і дбайлива турбота в Magic Massage Natali, Бургас.",
    },
    services: {
      title: "Види масажу в Бургасі",
      description: "Класичний, розслаблювальний, глибокий масаж тканин та інші процедури.",
    },
    about: {
      title: "Про Magic Massage Natali",
      description: "Дізнайтеся більше про Наталі, салон та індивідуальний підхід до кожного сеансу.",
    },
    contacts: {
      title: "Контакти та запис",
      description: "Адреса, телефон та інформація для запису в Magic Massage Natali у Бургасі.",
    },
  },
};

const languageAlternates = {
  bg: "bg-BG",
  ru: "ru",
  ua: "uk-UA",
} as const;

export function createPublicPageMetadata(
  locale: Locale,
  page: PublicPageKey,
): Metadata {
  const localized = metadataByLocale[locale][page];
  const languages = Object.fromEntries(
    (Object.entries(languageAlternates) as Array<[Locale, string]>).map(
      ([item, language]) => [language, getPublicPagePath(item, page)],
    ),
  );

  return {
    title: localized.title,
    description: localized.description,
    alternates: {
      canonical: getPublicPagePath(locale, page),
      languages: {
        ...languages,
        "x-default": getPublicPagePath("bg", page),
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

export function getPublicSitemapPages(): PublicPageKey[] {
  return [...publicPageKeys];
}
