"use client";

import { useState } from "react";

import type { Appointment } from "@/admin/domain";
import { statusClass } from "@/components/admin/lib/formatters";

import { formatCalendarDay } from "./format";
import type { CalendarAppointmentSaveResult } from "./CalendarWorkspace";

export type CalendarAppointmentCancelDialogProps = {
  appointment: Appointment;
  onClose: () => void;
  onConfirm: (appointment: Appointment) => Promise<CalendarAppointmentSaveResult>;
};

export function CalendarAppointmentCancelDialog({
  appointment,
  onClose,
  onConfirm,
}: CalendarAppointmentCancelDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function confirmCancellation() {
    setIsPending(true);
    setError("");
    const result = await onConfirm(appointment);
    setIsPending(false);

    if (result.ok) onClose();
    else setError(result.message);
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="calendar-cancel-title" aria-modal="true" className="admin-action-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Календарь</span>
            <h2 id="calendar-cancel-title">Отменить запись</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <p className="admin-confirm-copy">
          Запись клиента <strong>{appointment.client}</strong> на {formatCalendarDay(appointment.date)} в{" "}
          <strong>{appointment.time}</strong> будет отмечена как отмененная. История останется в календаре.
        </p>
        <div className="admin-confirm-summary" aria-label="Запись для отмены">
          <span>{appointment.service}</span>
          <span className={statusClass(appointment.status)}>{appointment.status}</span>
        </div>
        {error ? <p className="admin-form-alert" role="alert">{error}</p> : null}

        <div className="admin-action-footer">
          <button className="admin-danger-action" disabled={isPending} onClick={confirmCancellation} type="button">
            {isPending ? "Сохраняем…" : "Подтвердить отмену"}
          </button>
          <button className="admin-secondary-button" onClick={onClose} type="button">
            Оставить запись
          </button>
        </div>
      </section>
    </div>
  );
}
