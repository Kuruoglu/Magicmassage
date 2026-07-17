import type { SpecialistRecord, SpecialistScheduleDay } from "@/admin/domain";

import type { CalendarAppointmentTime, CalendarWorkingHours } from "./conflicts";
import { isOutsideWorkingHours } from "./conflicts";
import { getIsoDateInTimeZone, isoDateToUtcDate } from "./date";
import { timeToMinutes } from "./time";

export type CalendarScheduleSettings = {
  timezone: string;
  workingDays: string;
  workingHours: string;
};

export type CalendarWorkingSchedule = {
  timeZone: string;
  workingDays: ReadonlySet<number>;
  workingHours?: CalendarWorkingHours;
  weeklyWorkingHours?: ReadonlyMap<number, CalendarWorkingHours | null>;
};

export type CalendarScheduleClassification = {
  outsideDailyWorkingHours: boolean;
  outsideWorkingDay: boolean;
  outsideWorkingHours: boolean;
};

const WEEKDAY_TOKENS = new Map<string, number>([
  ["mon", 1],
  ["monday", 1],
  ["пн", 1],
  ["понедельник", 1],
  ["понеделник", 1],
  ["tue", 2],
  ["tuesday", 2],
  ["вт", 2],
  ["вторник", 2],
  ["wed", 3],
  ["wednesday", 3],
  ["ср", 3],
  ["среда", 3],
  ["сряда", 3],
  ["thu", 4],
  ["thursday", 4],
  ["чт", 4],
  ["четверг", 4],
  ["четвъртък", 4],
  ["fri", 5],
  ["friday", 5],
  ["пт", 5],
  ["пятница", 5],
  ["петък", 5],
  ["sat", 6],
  ["saturday", 6],
  ["сб", 6],
  ["суббота", 6],
  ["събота", 6],
  ["sun", 7],
  ["sunday", 7],
  ["вс", 7],
  ["нд", 7],
  ["воскресенье", 7],
  ["неделя", 7],
]);

function parseWeekdayToken(value: string): number | undefined {
  return WEEKDAY_TOKENS.get(value.trim().toLocaleLowerCase("ru-RU").replaceAll(".", ""));
}

function parseWorkingDays(value: string): ReadonlySet<number> {
  const workingDays = new Set<number>();
  const normalizedValue = value.replace(/\s*[-–—]\s*/gu, "-");
  const segments = normalizedValue.split(/[\s,;\/]+/u).filter(Boolean);

  for (const segment of segments) {
    const [rangeStart, rangeEnd, ...unexpected] = segment.split("-");
    const start = parseWeekdayToken(rangeStart);

    if (start === undefined || unexpected.length > 0) continue;

    const end = rangeEnd ? parseWeekdayToken(rangeEnd) : undefined;

    if (!rangeEnd || end === undefined) {
      workingDays.add(start);
      continue;
    }

    let day = start;
    workingDays.add(day);

    while (day !== end) {
      day = day === 7 ? 1 : day + 1;
      workingDays.add(day);
    }
  }

  return workingDays;
}

function parseWorkingHours(value: string): CalendarWorkingHours | undefined {
  const match = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/u.exec(value);

  if (!match) return undefined;

  const start = `${match[1].padStart(2, "0")}:${match[2]}`;
  const end = `${match[3].padStart(2, "0")}:${match[4]}`;

  try {
    if (timeToMinutes(end) <= timeToMinutes(start)) return undefined;
  } catch {
    return undefined;
  }

  return { end, start };
}

function normalizeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return "UTC";
  }
}

export function createCalendarWorkingSchedule(
  settings: CalendarScheduleSettings,
): CalendarWorkingSchedule {
  return {
    timeZone: normalizeTimeZone(settings.timezone),
    workingDays: parseWorkingDays(settings.workingDays),
    workingHours: parseWorkingHours(settings.workingHours),
  };
}

export function createSpecialistWorkingSchedule(
  specialist: SpecialistRecord,
  timeZone: string,
): CalendarWorkingSchedule {
  const weeklyWorkingHours = new Map<number, CalendarWorkingHours | null>();
  const workingDays = new Set<number>();

  for (const day of specialist.weeklySchedule ?? []) {
    if (day.isWorking) {
      workingDays.add(day.weekday);
      weeklyWorkingHours.set(day.weekday, { end: day.endsAt, start: day.startsAt });
    } else {
      weeklyWorkingHours.set(day.weekday, null);
    }
  }

  return {
    timeZone: normalizeTimeZone(timeZone),
    weeklyWorkingHours,
    workingDays,
  };
}

export function getIsoWeekday(isoDate: string) {
  const utcWeekday = isoDateToUtcDate(isoDate).getUTCDay();
  return utcWeekday === 0 ? 7 : utcWeekday;
}

export function getSpecialistScheduleDay(
  specialist: SpecialistRecord | undefined,
  isoDate: string,
): SpecialistScheduleDay | undefined {
  const weekday = getIsoWeekday(isoDate);
  return specialist?.weeklySchedule?.find((day) => day.weekday === weekday);
}

export function hasScheduleEnvelope(value: {
  workingDays?: unknown;
  workingHours?: unknown;
}): value is { workingDays: string; workingHours: string } {
  return typeof value.workingDays === "string" && typeof value.workingHours === "string";
}

export function getCalendarIsoDate(
  schedule: CalendarWorkingSchedule,
  date = new Date(),
): string {
  return getIsoDateInTimeZone(date, schedule.timeZone);
}

export function classifyAppointmentAgainstSchedule(
  appointment: CalendarAppointmentTime,
  schedule: CalendarWorkingSchedule,
): CalendarScheduleClassification {
  const weekday = getIsoWeekday(appointment.date);
  const outsideWorkingDay = !schedule.workingDays.has(weekday);
  const workingHours = schedule.weeklyWorkingHours
    ? schedule.weeklyWorkingHours.get(weekday)
    : schedule.workingHours;
  const outsideDailyWorkingHours = workingHours
    ? isOutsideWorkingHours(appointment, workingHours)
    : true;

  return {
    outsideDailyWorkingHours,
    outsideWorkingDay,
    outsideWorkingHours: outsideWorkingDay || outsideDailyWorkingHours,
  };
}
