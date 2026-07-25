"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/i18n/config";

import styles from "./EmailPreferences.module.css";

const copy: Record<Locale, {
  action: string;
  description: string;
  error: string;
  home: string;
  invalid: string;
  pending: string;
  success: string;
  successTitle: string;
  title: string;
}> = {
  bg: {
    action: "Спиране на имейлите след посещение",
    description: "Потвърдете, че не желаете да получавате имейли след посещение с покана за отзив или ново записване. Потвържденията и важните съобщения за Вашите записвания ще останат активни.",
    error: "Не успяхме да запазим избора Ви. Линкът може да е изтекъл — използвайте най-новия имейл или опитайте отново.",
    home: "Към началната страница",
    invalid: "Този линк е невалиден или непълен. Отворете целия линк от най-новия имейл.",
    pending: "Запазваме…",
    success: "Няма да получавате имейли след посещение. Потвържденията и важните съобщения за записванията не се променят.",
    successTitle: "Предпочитанието е запазено",
    title: "Настройки за имейли",
  },
  ru: {
    action: "Отключить письма после визита",
    description: "Подтвердите, что не хотите получать письма после визита с приглашением оставить отзыв или записаться снова. Подтверждения и важные сообщения о ваших записях останутся включены.",
    error: "Не удалось сохранить выбор. Возможно, ссылка устарела — откройте последнее письмо или попробуйте ещё раз.",
    home: "На главную",
    invalid: "Ссылка недействительна или неполная. Откройте полную ссылку из последнего письма.",
    pending: "Сохраняем…",
    success: "Письма после визита отключены. Подтверждения и важные сообщения о записях не изменились.",
    successTitle: "Настройка сохранена",
    title: "Настройки email",
  },
  ua: {
    action: "Вимкнути листи після візиту",
    description: "Підтвердьте, що не бажаєте отримувати листи після візиту із запрошенням залишити відгук або записатися знову. Підтвердження та важливі повідомлення про записи залишаться увімкненими.",
    error: "Не вдалося зберегти вибір. Можливо, посилання застаріло — відкрийте останній лист або спробуйте ще раз.",
    home: "На головну",
    invalid: "Посилання недійсне або неповне. Відкрийте повне посилання з останнього листа.",
    pending: "Зберігаємо…",
    success: "Листи після візиту вимкнено. Підтвердження та важливі повідомлення про записи не змінилися.",
    successTitle: "Налаштування збережено",
    title: "Налаштування email",
  },
  en: {
    action: "Stop follow-up emails",
    description: "Confirm that you no longer want follow-up emails inviting you to leave a review or book again. Confirmations and important messages about your appointments will remain enabled.",
    error: "We could not save your choice. The link may have expired — use the latest email or try again.",
    home: "Go to the home page",
    invalid: "This link is invalid or incomplete. Open the full link from the latest email.",
    pending: "Saving…",
    success: "Follow-up emails are now disabled. Confirmations and important appointment messages are unchanged.",
    successTitle: "Preference saved",
    title: "Email preferences",
  },
};

export function EmailPreferencesForm({ locale, token }: { locale: Locale; token: string }) {
  const labels = copy[locale];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<"error" | "idle" | "pending" | "success">("idle");
  const hasToken = Boolean(token);

  useEffect(() => {
    if (state === "success") headingRef.current?.focus();
  }, [state]);

  async function unsubscribe() {
    setState("pending");

    try {
      const response = await fetch("/api/public/email-preferences/unsubscribe", {
        body: JSON.stringify({ token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      setState(response.ok && result?.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="email-preferences-title">
      <span className={styles.kicker}>Magic Massage Natali</span>
      <h1 id="email-preferences-title" ref={headingRef} tabIndex={-1}>
        {state === "success" ? labels.successTitle : labels.title}
      </h1>
      <p>{state === "success" ? labels.success : labels.description}</p>

      {!hasToken ? <p className={styles.error} role="alert">{labels.invalid}</p> : null}
      {state === "error" ? <p className={styles.error} role="alert">{labels.error}</p> : null}

      <div className={styles.actions} aria-live="polite">
        {state === "success" ? (
          <Link href={`/${locale}`}>{labels.home}</Link>
        ) : (
          <button disabled={!hasToken || state === "pending"} onClick={() => void unsubscribe()} type="button">
            {state === "pending" ? labels.pending : labels.action}
          </button>
        )}
      </div>
    </section>
  );
}
