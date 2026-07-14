import type { Appointment } from "@/admin/domain";

import { addDays, startOfWeek } from "./date";
import type { CalendarMode } from "./constants";

export function sortAppointments(appointments: Appointment[]) {
  return [...appointments].sort((first, second) =>
    `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`),
  );
}

export function calendarHeadingLabel(mode: CalendarMode, selectedDate: string) {
  if (mode === "month") {
    const label = new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "UTC", year: "numeric" }).format(
      new Date(`${selectedDate}T00:00:00Z`),
    );

    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  if (mode === "week") {
    const weekStart = startOfWeek(selectedDate);
    return `${formatCalendarShortDay(weekStart)} - ${formatCalendarShortDay(addDays(weekStart, 6))}`;
  }

  if (mode === "list") {
    return "Список записей";
  }

  return formatCalendarDay(selectedDate);
}

export function formatCalendarDay(date: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function formatCalendarShortDay(date: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function appointmentCountLabel(count: number) {
  if (count === 1) {
    return "1 запись";
  }

  if (count > 1 && count < 5) {
    return `${count} записи`;
  }

  return `${count} записей`;
}

export function compactAppointmentCountLabel(count: number) {
  return `${count} зап.`;
}

export function freeSlotCount(appointmentCount: number, dailySlotCapacity: number) {
  return Math.max(0, dailySlotCapacity - appointmentCount);
}

export function freeSlotLabel(count: number) {
  if (count === 1) {
    return "1 свободный слот";
  }

  if (count > 1 && count < 5) {
    return `${count} свободных слота`;
  }

  return `${count} свободных слотов`;
}

export function compactFreeSlotLabel(count: number) {
  return `${count} св.`;
}

export function slotCountLabel(count: number) {
  if (count === 1) {
    return "1 слот";
  }

  if (count > 1 && count < 5) {
    return `${count} слота`;
  }

  return `${count} слотов`;
}
