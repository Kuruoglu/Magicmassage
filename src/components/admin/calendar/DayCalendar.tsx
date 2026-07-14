import type { DragEvent, ReactNode } from "react";

import type { Appointment } from "@/admin/domain";

import { appointmentCountLabel, formatCalendarDay, freeSlotLabel } from "./format";
import { TimeGrid } from "./TimeGrid";

type DayCalendarProps = {
  appointments: Appointment[];
  bookingBufferMinutes: number;
  freeSlotCount: number;
  onDropAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  renderAppointment: (appointment: Appointment, compact: boolean) => ReactNode;
  selectedDate: string;
};

export function DayCalendar({
  appointments,
  bookingBufferMinutes,
  freeSlotCount,
  onDropAppointment,
  renderAppointment,
  selectedDate,
}: DayCalendarProps) {
  return (
    <>
      <div className="admin-day-summary" aria-label={`Сводка дня ${formatCalendarDay(selectedDate)}`}>
        <div className="admin-day-summary-card">
          <span>Записи</span>
          <strong>{appointmentCountLabel(appointments.length)}</strong>
        </div>
        <div className="admin-day-summary-card">
          <span>Свободно</span>
          <strong>{freeSlotLabel(freeSlotCount)}</strong>
        </div>
        <div className="admin-day-summary-card">
          <span>Буфер</span>
          <strong>{bookingBufferMinutes} минут</strong>
        </div>
      </div>
      <TimeGrid
        days={[
          {
            appointments,
            ariaLabel: `Расписание ${formatCalendarDay(selectedDate)}`,
            date: selectedDate,
          },
        ]}
        mode="day"
        onDropAppointment={onDropAppointment}
        renderAppointment={renderAppointment}
      />
    </>
  );
}
