"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { Appointment } from "@/admin/domain";
import { statusClass } from "@/components/admin/lib/formatters";

import { formatCalendarDay } from "./format";
import type { CalendarAppointmentSaveResult } from "./CalendarWorkspace";

export type CalendarAppointmentCancelDialogProps = {
  appointment: Appointment;
  clientEmail?: string;
  onClose: () => void;
  onConfirm: (
    appointment: Appointment,
    options: { notifyClient: boolean },
  ) => Promise<CalendarAppointmentSaveResult>;
};

export function CalendarAppointmentCancelDialog({
  appointment,
  clientEmail = "",
  onClose,
  onConfirm,
}: CalendarAppointmentCancelDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const canNotifyClient = Boolean(clientEmail.trim());

  useEffect(() => {
    const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();

    const backgroundDialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
    )
      .filter((dialog) => dialog !== dialogRef.current)
      .map((dialog) => ({
        ariaHidden: dialog.getAttribute("aria-hidden"),
        dialog,
        hadInert: dialog.hasAttribute("inert"),
      }));

    backgroundDialogs.forEach(({ dialog }) => {
      dialog.setAttribute("aria-hidden", "true");
      dialog.setAttribute("inert", "");
    });

    return () => {
      backgroundDialogs.forEach(({ ariaHidden, dialog, hadInert }) => {
        if (ariaHidden === null) dialog.removeAttribute("aria-hidden");
        else dialog.setAttribute("aria-hidden", ariaHidden);
        if (!hadInert) dialog.removeAttribute("inert");
      });
      if (restoreFocus?.isConnected) restoreFocus.focus();
    };
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !isPending) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!activeElement || !controls.includes(activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function confirmCancellation() {
    if (isPending) return;

    setIsPending(true);
    setError("");
    try {
      const result = await onConfirm(appointment, { notifyClient: canNotifyClient && notifyClient });
      if (result.ok) onClose();
      else setError(result.message);
    } catch (confirmationError) {
      setError(confirmationError instanceof Error ? confirmationError.message : "Не удалось отменить запись.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="admin-action-backdrop">
      <section
        aria-labelledby="calendar-cancel-title"
        aria-modal="true"
        aria-busy={isPending}
        className="admin-action-dialog"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Календарь</span>
            <h2 id="calendar-cancel-title" ref={titleRef} tabIndex={-1}>Отменить запись</h2>
          </div>
          <button className="admin-icon-button" disabled={isPending} onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <p className="admin-confirm-copy">
          Запись клиента <strong>{appointment.client}</strong> на {formatCalendarDay(appointment.date)} в{" "}
          <strong>{appointment.time}</strong> будет отмечена как отмененная. Она исчезнет из сетки «День»,
          «Неделя» и «Месяц», но останется в разделе «Список» и в истории клиента.
        </p>
        <div className="admin-confirm-summary" aria-label="Запись для отмены">
          <span>{appointment.service}</span>
          <span className={statusClass(appointment.status)}>{appointment.status}</span>
        </div>
        <div className="admin-notify-client-choice">
          <label className="admin-checkbox-field">
            <input
              aria-describedby="calendar-cancel-notification-helper"
              checked={canNotifyClient && notifyClient}
              disabled={!canNotifyClient}
              onChange={(event) => setNotifyClient(event.target.checked)}
              type="checkbox"
            />
            <span>Уведомить клиента об отмене</span>
          </label>
          <p className="admin-form-helper" id="calendar-cancel-notification-helper">
            {canNotifyClient
              ? `Письмо будет отправлено на ${clientEmail}.`
              : "У клиента нет email. Отмена сохранится без письма."}
          </p>
        </div>
        {error ? <p className="admin-form-alert" role="alert">{error}</p> : null}

        <div className="admin-action-footer">
          <button className="admin-danger-action" disabled={isPending} onClick={confirmCancellation} type="button">
            {isPending ? "Отменяем…" : "Отменить запись"}
          </button>
          <button className="admin-secondary-button" disabled={isPending} onClick={onClose} type="button">
            Оставить запись
          </button>
        </div>
      </section>
    </div>
  );
}
