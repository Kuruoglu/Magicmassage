import { isIsoDate } from "./date";
import { clampDuration, timeToMinutes } from "./time";

import type { AppointmentStatus } from "@/admin/domain";

export type CalendarAppointmentTime = {
  date: string;
  duration: number;
  start: string;
};

export type CalendarWorkingHours = {
  end: string;
  start: string;
};

export type AppointmentClassification = {
  outsideWorkingHours: boolean;
  overlap: boolean;
};

function appointmentInterval(appointment: CalendarAppointmentTime) {
  if (!isIsoDate(appointment.date)) {
    throw new RangeError(`Invalid ISO date: ${appointment.date}`);
  }

  const start = timeToMinutes(appointment.start);
  return {
    end: start + clampDuration(appointment.duration),
    start,
  };
}

export function isSchedulingBlockingStatus(status: AppointmentStatus): boolean {
  return status === "Подтверждена" || status === "Ожидает" || status === "Новая заявка";
}

function workingHoursInterval(workingHours: CalendarWorkingHours) {
  const start = timeToMinutes(workingHours.start);
  const end = timeToMinutes(workingHours.end);

  if (end <= start) {
    throw new RangeError("Working hours must end after they start.");
  }

  return { end, start };
}

export function appointmentsOverlap(
  first: CalendarAppointmentTime,
  second: CalendarAppointmentTime,
): boolean {
  const firstInterval = appointmentInterval(first);
  const secondInterval = appointmentInterval(second);

  return (
    first.date === second.date &&
    firstInterval.start < secondInterval.end &&
    secondInterval.start < firstInterval.end
  );
}

export function hasAppointmentOverlap(
  candidate: CalendarAppointmentTime,
  appointments: readonly CalendarAppointmentTime[],
): boolean {
  return appointments.some((appointment) => appointmentsOverlap(candidate, appointment));
}

export function isOutsideWorkingHours(
  appointment: CalendarAppointmentTime,
  workingHours: CalendarWorkingHours,
): boolean {
  const appointmentTime = appointmentInterval(appointment);
  const workingTime = workingHoursInterval(workingHours);

  return appointmentTime.start < workingTime.start || appointmentTime.end > workingTime.end;
}

export function classifyAppointment(
  candidate: CalendarAppointmentTime,
  appointments: readonly CalendarAppointmentTime[],
  workingHours: CalendarWorkingHours,
): AppointmentClassification {
  return {
    outsideWorkingHours: isOutsideWorkingHours(candidate, workingHours),
    overlap: hasAppointmentOverlap(candidate, appointments),
  };
}
