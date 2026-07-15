"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CalendarBlock, CalendarBlockKind } from "@/admin/domain";

export type CalendarBlockSaveResult =
  | { ok: true }
  | { message: string; ok: false };

type CalendarBlockDialogProps = {
  initialBlock?: CalendarBlock;
  initialDate: string;
  onClose: () => void;
  onSave: (block: CalendarBlock) => Promise<CalendarBlockSaveResult>;
};

const kindOptions: Array<{ label: string; value: CalendarBlockKind }> = [
  { label: "Личное время", value: "personal" },
  { label: "Недоступно", value: "unavailable" },
  { label: "Другое", value: "other" },
];

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.tabIndex >= 0 && !element.hasAttribute("inert"));
}

export function CalendarBlockDialog({
  initialBlock,
  initialDate,
  onClose,
  onSave,
}: CalendarBlockDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [blockDate, setBlockDate] = useState(initialBlock?.blockDate ?? initialDate);
  const [startsAt, setStartsAt] = useState(initialBlock?.startsAt ?? "12:00");
  const [endsAt, setEndsAt] = useState(initialBlock?.endsAt ?? "13:00");
  const [kind, setKind] = useState<CalendarBlockKind>(initialBlock?.kind ?? "personal");
  const [internalNote, setInternalNote] = useState(initialBlock?.internalNote ?? "");
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

    if (!blockDate || nextStartsAt >= nextEndsAt) {
      setError("Проверьте дату и укажите время окончания позже времени начала.");
      return;
    }

    setIsSaving(true);
    setError("");
    const result = await onSave({
      blockDate,
      endsAt: nextEndsAt,
      id: initialBlock?.id ?? crypto.randomUUID(),
      internalNote: internalNote.trim(),
      kind,
      startsAt: nextStartsAt,
      version: initialBlock?.version,
    });
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
              {initialBlock ? "Изменить недоступное время" : "Заблокировать время"}
            </h2>
          </div>
          <button className="admin-secondary-button" disabled={isSaving} onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form className="admin-action-body" onSubmit={handleSubmit}>
          <label>
            Дата
            <input onChange={(event) => setBlockDate(event.target.value)} required type="date" value={blockDate} />
          </label>

          <fieldset className="admin-settings-choice">
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
          </fieldset>

          <label className="admin-checkbox-field">
            <input
              checked={isFullDay}
              onChange={(event) => setIsFullDay(event.target.checked)}
              type="checkbox"
            />
            <span>Весь день</span>
          </label>

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

          <label>
            Внутренняя заметка
            <textarea
              maxLength={2000}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Например: личная встреча"
              rows={3}
              value={internalNote}
            />
          </label>

          <p className="admin-form-helper">
            Это время исчезнет из публичной записи. Клиентские записи и дневной лимит не изменятся.
          </p>
          {error ? (
            <p className="admin-form-alert" role="alert">
              {error}
            </p>
          ) : null}
          <div className="admin-detail-actions">
            <button className="admin-primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Сохраняем..." : initialBlock ? "Сохранить" : "Заблокировать"}
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
