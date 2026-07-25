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

function getAppointmentEnd(appointment: Appointment) {
  const startOfDay = Date.parse(`${appointment.date}T00:00:00.000Z`);
  const end = new Date(
    startOfDay +
    (timeToMinutes(appointment.time) + (appointment.durationMinutes ?? 60)) * 60_000,
  );

  return {
    date: end.toISOString().slice(0, 10),
    time: `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`,
  };
}

export function isPostVisitCommentAvailable(appointment: Appointment, now = new Date()) {
  if (appointment.status === "Завершена" || appointment.status === "Не пришёл") return true;

  const today = getSofiaIsoDate(now);
  const appointmentEnd = getAppointmentEnd(appointment);
  if (appointmentEnd.date < today) return true;
  if (appointmentEnd.date > today) return false;

  return timeToMinutes(appointmentEnd.time) <= timeToMinutes(getTimeInTimeZone(now, CALENDAR_TIME_ZONE));
}

export function needsPostVisitComment(appointment: Appointment, now = new Date()) {
  if (appointment.postVisitComment?.trim()) return false;

  if (
    appointment.status === "Новая заявка" ||
    appointment.status === "Отменена" ||
    appointment.status === "Не пришёл"
  ) {
    return false;
  }

  return isPostVisitCommentAvailable(appointment, now);
}
