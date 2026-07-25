"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EmailLocale, TransactionalEmailEvent } from "@/email/types";
import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";

type EmailTemplatePreviewValue = {
  html: string;
  subject: string;
  templateVersion: number;
  text: string;
};

const eventOptions: Array<{ label: string; value: TransactionalEmailEvent }> = [
  { label: "Подтверждение записи", value: "booking_confirmed" },
  { label: "Перенос записи", value: "booking_rescheduled" },
  { label: "Отмена записи", value: "booking_cancelled" },
  { label: "Напоминание за 24 часа", value: "booking_reminder_24h" },
  { label: "Письмо после визита", value: "booking_care" },
  { label: "Новая online-запись для Натали", value: "owner_new_public_booking" },
  { label: "Сертификат покупателю", value: "gift_buyer" },
  { label: "Сертификат получателю", value: "gift_recipient" },
  { label: "Покупка сертификата для Натали", value: "owner_gift_purchase" },
];

const localeOptions: Array<{ label: string; value: EmailLocale }> = [
  { label: "Български", value: "bg" },
  { label: "Русский", value: "ru" },
  { label: "Українська", value: "ua" },
  { label: "English", value: "en" },
];

export function EmailTemplatePreview() {
  const [eventType, setEventType] = useState<TransactionalEmailEvent>("booking_confirmed");
  const [locale, setLocale] = useState<EmailLocale>("ru");
  const [preview, setPreview] = useState<EmailTemplatePreviewValue>();
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready" | "unavailable">("loading");
  const requestSequenceRef = useRef(0);

  const loadPreview = useCallback(async (signal?: AbortSignal) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoadState("loading");
    setPreview(undefined);

    try {
      const authorization = await getAdminAuthorizationHeader();
      if (requestSequence !== requestSequenceRef.current) return;
      if (!authorization) {
        setLoadState("unavailable");
        return;
      }
      const search = new URLSearchParams({ eventType, locale });
      const response = await fetch(`/api/admin/email-template-preview?${search}`, {
        headers: { Authorization: authorization },
        signal,
      });
      const result = (await response.json().catch(() => null)) as {
        preview?: EmailTemplatePreviewValue;
      } | null;
      if (
        !response.ok
        || typeof result?.preview?.html !== "string"
        || typeof result.preview.subject !== "string"
        || typeof result.preview.text !== "string"
        || typeof result.preview.templateVersion !== "number"
      ) {
        throw new Error("email_template_preview_unavailable");
      }
      if (requestSequence !== requestSequenceRef.current) return;
      setPreview(result.preview);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestSequence !== requestSequenceRef.current) return;
      setPreview(undefined);
      setLoadState("error");
    }
  }, [eventType, locale]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadPreview(controller.signal));
    return () => controller.abort();
  }, [loadPreview]);

  return (
    <section
      aria-busy={loadState === "loading"}
      aria-labelledby="admin-email-template-preview-title"
      className="admin-email-template-preview admin-form-wide"
    >
      <div className="admin-email-template-preview-head">
        <div>
          <span>Предпросмотр шаблона</span>
          <strong id="admin-email-template-preview-title">Реальный subject, text и HTML</strong>
        </div>
        {preview ? <small>Версия {preview.templateVersion}</small> : null}
      </div>
      <p className="admin-form-helper">
        Данные примера не содержат контактов клиентов. Предпросмотр создаётся тем же renderer’ом, что и отправка.
      </p>
      <div className="admin-email-template-preview-controls">
        <label>
          Тип письма
          <select
            onChange={(event) => setEventType(event.target.value as TransactionalEmailEvent)}
            value={eventType}
          >
            {eventOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Язык письма
          <select onChange={(event) => setLocale(event.target.value as EmailLocale)} value={locale}>
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div aria-live="polite">
        {loadState === "loading" ? <p className="admin-muted-text">Создаём предпросмотр…</p> : null}
        {loadState === "unavailable" ? (
          <p className="admin-muted-text">Предпросмотр доступен после входа в защищённую admin-сессию.</p>
        ) : null}
        {loadState === "error" ? (
          <div className="admin-email-status-error" role="alert">
            <p>Не удалось загрузить предпросмотр. Проверьте admin-сессию.</p>
            <button className="admin-outline-action" onClick={() => void loadPreview()} type="button">
              Повторить
            </button>
          </div>
        ) : null}
      </div>
      {preview ? (
        <div className="admin-email-template-preview-body">
          <div className="admin-email-template-preview-subject">
            <span>Тема</span>
            <p>{preview.subject}</p>
          </div>
          <div>
            <span>HTML</span>
            <iframe
              referrerPolicy="no-referrer"
              sandbox=""
              srcDoc={preview.html}
              title={`HTML-предпросмотр: ${eventOptions.find((option) => option.value === eventType)?.label}`}
            />
          </div>
          <div>
            <span>Текстовая версия</span>
            <pre>{preview.text}</pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}
