import type { Locale } from "@/i18n/config";

export type BusinessHoursDay = {
  closesAt: string;
  isOpen: boolean;
  opensAt: string;
  weekday: number;
};

export type LocalizedBusinessHoursDay = {
  day: string;
  time: string;
};

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const weekdayLabels: Record<Locale, readonly string[]> = {
  bg: ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"],
  ru: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  ua: ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

const closedLabels: Record<Locale, string> = {
  bg: "почивен ден",
  ru: "выходной",
  ua: "вихідний",
  en: "closed",
};

export const defaultBusinessHoursSchedule: BusinessHoursDay[] = [
  { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 1 },
  { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 2 },
  { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 3 },
  { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 4 },
  { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 5 },
  { closesAt: "18:00", isOpen: true, opensAt: "10:00", weekday: 6 },
  { closesAt: "18:00", isOpen: false, opensAt: "10:00", weekday: 7 },
];

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

export function cloneBusinessHoursSchedule(
  schedule: readonly BusinessHoursDay[] = defaultBusinessHoursSchedule,
) {
  return schedule.map((day) => ({ ...day }));
}

export function isBusinessHoursSchedule(value: unknown): value is BusinessHoursDay[] {
  if (!Array.isArray(value) || value.length !== 7) return false;

  const weekdays = new Set<number>();
  let hasOpenDay = false;

  for (const valueDay of value) {
    if (!valueDay || typeof valueDay !== "object" || Array.isArray(valueDay)) return false;

    const day = valueDay as Partial<BusinessHoursDay>;
    if (
      !Number.isInteger(day.weekday) ||
      day.weekday! < 1 ||
      day.weekday! > 7 ||
      weekdays.has(day.weekday!) ||
      typeof day.isOpen !== "boolean" ||
      typeof day.opensAt !== "string" ||
      typeof day.closesAt !== "string" ||
      !timePattern.test(day.opensAt) ||
      !timePattern.test(day.closesAt)
    ) {
      return false;
    }

    weekdays.add(day.weekday!);
    if (day.isOpen) {
      hasOpenDay = true;
      if (timeToMinutes(day.opensAt) >= timeToMinutes(day.closesAt)) return false;
    }
  }

  return weekdays.size === 7 && hasOpenDay;
}

export function normalizeBusinessHoursSchedule(value: unknown) {
  if (!isBusinessHoursSchedule(value)) return cloneBusinessHoursSchedule();

  return cloneBusinessHoursSchedule(value).sort((left, right) => left.weekday - right.weekday);
}

export function localizeBusinessHoursSchedule(
  locale: Locale,
  schedule: readonly BusinessHoursDay[],
): LocalizedBusinessHoursDay[] {
  return normalizeBusinessHoursSchedule(schedule).map((day) => ({
    day: weekdayLabels[locale][day.weekday - 1],
    time: day.isOpen ? `${day.opensAt} - ${day.closesAt}` : closedLabels[locale],
  }));
}

export function formatBusinessHoursSummary(schedule: readonly BusinessHoursDay[]) {
  return localizeBusinessHoursSchedule("ru", schedule)
    .map((day) => `${day.day}: ${day.time}`)
    .join("; ");
}

export function toPhoneHref(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export function buildRuntimeMapUrls(address: string) {
  const destination = address.trim();

  return {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    embed: `https://www.google.com/maps?q=${encodeURIComponent(destination)}&output=embed`,
  };
}
