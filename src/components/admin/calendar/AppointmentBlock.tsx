import { useState, type DragEvent } from "react";

import type { Appointment } from "@/admin/domain";

import type { AppointmentClassification } from "./conflicts";
import {
  CALENDAR_DAY_END,
  CALENDAR_DAY_START,
  CALENDAR_HOUR_HEIGHT,
} from "./constants";
import type { AppointmentOverlapLayout } from "./TimeGrid";
import {
  CALENDAR_SNAP_MINUTES,
  MIN_APPOINTMENT_DURATION_MINUTES,
  durationToHeight,
  snapMinutes,
  timeToMinutes,
  timeToPosition,
} from "./time";
import { AppointmentResizeHandle } from "./AppointmentResizeHandle";

type AppointmentBlockProps = {
  appointment: Appointment;
  classification: AppointmentClassification;
  compact?: boolean;
  isPending?: boolean;
  isSelected: boolean;
  layout?: AppointmentOverlapLayout;
  onDragEnd: () => void;
  onDragStart: (event: DragEvent<HTMLElement>, appointment: Appointment) => void;
  onResize: (appointment: Appointment, deltaMinutes: number) => void;
  onSelect: (appointment: Appointment) => void;
};

export function clampAppointmentDurationToDay(appointment: Appointment, deltaMinutes: number) {
  const availableMinutes = timeToMinutes(CALENDAR_DAY_END) - timeToMinutes(appointment.time);
  const maximumSnappedDuration =
    Math.floor(availableMinutes / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES;
  const maximumDuration = Math.max(MIN_APPOINTMENT_DURATION_MINUTES, maximumSnappedDuration);
  const proposedDuration = snapMinutes((appointment.durationMinutes ?? 60) + deltaMinutes);

  return Math.min(Math.max(MIN_APPOINTMENT_DURATION_MINUTES, proposedDuration), maximumDuration);
}

export function AppointmentBlock({
  appointment,
  classification,
  compact = false,
  isPending = false,
  isSelected,
  layout = { column: 0, columnCount: 1, leftPercentage: 0, widthPercentage: 100 },
  onDragEnd,
  onDragStart,
  onResize,
  onSelect,
}: AppointmentBlockProps) {
  const [resizePreviewDelta, setResizePreviewDelta] = useState(0);
  const appointmentDuration = appointment.durationMinutes ?? 60;
  const previewDuration = clampAppointmentDurationToDay(appointment, resizePreviewDelta);
  const height = Math.max(28, durationToHeight(previewDuration, CALENDAR_HOUR_HEIGHT));
  const top = Math.max(0, timeToPosition(appointment.time, CALENDAR_DAY_START, CALENDAR_HOUR_HEIGHT));
  const className = [
    "admin-timed-appointment",
    compact ? "is-compact" : "",
    classification.overlap ? "has-overlap" : "",
    classification.outsideWorkingHours ? "is-outside-hours" : "",
    appointment.status === "Отменена" ? "is-cancelled" : "",
    isPending ? "is-pending" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={className}
      aria-busy={isPending || undefined}
      draggable={!isPending}
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(event, appointment)}
      role="listitem"
      style={{
        height: `${height}px`,
        left: `calc(${layout.leftPercentage}% + 4px)`,
        right: "auto",
        top: `${top}px`,
        width: `calc(${layout.widthPercentage}% - 8px)`,
      }}
    >
      <button disabled={isPending} aria-pressed={isSelected} onClick={() => onSelect(appointment)} type="button">
        <time>{appointment.time}</time>
        <strong>{appointment.client}</strong>
        <span>{appointment.service}</span>
        {classification.overlap ? <small>Пересечение</small> : null}
        {classification.outsideWorkingHours ? <small>Вне рабочих часов</small> : null}
      </button>
      <AppointmentResizeHandle
        appointment={appointment}
        disabled={isPending}
        onPreview={(deltaMinutes) =>
          setResizePreviewDelta(clampAppointmentDurationToDay(appointment, deltaMinutes) - appointmentDuration)
        }
        onResize={(resizedAppointment, deltaMinutes) => {
          setResizePreviewDelta(0);
          onResize(resizedAppointment, deltaMinutes);
        }}
      />
    </article>
  );
}
