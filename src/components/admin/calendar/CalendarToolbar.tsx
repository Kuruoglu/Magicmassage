import { CALENDAR_MODES, type CalendarMode } from "./constants";

type CalendarToolbarProps = {
  heading: string;
  mode: CalendarMode;
  onDateChange: (date: string) => void;
  onGoToToday: () => void;
  onMovePeriod: (direction: "next" | "previous") => void;
  onSwitchMode: (mode: CalendarMode) => void;
  selectedDate: string;
};

export function CalendarToolbar({
  heading,
  mode,
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
      </div>
    </div>
  );
}
