"use client";

import type { Locale } from "@/i18n/config";
import { getCookieConsentActionLabel, useCookieConsent } from "./cookie-consent";

const mapConsentCopy: Record<Locale, { title: string; description: string }> = {
  bg: {
    title: "Google Maps изисква съгласие",
    description:
      "Картата се зарежда от Google и може да използва cookies. Приемете cookies, за да видите интерактивната карта.",
  },
  ru: {
    title: "Google Maps требует согласия",
    description:
      "Карта загружается с Google и может использовать cookies. Примите cookies, чтобы увидеть интерактивную карту.",
  },
  ua: {
    title: "Google Maps потребує згоди",
    description:
      "Карта завантажується з Google і може використовувати cookies. Прийміть cookies, щоб побачити інтерактивну карту.",
  },
  en: {
    title: "Google Maps requires consent",
    description:
      "The map is loaded from Google and may use cookies. Accept cookies to view the interactive map.",
  },
};

type ConsentGatedMapProps = {
  locale: Locale;
  title: string;
  src: string;
};

export function ConsentGatedMap({ locale, title, src }: ConsentGatedMapProps) {
  const [hasConsent, acceptConsent] = useCookieConsent();
  const copy = mapConsentCopy[locale];

  if (hasConsent) {
    return (
      <iframe
        title={title}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    );
  }

  return (
    <div className="map-consent-placeholder" role="group" aria-label={title}>
      <strong>{copy.title}</strong>
      <p>{copy.description}</p>
      <button type="button" className="button button-small" onClick={acceptConsent}>
        {getCookieConsentActionLabel(locale)}
      </button>
    </div>
  );
}
