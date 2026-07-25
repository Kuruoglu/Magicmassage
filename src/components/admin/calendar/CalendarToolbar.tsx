import { CALENDAR_MODES, type CalendarMode } from "./constants";

type CalendarToolbarProps = {
  canManageBlocks: boolean;
  canMarkWalkIn?: boolean;
  heading: string;
  mode: CalendarMode;
  onAddBlock: () => void;
  onMarkWalkIn?: () => void;
  onDateChange: (date: string) => void;
  onGoToToday: () => void;
  onMovePeriod: (direction: "next" | "previous") => void;
  onSwitchMode: (mode: CalendarMode) => void;
  selectedDate: string;
};

export function CalendarToolbar({
  canManageBlocks,
  canMarkWalkIn = false,
  heading,
  mode,
  onAddBlock,
  onMarkWalkIn,
  onDateChange,
  onGoToToday,
  onMovePeriod,
  onSwitchMode,
  selectedDate,
}: CalendarToolbarProps) {
  return (
    <div className="admin-panel-head">
      <div className="admin-calendar-heading-group">
        <h2 id="calendar-heading">{heading}</h2>
        <div className="admin-calendar-period-controls" aria-label="Навигация по календарю">
          <button aria-label="Предыдущий период" onClick={() => onMovePeriod("previous")} type="button">
            ←
          </button>
          <button onClick={onGoToToday} type="button">
            Сегодня
          </button>
          <input
            aria-label="Выбрать дату"
            className="admin-calendar-control admin-calendar-date-input"
            onChange={(event) => {
              if (event.target.value) onDateChange(event.target.value);
            }}
            type="date"
            value={selectedDate}
          />
          <button aria-label="Следующий период" onClick={() => onMovePeriod("next")} type="button">
            →
          </button>
        </div>
      </div>
      <div className="admin-filter-row" aria-label="Режимы календаря">
        {CALENDAR_MODES.map((calendarMode) => (
          <button
            aria-pressed={mode === calendarMode.id}
            key={calendarMode.id}
            onClick={() => onSwitchMode(calendarMode.id)}
            type="button"
          >
            {calendarMode.label}
          </button>
        ))}
        {canManageBlocks ? (
          <button className="admin-calendar-block-action" onClick={onAddBlock} type="button">
            Заблокировать время
          </button>
        ) : null}
        {canMarkWalkIn ? (
          <button className="admin-calendar-walk-in-action" onClick={onMarkWalkIn} type="button">
            Клиент сейчас
          </button>
        ) : null}
      </div>
    </div>
  );
}
