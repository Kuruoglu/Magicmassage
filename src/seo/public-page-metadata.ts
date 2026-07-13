import type { Metadata } from "next";

import { businessFacts } from "@/config/business";
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
    giftCertificates: {
      title: "Подаръчни сертификати за масаж",
      description:
        "Подаръчни сертификати за масаж в Magic Massage Natali: конкретни масажи, няколко сеанса или свободна сума в EUR.",
    },
    about: {
      title: "За Magic Massage Natali",
      description: "Научете повече за Натали, студиото и индивидуалния подход към всеки сеанс.",
    },
    contacts: {
      title: "Контакти и записване",
      description: "Адрес, телефон и информация за записване в Magic Massage Natali в Бургас.",
    },
    privacy: {
      title: "Политика за поверителност",
      description: "Как Magic Massage Natali обработва данни, плащания и външни услуги.",
    },
    cookies: {
      title: "Политика за cookies",
      description: "Необходими cookies, Google Maps consent и Stripe payment iframes.",
    },
    terms: {
      title: "Условия за използване",
      description: "Условия за сайта, Studio24 записване и подаръчни сертификати.",
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
    giftCertificates: {
      title: "Подарочные сертификаты на массаж",
      description:
        "Подарочные сертификаты Magic Massage Natali: конкретные массажи, несколько сеансов или свободная сумма в EUR.",
    },
    about: {
      title: "О Magic Massage Natali",
      description: "Подробнее о Натали, салоне и индивидуальном подходе к каждому сеансу.",
    },
    contacts: {
      title: "Контакты и запись",
      description: "Адрес, телефон и информация для записи в Magic Massage Natali в Бургасе.",
    },
    privacy: {
      title: "Политика конфиденциальности",
      description: "Как Magic Massage Natali обрабатывает данные, платежи и внешние сервисы.",
    },
    cookies: {
      title: "Политика cookies",
      description: "Необходимые cookies, согласие для Google Maps и платежные iframe Stripe.",
    },
    terms: {
      title: "Условия использования",
      description: "Условия сайта, записи через Studio24 и подарочных сертификатов.",
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
    giftCertificates: {
      title: "Подарункові сертифікати на масаж",
      description:
        "Подарункові сертифікати Magic Massage Natali: конкретні масажі, кілька сеансів або вільна сума в EUR.",
    },
    about: {
      title: "Про Magic Massage Natali",
      description: "Дізнайтеся більше про Наталі, салон та індивідуальний підхід до кожного сеансу.",
    },
    contacts: {
      title: "Контакти та запис",
      description: "Адреса, телефон та інформація для запису в Magic Massage Natali у Бургасі.",
    },
    privacy: {
      title: "Політика конфіденційності",
      description: "Як Magic Massage Natali обробляє дані, платежі та зовнішні сервіси.",
    },
    cookies: {
      title: "Політика cookies",
      description: "Необхідні cookies, згода для Google Maps і платіжні iframe Stripe.",
    },
    terms: {
      title: "Умови використання",
      description: "Умови сайту, запису через Studio24 і подарункових сертифікатів.",
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
    giftCertificates: {
      title: "Massage gift certificates",
      description:
        "Gift certificates for Magic Massage Natali: specific massages, multiple sessions or a free EUR amount.",
    },
    about: {
      title: "About Magic Massage Natali",
      description: "Learn more about Natali, the studio and the individual approach to every massage session.",
    },
    contacts: {
      title: "Contacts and booking",
      description: "Address, phone and booking information for Magic Massage Natali in Burgas.",
    },
    privacy: {
      title: "Privacy policy",
      description: "How Magic Massage Natali handles data, payments and third-party services.",
    },
    cookies: {
      title: "Cookie policy",
      description: "Required cookies, Google Maps consent and Stripe payment iframes.",
    },
    terms: {
      title: "Terms of use",
      description: "Terms for the website, Studio24 booking handoff and gift certificates.",
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
      title: `${localized.title} | ${businessFacts.name}`,
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
