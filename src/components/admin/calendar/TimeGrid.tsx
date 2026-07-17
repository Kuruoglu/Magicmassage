import { useEffect, useRef, type CSSProperties, type DragEvent, type ReactNode } from "react";

import type { Appointment } from "@/admin/domain";
import { appointmentKey } from "@/components/admin/lib/links";

import type { CalendarWorkingHours } from "./conflicts";
import {
  CALENDAR_DAY_END,
  CALENDAR_DAY_START,
  CALENDAR_HOUR_HEIGHT,
  CALENDAR_HOUR_LABELS,
  CALENDAR_INITIAL_SCROLL_TIME,
} from "./constants";
import { MIN_APPOINTMENT_DURATION_MINUTES, timeToMinutes, timeToPosition } from "./time";

export type AppointmentOverlapLayout = {
  column: number;
  columnCount: number;
  leftPercentage: number;
  widthPercentage: number;
};

export type LaidOutAppointment = {
  appointment: Appointment;
  layout: AppointmentOverlapLayout;
};

type LayoutCandidate = {
  appointment: Appointment;
  column: number;
  end: number;
  key: string;
  start: number;
};

function percentage(part: number, total: number) {
  return Number(((part / total) * 100).toFixed(6));
}

function assignColumns(group: LayoutCandidate[]): LaidOutAppointment[] {
  const columnEnds: number[] = [];

  for (const candidate of group) {
    const availableColumn = columnEnds.findIndex((end) => end <= candidate.start);
    candidate.column = availableColumn === -1 ? columnEnds.length : availableColumn;
    columnEnds[candidate.column] = candidate.end;
  }

  const columnCount = Math.max(1, columnEnds.length);

  return group.map((candidate) => ({
    appointment: candidate.appointment,
    layout: {
      column: candidate.column,
      columnCount,
      leftPercentage: percentage(candidate.column, columnCount),
      widthPercentage: percentage(1, columnCount),
    },
  }));
}

export function layoutDayAppointments(appointments: Appointment[]): LaidOutAppointment[] {
  const candidates = appointments
    .map<LayoutCandidate>((appointment) => {
      const start = timeToMinutes(appointment.time);

      return {
        appointment,
        column: 0,
        end: start + Math.max(MIN_APPOINTMENT_DURATION_MINUTES, appointment.durationMinutes ?? 60),
        key: appointmentKey(appointment),
        start,
      };
    })
    .sort((left, right) => {
      if (left.start !== right.start) return left.start - right.start;
      if (left.end !== right.end) return right.end - left.end;
      if (left.key === right.key) return 0;
      return left.key < right.key ? -1 : 1;
    });
  const laidOutAppointments: LaidOutAppointment[] = [];

  for (let groupStart = 0; groupStart < candidates.length; ) {
    let groupEnd = candidates[groupStart].end;
    let groupEndIndex = groupStart + 1;

    while (groupEndIndex < candidates.length && candidates[groupEndIndex].start < groupEnd) {
      groupEnd = Math.max(groupEnd, candidates[groupEndIndex].end);
      groupEndIndex += 1;
    }

    laidOutAppointments.push(...assignColumns(candidates.slice(groupStart, groupEndIndex)));
    groupStart = groupEndIndex;
  }

  return laidOutAppointments;
}

export type TimeGridDay = {
  appointments: Appointment[];
  ariaLabel: string;
  className?: string;
  date: string;
  workingHours?: CalendarWorkingHours | null;
};

type TimeGridProps = {
  days: TimeGridDay[];
  dragPreview?: Appointment;
  isInteractionLocked?: boolean;
  mode: "day" | "week";
  onDragOverAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onDropAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  renderAppointment: (
    appointment: Appointment,
    compact: boolean,
    layout?: AppointmentOverlapLayout,
    isDragPreview?: boolean,
  ) => ReactNode;
};

function TimeAxis() {
  return (
    <div className="admin-calendar-time-axis" aria-hidden="true">
      {CALENDAR_HOUR_LABELS.map((hour) => (
        <time key={hour} style={{ top: `${timeToPosition(hour, CALENDAR_DAY_START, CALENDAR_HOUR_HEIGHT)}px` }}>
          {hour}
        </time>
      ))}
    </div>
  );
}

function TimeColumn({
  compact,
  day,
  dragPreview,
  onDragOverAppointment,
  onDropAppointment,
  renderAppointment,
}: {
  compact: boolean;
  day: TimeGridDay;
  dragPreview?: Appointment;
  onDragOverAppointment: TimeGridProps["onDragOverAppointment"];
  onDropAppointment: TimeGridProps["onDropAppointment"];
  renderAppointment: TimeGridProps["renderAppointment"];
}) {
  const laidOutAppointments = layoutDayAppointments(day.appointments);
  const dayStartMinutes = timeToMinutes(CALENDAR_DAY_START);
  const dayEndMinutes = timeToMinutes(CALENDAR_DAY_END);
  const workingStartMinutes = day.workingHours
    ? Math.max(dayStartMinutes, timeToMinutes(day.workingHours.start))
    : dayStartMinutes;
  const workingEndMinutes = day.workingHours
    ? Math.min(dayEndMinutes, timeToMinutes(day.workingHours.end))
    : dayEndMinutes;
  const beforeHeight = ((workingStartMinutes - dayStartMinutes) / 60) * CALENDAR_HOUR_HEIGHT;
  const afterTop = ((workingEndMinutes - dayStartMinutes) / 60) * CALENDAR_HOUR_HEIGHT;
  const afterHeight = ((dayEndMinutes - workingEndMinutes) / 60) * CALENDAR_HOUR_HEIGHT;

  return (
    <section
      aria-label={day.ariaLabel}
      className={["admin-calendar-time-column", day.className].filter(Boolean).join(" ")}
      onDragOver={(event) => onDragOverAppointment(event, day.date)}
      onDrop={(event) => onDropAppointment(event, day.date)}
      role="list"
    >
      {day.workingHours === null ? (
        <div className="admin-calendar-off-hours is-closed" aria-hidden="true">
          <span>Выходной</span>
        </div>
      ) : day.workingHours ? (
        <div className="admin-calendar-off-hours" aria-hidden="true">
          {beforeHeight > 0 ? <span style={{ height: `${beforeHeight}px`, top: 0 }} /> : null}
          {afterHeight > 0 ? <span style={{ height: `${afterHeight}px`, top: `${afterTop}px` }} /> : null}
        </div>
      ) : null}
      <div className="admin-calendar-hour-lines" aria-hidden="true">
        {CALENDAR_HOUR_LABELS.map((hour) => (
          <span
            key={hour}
            style={{ top: `${timeToPosition(hour, CALENDAR_DAY_START, CALENDAR_HOUR_HEIGHT)}px` }}
          />
        ))}
      </div>
      {laidOutAppointments.map(({ appointment, layout }) => renderAppointment(appointment, compact, layout))}
      {dragPreview?.date === day.date ? renderAppointment(dragPreview, compact, undefined, true) : null}
    </section>
  );
}

export function TimeGrid({
  days,
  dragPreview,
  isInteractionLocked = false,
  mode,
  onDragOverAppointment,
  onDropAppointment,
  renderAppointment,
}: TimeGridProps) {
  const dayScrollRef = useRef<HTMLDivElement>(null);
  const selectedDay = days[0]?.date;
  const calendarGridHeight =
    ((timeToMinutes(CALENDAR_DAY_END) - timeToMinutes(CALENDAR_DAY_START)) / 60) * CALENDAR_HOUR_HEIGHT;
  const gridHeightStyle = {
    "--admin-calendar-grid-height": `${calendarGridHeight}px`,
  } as CSSProperties;

  useEffect(() => {
    if (mode === "day" && dayScrollRef.current) {
      dayScrollRef.current.scrollTop = timeToPosition(
        CALENDAR_INITIAL_SCROLL_TIME,
        CALENDAR_DAY_START,
        CALENDAR_HOUR_HEIGHT,
      );
    }
  }, [mode, selectedDay]);

  if (mode === "week") {
    return (
      <div className="admin-week-grid-body" style={gridHeightStyle}>
        <TimeAxis />
        <div className="admin-week-time-columns">
          {days.map((day) => (
            <TimeColumn
              compact
              day={day}
              dragPreview={dragPreview}
              key={day.date}
              onDragOverAppointment={onDragOverAppointment}
              onDropAppointment={onDropAppointment}
              renderAppointment={renderAppointment}
            />
          ))}
        </div>
      </div>
    );
  }

  const day = days[0];

  return (
    <div
      className={`admin-calendar-time-grid admin-day-time-grid${isInteractionLocked ? " is-resizing" : ""}`}
      ref={dayScrollRef}
      style={{ ...gridHeightStyle, maxHeight: "min(70vh, 860px)" }}
    >
      <TimeAxis />
      {day ? (
        <TimeColumn
          compact={false}
          day={day}
          dragPreview={dragPreview}
          onDragOverAppointment={onDragOverAppointment}
          onDropAppointment={onDropAppointment}
          renderAppointment={renderAppointment}
        />
      ) : null}
    </div>
  );
}
