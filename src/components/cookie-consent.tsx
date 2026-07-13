"use client";

import { useCallback, useEffect, useState } from "react";

import type { Locale } from "@/i18n/config";

const cookieConsentStorageKey = "magic-massage-cookie-consent";
const cookieConsentEvent = "magic-massage-cookie-consent-change";
type CookieConsentChoice = "unknown" | "accepted" | "rejected";

const cookieConsentCopy: Record<
  Locale,
  {
    message: string;
    acceptAll: string;
    rejectNonEssential: string;
    manage: string;
    savePreferences: string;
    changePreferences: string;
    mapsLabel: string;
  }
> = {
  bg: {
    message:
      "Използваме необходими бисквитки. Stripe обработва плащанията чрез защитени iframe елементи, а Google Maps се зарежда само след Вашето съгласие.",
    acceptAll: "Приемам всички",
    rejectNonEssential: "Отказвам незадължителните",
    manage: "Настройки",
    savePreferences: "Запази избора",
    changePreferences: "Промени cookies",
    mapsLabel: "Google Maps",
  },
  ru: {
    message:
      "Мы используем необходимые cookies. Stripe обрабатывает оплату через защищенные iframe-элементы, а Google Maps загружается только после вашего согласия.",
    acceptAll: "Принять все",
    rejectNonEssential: "Отклонить необязательные",
    manage: "Настроить",
    savePreferences: "Сохранить выбор",
    changePreferences: "Изменить cookies",
    mapsLabel: "Google Maps",
  },
  ua: {
    message:
      "Ми використовуємо необхідні cookies. Stripe обробляє оплату через захищені iframe-елементи, а Google Maps завантажується лише після вашої згоди.",
    acceptAll: "Прийняти всі",
    rejectNonEssential: "Відхилити необов'язкові",
    manage: "Налаштувати",
    savePreferences: "Зберегти вибір",
    changePreferences: "Змінити cookies",
    mapsLabel: "Google Maps",
  },
  en: {
    message:
      "We use necessary cookies. Stripe processes payments through secure iframe elements, and Google Maps loads only after your consent.",
    acceptAll: "Accept all",
    rejectNonEssential: "Reject non-essential",
    manage: "Manage preferences",
    savePreferences: "Save preferences",
    changePreferences: "Change cookie preferences",
    mapsLabel: "Google Maps",
  },
};

function readCookieConsentChoice(): CookieConsentChoice {
  if (typeof window === "undefined") return "unknown";

  try {
    const stored = window.localStorage.getItem(cookieConsentStorageKey);

    if (stored === "accepted" || stored === "rejected") {
      return stored;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function storeCookieConsent(choice: Exclude<CookieConsentChoice, "unknown">) {
  try {
    window.localStorage.setItem(cookieConsentStorageKey, choice);
  } catch {
    // Storage can be blocked; event detail still unlocks mounted consent-aware UI.
  }

  window.dispatchEvent(
    new CustomEvent(cookieConsentEvent, {
      detail: { choice, hasConsent: choice === "accepted" },
    }),
  );
}

function clearCookieConsent() {
  try {
    window.localStorage.removeItem(cookieConsentStorageKey);
  } catch {
    // Storage can be blocked; event detail still updates mounted UI.
  }

  window.dispatchEvent(
    new CustomEvent(cookieConsentEvent, {
      detail: { choice: "unknown", hasConsent: false },
    }),
  );
}

export function useCookieConsent(): [boolean, () => void] {
  const { acceptAll, hasConsent } = useCookieConsentControls();

  return [hasConsent, acceptAll];
}

function useCookieConsentControls() {
  const [choice, setChoice] = useState<CookieConsentChoice>("unknown");
  const hasConsent = choice === "accepted";

  useEffect(() => {
    const updateConsent = (event?: Event) => {
      const consentDetail =
        event instanceof CustomEvent
          ? (event.detail as { choice?: CookieConsentChoice; hasConsent?: boolean } | undefined)
          : undefined;

      if (consentDetail?.choice) {
        setChoice(consentDetail.choice);
        return;
      }

      if (typeof consentDetail?.hasConsent === "boolean") {
        setChoice(consentDetail.hasConsent ? "accepted" : "rejected");
        return;
      }

      setChoice(readCookieConsentChoice());
    };

    updateConsent();
    window.addEventListener(cookieConsentEvent, updateConsent);

    return () => window.removeEventListener(cookieConsentEvent, updateConsent);
  }, []);

  const acceptConsent = useCallback(() => {
    setChoice("accepted");
    storeCookieConsent("accepted");
  }, []);

  const rejectConsent = useCallback(() => {
    setChoice("rejected");
    storeCookieConsent("rejected");
  }, []);

  const resetConsent = useCallback(() => {
    setChoice("unknown");
    clearCookieConsent();
  }, []);

  return {
    acceptAll: acceptConsent,
    choice,
    hasConsent,
    rejectNonEssential: rejectConsent,
    resetConsent,
  };
}

export function CookieConsentBanner({ locale }: { locale: Locale }) {
  const { acceptAll, choice, rejectNonEssential, resetConsent } =
    useCookieConsentControls();
  const [isManaging, setIsManaging] = useState(false);
  const [mapsEnabled, setMapsEnabled] = useState(true);
  const copy = cookieConsentCopy[locale];

  if (choice !== "unknown") {
    return (
      <button
        type="button"
        className="cookie-consent-change"
        onClick={() => {
          setIsManaging(true);
          resetConsent();
        }}
      >
        {copy.changePreferences}
      </button>
    );
  }

  const saveManagedChoice = () => {
    if (mapsEnabled) {
      acceptAll();
    } else {
      rejectNonEssential();
    }
  };

  return (
    <section className="cookie-consent" aria-label="Cookie consent">
      <p>{copy.message}</p>
      {isManaging ? (
        <div className="cookie-consent-preferences">
          <label>
            <input
              type="checkbox"
              checked={mapsEnabled}
              onChange={(event) => setMapsEnabled(event.target.checked)}
            />
            <span>{copy.mapsLabel}</span>
          </label>
          <button type="button" className="button button-small" onClick={saveManagedChoice}>
            {copy.savePreferences}
          </button>
        </div>
      ) : null}
      <div className="cookie-consent-actions">
        <button type="button" className="button button-small" onClick={acceptAll}>
          {copy.acceptAll}
        </button>
        <button type="button" className="button button-small button-light" onClick={rejectNonEssential}>
          {copy.rejectNonEssential}
        </button>
        <button type="button" className="button button-small button-light" onClick={() => setIsManaging(true)}>
          {copy.manage}
        </button>
      </div>
    </section>
  );
}

export function getCookieConsentActionLabel(locale: Locale): string {
  return cookieConsentCopy[locale].acceptAll;
}
