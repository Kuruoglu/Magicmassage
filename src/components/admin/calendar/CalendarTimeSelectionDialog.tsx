"use client";

import { useEffect, useRef } from "react";

import { formatCalendarDay } from "./format";
import type { CalendarTimeSelection } from "./TimeGrid";

type CalendarTimeSelectionDialogProps = {
  onChooseAppointment: (selection: CalendarTimeSelection) => void;
  onChooseBlock: (selection: CalendarTimeSelection) => void;
  onClose: () => void;
  selection: CalendarTimeSelection;
};

export function CalendarTimeSelectionDialog({
  onChooseAppointment,
  onChooseBlock,
  onClose,
  selection,
}: CalendarTimeSelectionDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current();
    };

    dialogRef.current?.focus({ preventScroll: true });
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="admin-calendar-time-selection-sheet-shell">
      <aside
        aria-labelledby="calendar-time-selection-title"
        aria-modal="false"
        className="admin-calendar-time-selection-sheet"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <span className="admin-calendar-time-selection-sheet-grabber" aria-hidden="true" />
        <header className="admin-calendar-time-selection-sheet-head">
          <div>
            <span className="admin-kicker">Выбранное время</span>
            <h2 id="calendar-time-selection-title">Что создать?</h2>
            <p>
              {formatCalendarDay(selection.date)}, {selection.startsAt} - {selection.endsAt}
            </p>
          </div>
          <button
            aria-label="Закрыть выбор времени"
            className="admin-calendar-time-selection-sheet-close"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="admin-calendar-create-choice is-sheet-actions">
          <button
            className="admin-calendar-create-choice-button is-personal"
            onClick={() => onChooseBlock(selection)}
            type="button"
          >
            <span className="admin-calendar-create-choice-mark" aria-hidden="true" />
            <span>
              <strong>Личное время</strong>
              <small>Обед, перерыв или личные дела</small>
            </span>
          </button>
          <button
            className="admin-calendar-create-choice-button is-appointment"
            onClick={() => onChooseAppointment(selection)}
            type="button"
          >
            <span className="admin-calendar-create-choice-mark" aria-hidden="true" />
            <span>
              <strong>Записать клиента</strong>
              <small>Найти клиента и создать запись</small>
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}

export type { CalendarTimeSelectionDialogProps };
