export const CALENDAR_TIME_ZONE = "Europe/Sofia";

export type CalendarPeriodUnit = "day" | "week" | "month";
export type CalendarPeriodDirection = "next" | "previous" | 1 | -1;

export type CalendarPeriod = {
  end: string;
  start: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toUtcIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function assertInteger(value: number, label: string) {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer.`);
  }
}

function assertValidDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Date must be valid.");
  }
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && toUtcIsoDate(date) === value;
}

export function isoDateToUtcDate(isoDate: string): Date {
  if (!isIsoDate(isoDate)) {
    throw new RangeError(`Invalid ISO date: ${isoDate}`);
  }

  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function getIsoDateInTimeZone(date: Date, timeZone = CALENDAR_TIME_ZONE): string {
  assertValidDate(date);

  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export function getSofiaIsoDate(date = new Date()): string {
  return getIsoDateInTimeZone(date, CALENDAR_TIME_ZONE);
}

export function addDays(isoDate: string, days: number): string {
  assertInteger(days, "Days");

  const date = isoDateToUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toUtcIsoDate(date);
}

export function startOfWeek(isoDate: string): string {
  const date = isoDateToUtcDate(isoDate);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return addDays(isoDate, -daysSinceMonday);
}

export function startOfMonth(isoDate: string): string {
  isoDateToUtcDate(isoDate);
  return `${isoDate.slice(0, 8)}01`;
}

export function endOfMonth(isoDate: string): string {
  const date = isoDateToUtcDate(startOfMonth(isoDate));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return toUtcIsoDate(date);
}

export function generateMonthGrid(isoDate: string): string[] {
  const gridStart = startOfWeek(startOfMonth(isoDate));
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export const getMonthGrid = generateMonthGrid;

export function getPeriodRange(isoDate: string, period: CalendarPeriodUnit): CalendarPeriod {
  if (period === "day") {
    isoDateToUtcDate(isoDate);
    return { end: isoDate, start: isoDate };
  }

  if (period === "week") {
    const start = startOfWeek(isoDate);
    return { end: addDays(start, 6), start };
  }

  return {
    end: endOfMonth(isoDate),
    start: startOfMonth(isoDate),
  };
}

export function getPeriodRangeForInstant(date: Date, period: CalendarPeriodUnit): CalendarPeriod {
  return getPeriodRange(getSofiaIsoDate(date), period);
}

function moveByMonths(isoDate: string, months: number): string {
  const source = isoDateToUtcDate(isoDate);
  const sourceDay = source.getUTCDate();

  source.setUTCDate(1);
  source.setUTCMonth(source.getUTCMonth() + months);

  const targetMonthStart = toUtcIsoDate(source);
  const targetDay = Math.min(sourceDay, Number(endOfMonth(targetMonthStart).slice(-2)));
  return `${targetMonthStart.slice(0, 8)}${String(targetDay).padStart(2, "0")}`;
}

export function navigatePeriod(
  isoDate: string,
  period: CalendarPeriodUnit,
  direction: CalendarPeriodDirection,
): string {
  const step = direction === "next" || direction === 1 ? 1 : -1;

  if (period === "day") {
    return addDays(isoDate, step);
  }

  if (period === "week") {
    return addDays(isoDate, step * 7);
  }

  return moveByMonths(isoDate, step);
}
