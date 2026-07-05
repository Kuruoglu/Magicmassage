"use client";

import { useCallback, useEffect, useState } from "react";

import type { Locale } from "@/i18n/config";

const cookieConsentStorageKey = "magic-massage-cookie-consent";
const cookieConsentEvent = "magic-massage-cookie-consent-change";

const cookieConsentCopy: Record<
  Locale,
  { message: string; action: string }
> = {
  bg: {
    message:
      "Използваме необходими бисквитки. Stripe обработва плащанията чрез защитени iframe елементи, а Google Maps се зарежда само след Вашето съгласие.",
    action: "Приемам cookies",
  },
  ru: {
    message:
      "Мы используем необходимые cookies. Stripe обрабатывает оплату через защищенные iframe-элементы, а Google Maps загружается только после вашего согласия.",
    action: "Принимаю cookies",
  },
  ua: {
    message:
      "Ми використовуємо необхідні cookies. Stripe обробляє оплату через захищені iframe-елементи, а Google Maps завантажується лише після вашої згоди.",
    action: "Приймаю cookies",
  },
  en: {
    message:
      "We use necessary cookies. Stripe processes payments through secure iframe elements, and Google Maps loads only after your consent.",
    action: "Accept cookies",
  },
};

function readCookieConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(cookieConsentStorageKey) === "accepted";
  } catch {
    return false;
  }
}

function storeCookieConsent() {
  try {
    window.localStorage.setItem(cookieConsentStorageKey, "accepted");
  } catch {
    // Storage can be blocked; event detail still unlocks mounted consent-aware UI.
  }

  window.dispatchEvent(
    new CustomEvent(cookieConsentEvent, { detail: { hasConsent: true } }),
  );
}

export function useCookieConsent(): [boolean, () => void] {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const updateConsent = (event?: Event) => {
      const consentDetail =
        event instanceof CustomEvent
          ? (event.detail as { hasConsent?: boolean } | undefined)
          : undefined;

      if (typeof consentDetail?.hasConsent === "boolean") {
        setHasConsent(consentDetail.hasConsent);
        return;
      }

      setHasConsent(readCookieConsent());
    };

    updateConsent();
    window.addEventListener(cookieConsentEvent, updateConsent);

    return () => window.removeEventListener(cookieConsentEvent, updateConsent);
  }, []);

  const acceptConsent = useCallback(() => {
    setHasConsent(true);
    storeCookieConsent();
  }, []);

  return [hasConsent, acceptConsent];
}

export function CookieConsentBanner({ locale }: { locale: Locale }) {
  const [hasConsent, acceptConsent] = useCookieConsent();
  const copy = cookieConsentCopy[locale];

  if (hasConsent) return null;

  return (
    <section className="cookie-consent" aria-label="Cookie consent">
      <p>{copy.message}</p>
      <button type="button" className="button button-small" onClick={acceptConsent}>
        {copy.action}
      </button>
    </section>
  );
}

export function getCookieConsentActionLabel(locale: Locale): string {
  return cookieConsentCopy[locale].action;
}
