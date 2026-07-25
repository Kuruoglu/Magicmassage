import type { DragEvent, ReactNode } from "react";

import type { Appointment } from "@/admin/domain";

import type { CalendarWorkingHours } from "./conflicts";
import { formatCalendarDay } from "./format";
import {
  TimeGrid,
  type AppointmentOverlapLayout,
  type CalendarTimeSelection,
} from "./TimeGrid";

type DayCalendarProps = {
  activeTimeSelection?: CalendarTimeSelection;
  appointments: Appointment[];
  dragPreview?: Appointment;
  isInteractionLocked?: boolean;
  onDragOverAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onDropAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onSelectTimeRange?: (selection: CalendarTimeSelection) => void;
  renderAppointment: (
    appointment: Appointment,
    compact: boolean,
    layout?: AppointmentOverlapLayout,
    isDragPreview?: boolean,
  ) => ReactNode;
  selectedDate: string;
  workingHours?: CalendarWorkingHours | null;
};

export function DayCalendar({
  activeTimeSelection,
  appointments,
  dragPreview,
  isInteractionLocked = false,
  onDragOverAppointment,
  onDropAppointment,
  onSelectTimeRange,
  renderAppointment,
  selectedDate,
  workingHours,
}: DayCalendarProps) {
  return (
    <TimeGrid
      activeTimeSelection={activeTimeSelection}
      dragPreview={dragPreview}
      days={[
        {
          appointments,
          ariaLabel: `Расписание ${formatCalendarDay(selectedDate)}`,
          date: selectedDate,
          workingHours,
        },
      ]}
      isInteractionLocked={isInteractionLocked}
      mode="day"
      onDragOverAppointment={onDragOverAppointment}
      onDropAppointment={onDropAppointment}
      onSelectTimeRange={onSelectTimeRange}
      renderAppointment={renderAppointment}
    />
  );
}
