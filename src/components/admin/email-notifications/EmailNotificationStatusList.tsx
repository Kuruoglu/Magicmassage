"use client";

import { useCallback, useEffect, useState } from "react";

import { isValidEmail } from "@/components/admin/lib/filters";
import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";

export type EmailNotificationStatus = {
  canClearSuppression?: boolean;
  canRetry: boolean;
  eventType: string;
  id: string;
  recipientMasked: string;
  status: string;
  updatedAt: string;
};

const statusLabels: Record<string, string> = {
  bounced: "Заблокировано",
  blocked: "Заблокировано",
  cancelled: "Отменено",
  complained: "Заблокировано",
  dead_letter: "Ошибка",
  delivered: "Доставлено",
  delivery_delayed: "Ошибка доставки",
  failed: "Ошибка",
  leased: "Отправляется",
  pending: "Ожидает",
  processing: "Отправляется",
  queued: "Ожидает",
  retry_scheduled: "Ожидает",
  sent: "Отправлено",
  suppressed: "Заблокировано",
};

const eventLabels: Record<string, string> = {
  booking_cancelled: "Отмена записи",
  booking_care: "Письмо после визита",
  booking_confirmed: "Подтверждение записи",
  appointment_cancelled: "Отмена записи",
  appointment_care: "Письмо после визита",
  appointment_confirmation: "Подтверждение записи",
  appointment_reminder: "Напоминание о записи",
  appointment_rescheduled: "Перенос записи",
  booking_confirmation: "Подтверждение записи",
  booking_reminder_24h: "Напоминание о записи",
  booking_reminder: "Напоминание о записи",
  booking_rescheduled: "Перенос записи",
  care_follow_up: "Письмо после визита",
  gift_buyer: "Сертификат покупателю",
  gift_owner: "Покупка сертификата",
  gift_recipient: "Сертификат получателю",
  owner_gift_purchase: "Покупка сертификата",
  owner_new_public_booking: "Новая онлайн-запись",
  owner_booking_notification: "Новая онлайн-запись",
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : value;
}

export function EmailNotificationStatusList({
  aggregateId,
  aggregateType,
  allowRecipientCorrection = false,
  onRecipientCorrected,
  recipientEmail = "",
}: {
  aggregateId: string;
  aggregateType: "appointment" | "certificate";
  allowRecipientCorrection?: boolean;
  onRecipientCorrected?: (email: string) => void;
  recipientEmail?: string;
}) {
  const [notifications, setNotifications] = useState<EmailNotificationStatus[]>([]);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">("loading");
  const [clearingId, setClearingId] = useState<string>();
  const [correctingId, setCorrectingId] = useState<string>();
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, string>>({});
  const [correctionError, setCorrectionError] = useState<{ id: string; message: string }>();
  const [retryingId, setRetryingId] = useState<string>();
  const [notice, setNotice] = useState("");

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const authorization = await getAdminAuthorizationHeader();
      setLoadState("loading");
      setNotifications([]);
      setCorrectionError(undefined);
      setNotice("");
      const search = new URLSearchParams({ aggregateId, aggregateType });
      const response = await fetch(`/api/admin/email-notifications?${search}`, {
        headers: authorization ? { Authorization: authorization } : undefined,
        signal,
      });
      const result = (await response.json().catch(() => null)) as { notifications?: EmailNotificationStatus[] } | null;
      if (!response.ok || !Array.isArray(result?.notifications)) throw new Error("email_status_unavailable");
      setNotifications(result.notifications);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotifications([]);
      setLoadState("error");
    }
  }, [aggregateId, aggregateType]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadNotifications(controller.signal));
    return () => controller.abort();
  }, [loadNotifications]);

  async function retryNotification(notificationId: string) {
    setRetryingId(notificationId);
    setNotice("");

    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/email-notifications/retry", {
        body: JSON.stringify({ notificationId }),
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !result?.ok) throw new Error("email_retry_failed");
      await loadNotifications();
      setNotice("Письмо снова поставлено в очередь.");
    } catch {
      setNotice("Не удалось повторить отправку. Обновите статусы и попробуйте ещё раз.");
    } finally {
      setRetryingId(undefined);
    }
  }

  async function correctRecipientAndRetry(notificationId: string) {
    const correctedEmail = (correctionDrafts[notificationId] ?? "").trim().toLowerCase();
    const currentEmail = recipientEmail.trim().toLowerCase();
    if (!isValidEmail(correctedEmail) || correctedEmail.length > 254) {
      setCorrectionError({ id: notificationId, message: "Укажите корректный email, например client@example.com." });
      queueMicrotask(() => document.getElementById(`email-correction-${notificationId}`)?.focus());
      return;
    }
    if (correctedEmail === currentEmail) {
      setCorrectionError({ id: notificationId, message: "Укажите новый email, отличный от адреса в online-записи." });
      queueMicrotask(() => document.getElementById(`email-correction-${notificationId}`)?.focus());
      return;
    }

    setCorrectingId(notificationId);
    setCorrectionError(undefined);
    setNotice("");
    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/email-notifications/retry", {
        body: JSON.stringify({ correctedEmail, notificationId }),
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !result?.ok) throw new Error("email_correction_failed");
      onRecipientCorrected?.(correctedEmail);
      setCorrectionDrafts((current) => ({ ...current, [notificationId]: "" }));
      await loadNotifications();
      setNotice("Адрес online-записи обновлён, письмо снова поставлено в очередь.");
    } catch {
      setCorrectionError({
        id: notificationId,
        message: "Не удалось обновить email и повторить отправку. Проверьте адрес и попробуйте ещё раз.",
      });
    } finally {
      setCorrectingId(undefined);
    }
  }

  async function clearSuppression(notificationId: string) {
    setClearingId(notificationId);
    setNotice("");

    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/email-notifications/clear-suppression", {
        body: JSON.stringify({ notificationId }),
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !result?.ok) throw new Error("email_suppression_clear_failed");
      await loadNotifications();
      setNotice("Блокировка снята. Теперь письмо можно снова поставить в очередь.");
    } catch {
      setNotice("Не удалось снять блокировку. Обновите статусы и попробуйте ещё раз.");
    } finally {
      setClearingId(undefined);
    }
  }

  return (
    <div className="admin-email-notifications" aria-live="polite">
      {loadState === "loading" ? <p className="admin-muted-text">Загружаем статусы писем…</p> : null}
      {loadState === "error" ? (
        <div className="admin-email-status-error" role="alert">
          <p>Не удалось загрузить статусы писем.</p>
          <button className="admin-outline-action" onClick={() => void loadNotifications()} type="button">Повторить</button>
        </div>
      ) : null}
      {loadState === "ready" && notifications.length === 0 ? (
        <p className="admin-muted-text">По этому объекту письма ещё не создавались.</p>
      ) : null}
      {notifications.length > 0 ? (
        <ul className="admin-email-status-list">
          {notifications.map((notification) => {
            const canCorrectRecipient = aggregateType === "appointment"
              && allowRecipientCorrection
              && notification.eventType !== "owner_new_public_booking"
              && (notification.status === "failed" || notification.status === "suppressed");
            const helperId = `email-correction-helper-${notification.id}`;
            const errorId = `email-correction-error-${notification.id}`;
            const inputId = `email-correction-${notification.id}`;

            return (
              <li key={notification.id}>
                <div>
                  <strong>{eventLabels[notification.eventType] ?? notification.eventType}</strong>
                  <span>{notification.recipientMasked || "Получатель скрыт"}</span>
                  <small>{formatUpdatedAt(notification.updatedAt)}</small>
                </div>
                <div className="admin-email-status-actions">
                  <span className="admin-email-status" data-status={notification.status}>
                    {statusLabels[notification.status] ?? notification.status}
                  </span>
                  {notification.canClearSuppression ? (
                    <button
                      className="admin-outline-action"
                      disabled={clearingId === notification.id}
                      onClick={() => void clearSuppression(notification.id)}
                      type="button"
                    >
                      {clearingId === notification.id ? "Снимаем…" : "Снять блокировку"}
                    </button>
                  ) : null}
                  {notification.canRetry ? (
                    <button
                      className="admin-outline-action"
                      disabled={retryingId === notification.id}
                      onClick={() => void retryNotification(notification.id)}
                      type="button"
                    >
                      {retryingId === notification.id ? "Повторяем…" : "Повторить отправку"}
                    </button>
                  ) : null}
                </div>
                {canCorrectRecipient ? (
                  <form
                    aria-label={`Исправление email: ${eventLabels[notification.eventType] ?? notification.eventType}`}
                    className="admin-email-recipient-correction"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      void correctRecipientAndRetry(notification.id);
                    }}
                  >
                    <label htmlFor={inputId}>Новый email для online-записи</label>
                    <input
                      aria-describedby={`${helperId}${correctionError?.id === notification.id ? ` ${errorId}` : ""}`}
                      aria-invalid={correctionError?.id === notification.id ? "true" : undefined}
                      autoComplete="email"
                      id={inputId}
                      inputMode="email"
                      onChange={(event) => {
                        setCorrectionDrafts((current) => ({ ...current, [notification.id]: event.target.value }));
                        if (correctionError?.id === notification.id) setCorrectionError(undefined);
                      }}
                      type="email"
                      value={correctionDrafts[notification.id] ?? ""}
                    />
                    <p className="admin-form-helper" id={helperId}>
                      Адрес обновится только в снимке этой online-записи; email в карточке клиента не изменится.
                    </p>
                    {correctionError?.id === notification.id ? (
                      <p className="admin-form-alert" id={errorId} role="alert">{correctionError.message}</p>
                    ) : null}
                    <button className="admin-primary-button" disabled={correctingId === notification.id} type="submit">
                      {correctingId === notification.id ? "Сохраняем и ставим в очередь…" : "Сохранить адрес и отправить снова"}
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {notice ? <p className="admin-export-notice" role={notice.startsWith("Не удалось") ? "alert" : "status"}>{notice}</p> : null}
    </div>
  );
}
