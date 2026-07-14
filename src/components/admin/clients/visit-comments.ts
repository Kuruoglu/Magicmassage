import type { Appointment } from "@/admin/domain";
import { CALENDAR_TIME_ZONE, getSofiaIsoDate } from "@/components/admin/calendar/date";
import { timeToMinutes } from "@/components/admin/calendar/time";

function getTimeInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export function isPostVisitCommentAvailable(appointment: Appointment, now = new Date()) {
  if (appointment.status === "Завершена" || appointment.status === "Не пришёл") return true;

  const today = getSofiaIsoDate(now);
  if (appointment.date < today) return true;
  if (appointment.date > today) return false;

  return timeToMinutes(appointment.time) <= timeToMinutes(getTimeInTimeZone(now, CALENDAR_TIME_ZONE));
}
