"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { AdminRoleId } from "@/admin/config";
import type { Appointment, CalendarBlock, CalendarBlockKind, SpecialistRecord } from "@/admin/domain";

import {
  appointmentOverlapsCalendarBlock,
  calendarBlocksOverlap,
  isSchedulingBlockingStatus,
} from "./conflicts";

export type CalendarBlockSaveResult =
  | { ok: true }
  | { message: string; ok: false };

type CalendarBlockDialogProps = {
  appointments?: Appointment[];
  bookingBufferMinutes?: number;
  calendarBlocks?: CalendarBlock[];
  currentSpecialistId?: string;
  initialBlock?: CalendarBlock;
  initialDate: string;
  initialEndsAt?: string;
  initialSpecialistId?: string;
  initialStartsAt?: string;
  intent?: "block" | "walk-in";
  onClose: () => void;
  onSave: (block: CalendarBlock) => Promise<CalendarBlockSaveResult>;
  role?: AdminRoleId;
  requireSpecialistSelection?: boolean;
  specialists?: SpecialistRecord[];
};

const kindOptions: Array<{ label: string; value: CalendarBlockKind }> = [
  { label: "Личное время", value: "personal" },
  { label: "Недоступно", value: "unavailable" },
  { label: "Другое", value: "other" },
];

const personalReasonOptions = ["Обед", "Личные дела", "Перерыв"] as const;
type PersonalReason = "" | (typeof personalReasonOptions)[number] | "other";

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.tabIndex >= 0 && !element.hasAttribute("inert"));
}

export function CalendarBlockDialog({
  appointments = [],
  bookingBufferMinutes = 0,
  calendarBlocks = [],
  currentSpecialistId,
  initialBlock,
  initialDate,
  initialEndsAt,
  initialSpecialistId,
  initialStartsAt,
  intent = "block",
  onClose,
  onSave,
  role = "owner",
  requireSpecialistSelection = false,
  specialists = [],
}: CalendarBlockDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [blockDate, setBlockDate] = useState(initialBlock?.blockDate ?? initialDate);
  const [startsAt, setStartsAt] = useState(initialBlock?.startsAt ?? initialStartsAt ?? "12:00");
  const [endsAt, setEndsAt] = useState(initialBlock?.endsAt ?? initialEndsAt ?? "13:00");
  const [kind, setKind] = useState<CalendarBlockKind>(initialBlock?.kind ?? (intent === "walk-in" ? "other" : "personal"));
  const [internalNote, setInternalNote] = useState(initialBlock?.internalNote ?? (intent === "walk-in" ? "Клиент сейчас" : ""));
  const initialPersonalReason = initialBlock?.kind === "personal"
    ? personalReasonOptions.find((reason) => reason === initialBlock.internalNote)
      ?? (initialBlock.internalNote ? "other" : "")
    : "";
  const [personalReason, setPersonalReason] = useState<PersonalReason>(initialPersonalReason);
  const [customPersonalReason, setCustomPersonalReason] = useState(
    initialPersonalReason === "other" ? initialBlock?.internalNote ?? "" : "",
  );
  const activeSpecialists = specialists.filter((specialist) => specialist.status === "active");
  const defaultSpecialist =
    activeSpecialists.find((specialist) => specialist.id === currentSpecialistId) ??
    activeSpecialists[0];
  const [specialistId, setSpecialistId] = useState<string | undefined>(
    initialBlock?.specialistId
      ?? initialSpecialistId
      ?? (requireSpecialistSelection ? undefined : defaultSpecialist?.id),
  );
  const [isFullDay, setIsFullDay] = useState(
    initialBlock?.startsAt === "00:00" && initialBlock.endsAt === "23:59",
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTarget = dialogRef.current
      ? getFocusableElements(dialogRef.current)[0] ?? dialogRef.current
      : undefined;
    focusTarget?.focus();

    return () => restoreFocusRef.current?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!isSaving) onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    if (!dialogRef.current.contains(document.activeElement)) {
      event.preventDefault();
      firstElement.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextStartsAt = isFullDay ? "00:00" : startsAt;
    const nextEndsAt = isFullDay ? "23:59" : endsAt;
    const nextInternalNote = intent === "walk-in" || kind !== "personal"
      ? internalNote.trim()
      : personalReason === "other"
        ? customPersonalReason.trim()
        : personalReason;

    if (!blockDate || nextStartsAt >= nextEndsAt || (activeSpecialists.length > 0 && !specialistId)) {
      setError("Проверьте специалиста, дату и укажите время окончания позже времени начала.");
      return;
    }

    const specialist = activeSpecialists.find((candidate) => candidate.id === specialistId);
    const nextBlock: CalendarBlock = {
      blockDate,
      endsAt: nextEndsAt,
      id: initialBlock?.id ?? crypto.randomUUID(),
      internalNote: nextInternalNote,
      kind,
      specialistId,
      specialistName: specialist?.displayName ?? initialBlock?.specialistName,
      startsAt: nextStartsAt,
      version: initialBlock?.version,
    };
    const conflictingAppointment = appointments.find(
      (appointment) =>
        isSchedulingBlockingStatus(appointment.status) &&
        appointmentOverlapsCalendarBlock(
          {
            buffer: appointment.bufferMinutes ?? bookingBufferMinutes,
            date: appointment.date,
            duration: appointment.durationMinutes ?? 60,
            specialistId: appointment.specialistId,
            start: appointment.time,
          },
          nextBlock,
        ),
    );

    if (conflictingAppointment) {
      setError(`Интервал пересекается с записью ${conflictingAppointment.client} в ${conflictingAppointment.time}.`);
      return;
    }

    const conflictingBlock = calendarBlocks.find(
      (block) => block.id !== nextBlock.id && calendarBlocksOverlap(block, nextBlock),
    );

    if (conflictingBlock) {
      setError(`Интервал уже заблокирован с ${conflictingBlock.startsAt} до ${conflictingBlock.endsAt}.`);
      return;
    }

    setIsSaving(true);
    setError("");
    const result = await onSave(nextBlock);
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
        aria-labelledby="calendar-block-dialog-title"
        aria-modal="true"
        className="admin-action-dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Календарь</span>
            <h2 id="calendar-block-dialog-title">
              {initialBlock
                ? "Изменить недоступное время"
                : intent === "walk-in"
                  ? "Занять время клиентом"
                  : "Заблокировать время"}
            </h2>
          </div>
          <button className="admin-secondary-button" disabled={isSaving} onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form className="admin-action-body" noValidate onSubmit={handleSubmit}>
          {role === "owner" || role === "administrator" ? (
            <label>
              Специалист
              <select
                aria-invalid={error && !specialistId ? "true" : undefined}
                disabled={activeSpecialists.length === 0}
                onChange={(event) => {
                  setSpecialistId(event.target.value || undefined);
                  setError("");
                }}
                required
                value={specialistId ?? ""}
              >
                {requireSpecialistSelection && activeSpecialists.length > 0 ? (
                  <option value="">Выберите специалиста</option>
                ) : null}
                {activeSpecialists.length === 0 ? (
                  <option value="">Нет доступных специалистов</option>
                ) : null}
                {activeSpecialists.map((specialist) => (
                  <option key={specialist.id} value={specialist.id}>
                    {specialist.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="admin-form-readonly" aria-label="Специалист">
              <span>Специалист</span>
              <strong>{initialBlock?.specialistName ?? defaultSpecialist?.displayName ?? "Календарь специалиста"}</strong>
            </div>
          )}

          <label>
            Дата
            <input onChange={(event) => setBlockDate(event.target.value)} required type="date" value={blockDate} />
          </label>

          {intent === "walk-in" ? null : <fieldset className="admin-settings-choice">
            <legend>Тип</legend>
            <div className="admin-filter-row" aria-label="Тип недоступного времени">
              {kindOptions.map((option) => (
                <button
                  aria-pressed={kind === option.value}
                  key={option.value}
                  onClick={() => setKind(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>}

          {intent !== "walk-in" && kind === "personal" ? (
            <fieldset className="admin-settings-choice">
              <legend>Причина</legend>
              <div className="admin-filter-row" aria-label="Причина личного времени">
                {personalReasonOptions.map((reason) => (
                  <button
                    aria-pressed={personalReason === reason}
                    key={reason}
                    onClick={() => {
                      setPersonalReason(reason);
                      setError("");
                    }}
                    type="button"
                  >
                    {reason}
                  </button>
                ))}
                <button
                  aria-pressed={personalReason === "other"}
                  onClick={() => {
                    setPersonalReason("other");
                    setError("");
                  }}
                  type="button"
                >
                  Другая
                </button>
              </div>
            </fieldset>
          ) : null}

          {intent !== "walk-in" && kind === "personal" && personalReason === "other" ? (
            <label>
              Другая причина
              <textarea
                maxLength={2000}
                onChange={(event) => setCustomPersonalReason(event.target.value)}
                placeholder="Например: личная встреча"
                rows={3}
                value={customPersonalReason}
              />
            </label>
          ) : null}

          {intent === "walk-in" ? null : <label className="admin-checkbox-field">
            <input
              checked={isFullDay}
              onChange={(event) => setIsFullDay(event.target.checked)}
              type="checkbox"
            />
            <span>Весь день</span>
          </label>}

          {!isFullDay ? (
            <div className="admin-calendar-block-time-grid">
              <label>
                Начало
                <input onChange={(event) => setStartsAt(event.target.value)} required step={900} type="time" value={startsAt} />
              </label>
              <label>
                Конец
                <input onChange={(event) => setEndsAt(event.target.value)} required step={900} type="time" value={endsAt} />
              </label>
            </div>
          ) : null}

          {intent === "walk-in" || kind !== "personal" ? (
            <label>
              {intent === "walk-in" ? "Имя или короткая пометка" : "Внутренняя заметка"}
              <textarea
                maxLength={2000}
                onChange={(event) => setInternalNote(event.target.value)}
                placeholder={intent === "walk-in" ? "Например: посетитель" : "Например: причина недоступности"}
                rows={3}
                value={internalNote}
              />
            </label>
          ) : null}

          <p className="admin-form-helper">
            {intent === "walk-in"
              ? "Интервал сразу станет занятым в вашем календаре и исчезнет из публичной записи. Телефон и карточка клиента не создаются."
              : "Это время исчезнет из публичной записи. Клиентские записи и дневной лимит не изменятся."}
          </p>
          {error ? (
            <p className="admin-form-alert" role="alert">
              {error}
            </p>
          ) : null}
          <div className="admin-detail-actions">
            <button className="admin-primary-button" disabled={isSaving} type="submit">
              {isSaving
                ? "Сохраняем..."
                : initialBlock
                  ? "Сохранить"
                  : intent === "walk-in"
                    ? "Занять время"
                    : "Заблокировать"}
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
