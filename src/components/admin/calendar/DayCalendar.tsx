import type { DragEvent, ReactNode } from "react";

import type { Appointment } from "@/admin/domain";

import { appointmentCountLabel, formatCalendarDay, freeSlotLabel } from "./format";
import { TimeGrid, type AppointmentOverlapLayout } from "./TimeGrid";

type DayCalendarProps = {
  appointments: Appointment[];
  bookingBufferMinutes: number;
  dragPreview?: Appointment;
  freeSlotCount: number;
  onDragOverAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onDropAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  renderAppointment: (
    appointment: Appointment,
    compact: boolean,
    layout?: AppointmentOverlapLayout,
    isDragPreview?: boolean,
  ) => ReactNode;
  selectedDate: string;
};

export function DayCalendar({
  appointments,
  bookingBufferMinutes,
  dragPreview,
  freeSlotCount,
  onDragOverAppointment,
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
        dragPreview={dragPreview}
        days={[
          {
            appointments,
            ariaLabel: `Расписание ${formatCalendarDay(selectedDate)}`,
            date: selectedDate,
          },
        ]}
        mode="day"
        onDragOverAppointment={onDragOverAppointment}
        onDropAppointment={onDropAppointment}
        renderAppointment={renderAppointment}
      />
    </>
  );
}
