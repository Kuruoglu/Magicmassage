import { useRef, useState, type DragEvent } from "react";

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
  isDragging?: boolean;
  isDragPreview?: boolean;
  isPending?: boolean;
  isSelected: boolean;
  layout?: AppointmentOverlapLayout;
  onDragEnd: () => void;
  onDragStart: (event: DragEvent<HTMLElement>, appointment: Appointment) => void;
  onResizeInteractionChange?: (isResizing: boolean) => void;
  onResize: (appointment: Appointment, deltaMinutes: number) => void;
  onSelect: (appointment: Appointment) => void;
  readOnly?: boolean;
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
  isDragging = false,
  isDragPreview = false,
  isPending = false,
  isSelected,
  layout = { column: 0, columnCount: 1, leftPercentage: 0, widthPercentage: 100 },
  onDragEnd,
  onDragStart,
  onResizeInteractionChange,
  onResize,
  onSelect,
  readOnly = false,
}: AppointmentBlockProps) {
  const [resizePreviewDelta, setResizePreviewDelta] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const suppressDragUntilRef = useRef(0);
  const appointmentDuration = appointment.durationMinutes ?? 60;
  const previewDuration =
    resizePreviewDelta === 0
      ? appointmentDuration
      : clampAppointmentDurationToDay(appointment, resizePreviewDelta);
  const height = Math.max(28, durationToHeight(previewDuration, CALENDAR_HOUR_HEIGHT));
  const top = Math.max(0, timeToPosition(appointment.time, CALENDAR_DAY_START, CALENDAR_HOUR_HEIGHT));
  const className = [
    "admin-timed-appointment",
    compact ? "is-compact" : "",
    classification.overlap ? "has-overlap" : "",
    classification.outsideWorkingHours ? "is-outside-hours" : "",
    appointment.status === "Отменена" ? "is-cancelled" : "",
    isDragging ? "is-dragging" : "",
    isDragPreview ? "is-drag-preview" : "",
    isPending ? "is-pending" : "",
    isResizing ? "is-resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      aria-hidden={isDragPreview || undefined}
      className={className}
      aria-busy={isPending || undefined}
      draggable={!readOnly && !isDragPreview && !isPending && !isResizing}
      onDragEnd={isDragPreview || readOnly ? undefined : onDragEnd}
      onDragStart={
        isDragPreview || readOnly
          ? undefined
          : (event) => {
              if (isResizing || Date.now() < suppressDragUntilRef.current) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }

              onDragStart(event, appointment);
            }
      }
      role={isDragPreview ? undefined : "listitem"}
      style={{
        height: `${height}px`,
        left: `calc(${layout.leftPercentage}% + 4px)`,
        right: "auto",
        top: `${top}px`,
        width: `calc(${layout.widthPercentage}% - 8px)`,
      }}
    >
      {isDragPreview ? (
        <div className="admin-timed-appointment-preview-content">
          <time>{appointment.time}</time>
          <strong>{appointment.client}</strong>
          <span>{appointment.service}</span>
          {appointment.specialistName ? <span>{appointment.specialistName}</span> : null}
          {classification.overlap ? <small>Пересечение</small> : null}
          {classification.outsideWorkingHours ? <small>Вне рабочих часов</small> : null}
        </div>
      ) : (
        <>
          <button disabled={isPending} aria-pressed={isSelected} onClick={() => onSelect(appointment)} type="button">
            <time>{appointment.time}</time>
            <strong>{appointment.client}</strong>
            <span>{appointment.service}</span>
            {appointment.specialistName ? <span>{appointment.specialistName}</span> : null}
            {classification.overlap ? <small>Пересечение</small> : null}
            {classification.outsideWorkingHours ? <small>Вне рабочих часов</small> : null}
          </button>
          {readOnly ? null : (
            <AppointmentResizeHandle
              appointment={appointment}
              disabled={isPending}
              onActivate={() => onSelect(appointment)}
              onInteractionChange={(active) => {
                suppressDragUntilRef.current = active ? Number.POSITIVE_INFINITY : Date.now() + 700;
                setIsResizing(active);
                onResizeInteractionChange?.(active);
              }}
              onPreview={(deltaMinutes) => {
                setResizePreviewDelta(
                  deltaMinutes === 0
                    ? 0
                    : clampAppointmentDurationToDay(appointment, deltaMinutes) - appointmentDuration,
                );
              }}
              onResize={(resizedAppointment, deltaMinutes) => {
                setResizePreviewDelta(0);
                onResize(resizedAppointment, deltaMinutes);
              }}
              useWholeCardTarget={!compact && previewDuration <= 30}
            />
          )}
        </>
      )}
    </article>
  );
}
