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
      title: "Масажен салон в Бургас",
      description:
        "Magic Massage Natali е масажно студио в Бургас за класически, релаксиращ, дълбокотъканен и антицелулитен масаж с предварително записване.",
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
      title: "Массажный салон в Бургасе",
      description:
        "Magic Massage Natali - массажный салон в Бургасе: классический, расслабляющий, глубокий и антицеллюлитный массаж по предварительной записи.",
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
      title: "Масажний салон у Бургасі",
      description:
        "Magic Massage Natali - масажний салон у Бургасі: класичний, розслаблювальний, глибокий та антицелюлітний масаж за попереднім записом.",
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
  en: {
    home: {
      title: "Massage studio in Burgas",
      description:
        "Magic Massage Natali is a massage studio in Burgas for classic, relaxing, deep tissue and anti-cellulite massage by appointment.",
    },
    services: {
      title: "Massage types in Burgas",
      description: "Classic, relaxing, deep tissue massage and other treatments at Magic Massage Natali.",
    },
    about: {
      title: "About Magic Massage Natali",
      description: "Learn more about Natali, the studio and the individual approach to every massage session.",
    },
    contacts: {
      title: "Contacts and booking",
      description: "Address, phone and booking information for Magic Massage Natali in Burgas.",
    },
  },
};

const languageAlternates = {
  bg: "bg-BG",
  ru: "ru",
  ua: "uk-UA",
  en: "en",
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
      locale: locale === "ua" ? "uk_UA" : locale === "bg" ? "bg_BG" : locale === "en" ? "en" : "ru_RU",
      images: ["/media/hero/hero-massage-session.jpg"],
    },
  };
}

export function getPublicSitemapPages(): PublicPageKey[] {
  return [...publicPageKeys];
}
