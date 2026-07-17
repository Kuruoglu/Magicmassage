"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { SpecialistRecord, SpecialistScheduleDay } from "@/admin/domain";

export type SpecialistScheduleSaveResult =
  | { ok: true }
  | { message: string; ok: false };

type SpecialistScheduleDialogProps = {
  onClose: () => void;
  onSave: (
    specialistId: string,
    weeklySchedule: SpecialistScheduleDay[],
  ) => Promise<SpecialistScheduleSaveResult>;
  specialist: SpecialistRecord;
};

const weekdayLabels = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.tabIndex >= 0);
}

function isHalfHour(value: string) {
  return /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(value);
}

function normalizeSchedule(schedule: SpecialistScheduleDay[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = index + 1;
    const day = schedule.find((candidate) => candidate.weekday === weekday);

    return day ?? {
      endsAt: "00:30",
      isWorking: false,
      startsAt: "00:00",
      weekday,
    };
  });
}

export function SpecialistScheduleDialog({
  onClose,
  onSave,
  specialist,
}: SpecialistScheduleDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [schedule, setSchedule] = useState(() => normalizeSchedule(specialist.weeklySchedule ?? []));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = dialogRef.current
      ? getFocusableElements(dialogRef.current)[0] ?? dialogRef.current
      : undefined;
    target?.focus();

    return () => restoreFocusRef.current?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!isSaving) onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = getFocusableElements(dialogRef.current);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function updateDay(weekday: number, update: Partial<SpecialistScheduleDay>) {
    setSchedule((current) => current.map((day) => (
      day.weekday === weekday ? { ...day, ...update } : day
    )));
    setError("");
  }

  function copyFirstWorkingDay() {
    const source = schedule.find((day) => day.isWorking);
    if (!source) return;

    setSchedule((current) => current.map((day) => (
      day.isWorking
        ? { ...day, endsAt: source.endsAt, startsAt: source.startsAt }
        : day
    )));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidDay = schedule.find((day) => (
      !isHalfHour(day.startsAt)
      || !isHalfHour(day.endsAt)
      || day.startsAt >= day.endsAt
    ));

    if (invalidDay) {
      setError("Укажите начало и конец смены с шагом 30 минут.");
      return;
    }

    setIsSaving(true);
    setError("");
    const result = await onSave(specialist.id, schedule);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onClose();
  }

  return (
    <div className="admin-action-backdrop" role="presentation">
      <section
        aria-labelledby="specialist-schedule-dialog-title"
        aria-modal="true"
        className="admin-action-dialog admin-specialist-schedule-dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">График работы</span>
            <h2 id="specialist-schedule-dialog-title">{specialist.displayName}</h2>
            <p>Свободное время на сайте рассчитывается по этому графику.</p>
          </div>
          <button className="admin-secondary-button" disabled={isSaving} onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form className="admin-action-body" onSubmit={handleSubmit}>
          <div className="admin-specialist-schedule-head" aria-hidden="true">
            <span>День</span>
            <span>Начало</span>
            <span>Конец</span>
          </div>
          <div className="admin-specialist-schedule-days">
            {schedule.map((day) => (
              <div className="admin-specialist-schedule-day" key={day.weekday}>
                <label className="admin-checkbox-field">
                  <input
                    checked={day.isWorking}
                    onChange={(event) => updateDay(day.weekday, { isWorking: event.target.checked })}
                    type="checkbox"
                  />
                  <span>{weekdayLabels[day.weekday - 1]}</span>
                </label>
                <label>
                  <span className="admin-specialist-schedule-input-label" aria-hidden="true">Начало</span>
                  <input
                    aria-label={`Начало: ${weekdayLabels[day.weekday - 1]}`}
                    disabled={!day.isWorking}
                    onChange={(event) => updateDay(day.weekday, { startsAt: event.target.value })}
                    required={day.isWorking}
                    step={1800}
                    type="time"
                    value={day.startsAt}
                  />
                </label>
                <label>
                  <span className="admin-specialist-schedule-input-label" aria-hidden="true">Конец</span>
                  <input
                    aria-label={`Конец: ${weekdayLabels[day.weekday - 1]}`}
                    disabled={!day.isWorking}
                    onChange={(event) => updateDay(day.weekday, { endsAt: event.target.value })}
                    required={day.isWorking}
                    step={1800}
                    type="time"
                    value={day.endsAt}
                  />
                </label>
                {!day.isWorking ? <span className="admin-specialist-schedule-closed">Выходной</span> : null}
              </div>
            ))}
          </div>

          <button className="admin-outline-action admin-specialist-schedule-copy" onClick={copyFirstWorkingDay} type="button">
            Одинаковое время для рабочих дней
          </button>

          {error ? <p className="admin-form-alert" role="alert">{error}</p> : null}
          <div className="admin-detail-actions">
            <button className="admin-primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Сохраняем..." : "Сохранить график"}
            </button>
            <button className="admin-secondary-button" disabled={isSaving} onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
