import { useEffect, useRef, type DragEvent, type ReactNode } from "react";

import type { Appointment } from "@/admin/domain";

import {
  CALENDAR_DAY_START,
  CALENDAR_HOUR_HEIGHT,
  CALENDAR_INITIAL_SCROLL_TIME,
  CALENDAR_WEEKDAY_LABELS,
} from "./constants";
import { appointmentCountLabel, formatCalendarDay, formatCalendarShortDay } from "./format";
import { TimeGrid, type AppointmentOverlapLayout } from "./TimeGrid";
import { timeToPosition } from "./time";

export type CalendarWeekDay = {
  date: string;
  day: number;
};

type WeekCalendarProps = {
  appointments: Appointment[];
  dragPreview?: Appointment;
  heading: string;
  isInteractionLocked?: boolean;
  onDragOverAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onDropAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onSelectDate: (date: string, appointments: Appointment[]) => void;
  renderAppointment: (
    appointment: Appointment,
    compact: boolean,
    layout?: AppointmentOverlapLayout,
    isDragPreview?: boolean,
  ) => ReactNode;
  weekDays: CalendarWeekDay[];
};

export function WeekCalendar({
  appointments,
  dragPreview,
  heading,
  isInteractionLocked = false,
  onDragOverAppointment,
  onDropAppointment,
  onSelectDate,
  renderAppointment,
  weekDays,
}: WeekCalendarProps) {
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const timeGridDays = weekDays.map((day, index) => {
    const dayAppointments = appointments.filter((appointment) => appointment.date === day.date);

    return {
      appointments: dayAppointments,
      ariaLabel: `${formatCalendarDay(day.date)}, ${appointmentCountLabel(dayAppointments.length)}`,
      className: index === 6 ? "is-sunday" : undefined,
      date: day.date,
    };
  });

  useEffect(() => {
    if (weekScrollRef.current) {
      weekScrollRef.current.scrollTop = timeToPosition(
        CALENDAR_INITIAL_SCROLL_TIME,
        CALENDAR_DAY_START,
        CALENDAR_HOUR_HEIGHT,
      );
    }
  }, [heading]);

  return (
    <div
      className={`admin-calendar-time-grid${isInteractionLocked ? " is-resizing" : ""}`}
      aria-label={`Неделя ${heading}`}
      ref={weekScrollRef}
      style={{ maxHeight: "min(70vh, 860px)" }}
    >
      <div className="admin-week-grid-head">
        <span aria-hidden="true" />
        {weekDays.map((day, index) => {
          const dayAppointments = appointments.filter((appointment) => appointment.date === day.date);

          return (
            <button
              className={index === 6 ? "is-sunday" : ""}
              key={day.date}
              onClick={() => onSelectDate(day.date, dayAppointments)}
              type="button"
            >
              <strong>{CALENDAR_WEEKDAY_LABELS[index]}</strong>
              <span>{formatCalendarShortDay(day.date)}</span>
            </button>
          );
        })}
      </div>
      <TimeGrid
        days={timeGridDays}
        dragPreview={dragPreview}
        isInteractionLocked={isInteractionLocked}
        mode="week"
        onDragOverAppointment={onDragOverAppointment}
        onDropAppointment={onDropAppointment}
        renderAppointment={renderAppointment}
      />
    </div>
  );
}
