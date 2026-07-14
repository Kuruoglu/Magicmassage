export type CalendarMode = "day" | "week" | "month" | "list";

export const CALENDAR_MODES: Array<{ id: CalendarMode; label: string }> = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "list", label: "Список" },
];

export const CALENDAR_WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const CALENDAR_DAY_START = "00:00";
export const CALENDAR_DAY_END = "24:00";
export const CALENDAR_WORKING_DAY_START = "10:00";
export const CALENDAR_WORKING_DAY_END = "19:00";
export const CALENDAR_INITIAL_SCROLL_TIME = "08:00";
export const CALENDAR_HOUR_HEIGHT = 72;
export const CALENDAR_INTERVAL_MINUTES = 30;
export const CALENDAR_HOUR_LABELS = Array.from({ length: 49 }, (_, index) => {
  const minutes = index * CALENDAR_INTERVAL_MINUTES;
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
