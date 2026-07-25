import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";

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
import {
  CALENDAR_SNAP_MINUTES,
  MIN_APPOINTMENT_DURATION_MINUTES,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
  timeToPosition,
} from "./time";

export type CalendarTimeSelection = {
  date: string;
  durationMinutes: number;
  endsAt: string;
  specialistId?: string;
  startsAt: string;
};

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

const TOUCH_SELECTION_DRAG_DELAY_MS = 250;
const TOUCH_SWIPE_THRESHOLD_PX = 12;

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
  activeTimeSelection?: CalendarTimeSelection;
  days: TimeGridDay[];
  dragPreview?: Appointment;
  isInteractionLocked?: boolean;
  mode: "day" | "week";
  onDragOverAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onDropAppointment: (event: DragEvent<HTMLElement>, date: string) => void;
  onSelectTimeRange?: (selection: CalendarTimeSelection) => void;
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
  activeTimeSelection,
  compact,
  day,
  dragPreview,
  isInteractionLocked,
  onDragOverAppointment,
  onDropAppointment,
  onSelectTimeRange,
  renderAppointment,
}: {
  activeTimeSelection?: CalendarTimeSelection;
  compact: boolean;
  day: TimeGridDay;
  dragPreview?: Appointment;
  isInteractionLocked: boolean;
  onDragOverAppointment: TimeGridProps["onDragOverAppointment"];
  onDropAppointment: TimeGridProps["onDropAppointment"];
  onSelectTimeRange?: TimeGridProps["onSelectTimeRange"];
  renderAppointment: TimeGridProps["renderAppointment"];
}) {
  const [selectionDraft, setSelectionDraft] = useState<{
    anchorMinutes: number;
    defaultDurationMinutes: number;
    endMinutes: number;
    pointerId: number;
    startMinutes: number;
  } | null>(null);
  const [resizeDraft, setResizeDraft] = useState<{
    edge: "start" | "end";
    endMinutes: number;
    originalEndMinutes: number;
    originalStartMinutes: number;
    pointerId: number;
    startMinutes: number;
  } | null>(null);
  const resizeDraftRef = useRef(resizeDraft);
  const selectionDraftRef = useRef(selectionDraft);
  const timeColumnRef = useRef<HTMLElement>(null);
  const touchGestureRef = useRef<{
    identifier: number;
    mode: "pending" | "selecting";
    startClientX: number;
    startClientY: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
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
  const canSelectTime = Boolean(onSelectTimeRange) && !isInteractionLocked;

  function setDraft(nextDraft: typeof selectionDraft) {
    selectionDraftRef.current = nextDraft;
    setSelectionDraft(nextDraft);
  }

  function setActiveResizeDraft(nextDraft: typeof resizeDraft) {
    resizeDraftRef.current = nextDraft;
    setResizeDraft(nextDraft);
  }

  function clientYToMinutes(clientY: number, target: HTMLElement, allowDayEnd: boolean) {
    const bounds = target.getBoundingClientRect();
    const position = Math.min(Math.max(clientY - bounds.top, 0), bounds.height);
    const rawMinutes = dayStartMinutes + (position / CALENDAR_HOUR_HEIGHT) * 60;
    return Math.min(
      allowDayEnd ? dayEndMinutes : dayEndMinutes - CALENDAR_SNAP_MINUTES,
      Math.max(dayStartMinutes, snapMinutes(rawMinutes)),
    );
  }

  function pointerMinutes(event: PointerEvent<HTMLElement>, allowDayEnd: boolean) {
    return clientYToMinutes(event.clientY, event.currentTarget, allowDayEnd);
  }

  function selectionBounds(anchorMinutes: number, currentMinutes: number) {
    if (currentMinutes > anchorMinutes) {
      return { endMinutes: currentMinutes, startMinutes: anchorMinutes };
    }

    if (currentMinutes < anchorMinutes) {
      return { endMinutes: anchorMinutes, startMinutes: currentMinutes };
    }

    return {
      endMinutes: Math.min(dayEndMinutes, anchorMinutes + CALENDAR_SNAP_MINUTES),
      startMinutes: anchorMinutes,
    };
  }

  function serializeSelection(startMinutes: number, endMinutes: number) {
    const serializedEndMinutes = endMinutes === dayEndMinutes ? dayEndMinutes - 1 : endMinutes;

    return {
      date: day.date,
      durationMinutes: serializedEndMinutes - startMinutes,
      endsAt: minutesToTime(serializedEndMinutes),
      ...(activeTimeSelection?.specialistId ? { specialistId: activeTimeSelection.specialistId } : {}),
      startsAt: minutesToTime(startMinutes),
    } satisfies CalendarTimeSelection;
  }

  function isCalendarSurface(target: EventTarget | null) {
    return target instanceof Element && !target.closest(
      "button, a, input, select, textarea, [draggable='true'], .admin-calendar-block-overlay",
    );
  }

  function findTouch(touches: ReactTouchEvent<HTMLElement>["touches"], identifier: number) {
    for (let index = 0; index < touches.length; index += 1) {
      if (touches[index]?.identifier === identifier) return touches[index];
    }

    return undefined;
  }

  const clearTouchGesture = useCallback(() => {
    const gesture = touchGestureRef.current;
    if (gesture?.timer) clearTimeout(gesture.timer);
    touchGestureRef.current = null;
  }, []);

  const cancelTouchSelection = useCallback(() => {
    clearTouchGesture();
    if (!selectionDraftRef.current) return;
    selectionDraftRef.current = null;
    setSelectionDraft(null);
  }, [clearTouchGesture]);

  function completeTimeSelection(
    draft: NonNullable<typeof selectionDraft>,
    currentMinutes: number,
  ) {
    const movedToAnotherSlot = currentMinutes !== draft.anchorMinutes;
    const bounds = movedToAnotherSlot
      ? selectionBounds(draft.anchorMinutes, currentMinutes)
      : {
          endMinutes: Math.min(dayEndMinutes, draft.anchorMinutes + draft.defaultDurationMinutes),
          startMinutes: draft.anchorMinutes,
        };
    setDraft(null);
    onSelectTimeRange?.(serializeSelection(bounds.startMinutes, bounds.endMinutes));
  }

  function startPersistentResize(event: PointerEvent<HTMLButtonElement>, edge: "start" | "end") {
    if (!canSelectTime || !activeTimeSelection || activeTimeSelection.date !== day.date) return;

    const startMinutes = timeToMinutes(activeTimeSelection.startsAt);
    const endMinutes = activeTimeSelection.endsAt === "23:59"
      ? dayEndMinutes
      : timeToMinutes(activeTimeSelection.endsAt);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActiveResizeDraft({
      edge,
      endMinutes,
      originalEndMinutes: endMinutes,
      originalStartMinutes: startMinutes,
      pointerId: event.pointerId,
      startMinutes,
    });
  }

  function updatePersistentResize(event: PointerEvent<HTMLButtonElement>) {
    const draft = resizeDraftRef.current;
    const timeColumn = timeColumnRef.current;
    if (!draft || !timeColumn || draft.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const pointerTime = clientYToMinutes(event.clientY, timeColumn, true);
    const nextDraft = draft.edge === "start"
      ? {
          ...draft,
          startMinutes: Math.min(draft.endMinutes - CALENDAR_SNAP_MINUTES, pointerTime),
        }
      : {
          ...draft,
          endMinutes: Math.max(draft.startMinutes + CALENDAR_SNAP_MINUTES, pointerTime),
        };

    if (
      nextDraft.startMinutes === draft.startMinutes
      && nextDraft.endMinutes === draft.endMinutes
    ) return;
    setActiveResizeDraft(nextDraft);
    onSelectTimeRange?.(serializeSelection(nextDraft.startMinutes, nextDraft.endMinutes));
  }

  function finishPersistentResize(event: PointerEvent<HTMLButtonElement>) {
    const draft = resizeDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    setActiveResizeDraft(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onSelectTimeRange?.(serializeSelection(draft.startMinutes, draft.endMinutes));
  }

  function cancelPersistentResize(event: PointerEvent<HTMLButtonElement>) {
    const draft = resizeDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    event.stopPropagation();
    onSelectTimeRange?.(serializeSelection(draft.originalStartMinutes, draft.originalEndMinutes));
    setActiveResizeDraft(null);
  }

  function losePersistentResize(event: PointerEvent<HTMLButtonElement>) {
    const draft = resizeDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    onSelectTimeRange?.(serializeSelection(draft.originalStartMinutes, draft.originalEndMinutes));
    setActiveResizeDraft(null);
  }

  function resizePersistentSelectionWithKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    edge: "start" | "end",
  ) {
    if (!activeTimeSelection || activeTimeSelection.date !== day.date) return;

    const startMinutes = timeToMinutes(activeTimeSelection.startsAt);
    const endMinutes = activeTimeSelection.endsAt === "23:59"
      ? dayEndMinutes
      : timeToMinutes(activeTimeSelection.endsAt);
    const keyboardStep = event.key === "PageUp" || event.key === "PageDown"
      ? 60
      : CALENDAR_SNAP_MINUTES;
    let nextMinutes: number;

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      nextMinutes = (edge === "start" ? startMinutes : endMinutes) - keyboardStep;
    } else if (event.key === "ArrowDown" || event.key === "PageDown") {
      nextMinutes = (edge === "start" ? startMinutes : endMinutes) + keyboardStep;
    } else if (event.key === "Home") {
      nextMinutes = edge === "start" ? dayStartMinutes : startMinutes + CALENDAR_SNAP_MINUTES;
    } else if (event.key === "End") {
      nextMinutes = edge === "start" ? endMinutes - CALENDAR_SNAP_MINUTES : dayEndMinutes;
    } else {
      return;
    }

    event.preventDefault();
    const nextStartMinutes = edge === "start"
      ? Math.max(dayStartMinutes, Math.min(endMinutes - CALENDAR_SNAP_MINUTES, nextMinutes))
      : startMinutes;
    const nextEndMinutes = edge === "end"
      ? Math.min(dayEndMinutes, Math.max(startMinutes + CALENDAR_SNAP_MINUTES, nextMinutes))
      : endMinutes;
    if (nextStartMinutes === startMinutes && nextEndMinutes === endMinutes) return;
    onSelectTimeRange?.(serializeSelection(nextStartMinutes, nextEndMinutes));
  }

  function startTimeSelection(event: PointerEvent<HTMLElement>) {
    if (
      !canSelectTime
      || event.button !== 0
      || event.pointerType === "touch"
      || !isCalendarSurface(event.target)
    ) return;

    const anchorMinutes = pointerMinutes(event, false);
    const bounds = selectionBounds(anchorMinutes, anchorMinutes);
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraft({ anchorMinutes, defaultDurationMinutes: 60, pointerId: event.pointerId, ...bounds });
  }

  function updateTimeSelection(event: PointerEvent<HTMLElement>) {
    const draft = selectionDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;

    event.preventDefault();
    const bounds = selectionBounds(draft.anchorMinutes, pointerMinutes(event, true));
    if (bounds.startMinutes === draft.startMinutes && bounds.endMinutes === draft.endMinutes) return;
    setDraft({ ...draft, ...bounds });
  }

  function finishTimeSelection(event: PointerEvent<HTMLElement>) {
    const draft = selectionDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    completeTimeSelection(draft, pointerMinutes(event, true));
  }

  function cancelTimeSelection(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const draft = selectionDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    setDraft(null);
  }

  function startTouchSelection(event: ReactTouchEvent<HTMLElement>) {
    if (!canSelectTime) return;
    if (event.touches.length !== 1) {
      cancelTouchSelection();
      return;
    }
    if (!isCalendarSurface(event.target)) return;

    const touch = event.changedTouches[0] ?? event.touches[0];
    if (!touch) return;

    clearTouchGesture();
    const anchorMinutes = clientYToMinutes(touch.clientY, event.currentTarget, false);
    const gesture = {
      identifier: touch.identifier,
      mode: "pending" as const,
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      timer: null as ReturnType<typeof setTimeout> | null,
    };
    touchGestureRef.current = gesture;
    setDraft({
      anchorMinutes,
      defaultDurationMinutes: 30,
      pointerId: touch.identifier,
      endMinutes: Math.min(dayEndMinutes, anchorMinutes + 30),
      startMinutes: anchorMinutes,
    });
    gesture.timer = setTimeout(() => {
      const currentGesture = touchGestureRef.current;
      if (!currentGesture || currentGesture.identifier !== touch.identifier) return;
      currentGesture.mode = "selecting";
      currentGesture.timer = null;
    }, TOUCH_SELECTION_DRAG_DELAY_MS);
  }

  function updateTouchSelection(event: ReactTouchEvent<HTMLElement>) {
    if (event.touches.length !== 1) {
      cancelTouchSelection();
      return;
    }
    const gesture = touchGestureRef.current;
    const draft = selectionDraftRef.current;
    if (!gesture || !draft || draft.pointerId !== gesture.identifier) return;
    const touch = findTouch(event.touches, gesture.identifier);
    if (!touch) return;

    const movedX = touch.clientX - gesture.startClientX;
    const movedY = touch.clientY - gesture.startClientY;
    const movedDistance = Math.hypot(movedX, movedY);
    const isHorizontalSwipe = Math.abs(movedX) > Math.abs(movedY);
    if (
      movedDistance >= TOUCH_SWIPE_THRESHOLD_PX
      && (gesture.mode === "pending" || isHorizontalSwipe)
    ) {
      cancelTouchSelection();
      return;
    }
    if (gesture.mode !== "selecting") return;

    const currentMinutes = clientYToMinutes(touch.clientY, event.currentTarget, true);
    const bounds = currentMinutes === draft.anchorMinutes
      ? {
          endMinutes: Math.min(dayEndMinutes, draft.anchorMinutes + draft.defaultDurationMinutes),
          startMinutes: draft.anchorMinutes,
        }
      : selectionBounds(draft.anchorMinutes, currentMinutes);
    if (bounds.startMinutes === draft.startMinutes && bounds.endMinutes === draft.endMinutes) return;
    setDraft({ ...draft, ...bounds });
  }

  function finishTouchSelection(event: ReactTouchEvent<HTMLElement>) {
    if (event.touches.length > 0) {
      cancelTouchSelection();
      return;
    }
    const gesture = touchGestureRef.current;
    const draft = selectionDraftRef.current;
    if (!gesture || !draft || draft.pointerId !== gesture.identifier) return;
    const touch = findTouch(event.changedTouches, gesture.identifier);
    if (!touch) return;

    clearTouchGesture();
    completeTimeSelection(
      draft,
      clientYToMinutes(touch.clientY, event.currentTarget, true),
    );
  }

  function preventSelectionContextMenu(event: MouseEvent<HTMLElement>) {
    if (canSelectTime && isCalendarSurface(event.target)) event.preventDefault();
  }

  useEffect(() => {
    const timeColumn = timeColumnRef.current;
    const cancelActiveMultiTouch = (event: globalThis.TouchEvent) => {
      if (event.touches.length > 1 && touchGestureRef.current) cancelTouchSelection();
    };
    const preventActiveTouchScroll = (event: globalThis.TouchEvent) => {
      const gesture = touchGestureRef.current;
      const draft = selectionDraftRef.current;
      if (!gesture || !draft || draft.pointerId !== gesture.identifier) return;

      for (let index = 0; index < event.touches.length; index += 1) {
        const touch = event.touches[index];
        if (touch?.identifier === gesture.identifier) {
          const movedX = touch.clientX - gesture.startClientX;
          const movedY = touch.clientY - gesture.startClientY;
          const movedDistance = Math.hypot(movedX, movedY);
          if (movedDistance < TOUCH_SWIPE_THRESHOLD_PX) return;
          if (Math.abs(movedX) > Math.abs(movedY)) {
            cancelTouchSelection();
            return;
          }
          if (gesture.mode !== "selecting") return;
          event.preventDefault();
          return;
        }
      }
    };
    document.addEventListener("touchstart", cancelActiveMultiTouch, { capture: true, passive: true });
    timeColumn?.addEventListener("touchmove", preventActiveTouchScroll, { passive: false });

    return () => {
      document.removeEventListener("touchstart", cancelActiveMultiTouch, true);
      timeColumn?.removeEventListener("touchmove", preventActiveTouchScroll);
      const gesture = touchGestureRef.current;
      if (gesture?.timer) clearTimeout(gesture.timer);
    };
  }, [cancelTouchSelection]);

  const persistedSelection = activeTimeSelection?.date === day.date
    ? {
        endMinutes: activeTimeSelection.endsAt === "23:59"
          ? dayEndMinutes
          : timeToMinutes(activeTimeSelection.endsAt),
        startMinutes: timeToMinutes(activeTimeSelection.startsAt),
      }
    : null;
  const visibleSelection = selectionDraft ?? resizeDraft ?? persistedSelection;
  const isPersistentSelection = !selectionDraft && Boolean(persistedSelection);
  const visibleSelectionEndLabel = visibleSelection?.endMinutes === dayEndMinutes && isPersistentSelection
    ? "23:59"
    : visibleSelection
      ? minutesToTime(visibleSelection.endMinutes)
      : "";
  const selectionStyle = visibleSelection
    ? {
        height: `${Math.max(
          18,
          ((visibleSelection.endMinutes - visibleSelection.startMinutes) / 60) * CALENDAR_HOUR_HEIGHT - 2,
        )}px`,
        top: `${((visibleSelection.startMinutes - dayStartMinutes) / 60) * CALENDAR_HOUR_HEIGHT}px`,
      }
    : undefined;

  return (
    <section
      aria-label={day.ariaLabel}
      className={[
        "admin-calendar-time-column",
        canSelectTime ? "is-time-selectable" : "",
        visibleSelection ? "is-selecting-time" : "",
        day.className,
      ].filter(Boolean).join(" ")}
      onContextMenu={preventSelectionContextMenu}
      onDragOver={(event) => onDragOverAppointment(event, day.date)}
      onDrop={(event) => onDropAppointment(event, day.date)}
      onPointerCancel={cancelTimeSelection}
      onPointerDown={startTimeSelection}
      onPointerMove={updateTimeSelection}
      onPointerUp={finishTimeSelection}
      onTouchCancel={cancelTouchSelection}
      onTouchEnd={finishTouchSelection}
      onTouchMove={updateTouchSelection}
      onTouchStart={startTouchSelection}
      ref={timeColumnRef}
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
      {visibleSelection && selectionStyle ? (
        <>
          <div
            aria-label={`Выбран интервал ${minutesToTime(visibleSelection.startMinutes)} - ${visibleSelectionEndLabel}`}
            className={`admin-calendar-time-selection${isPersistentSelection ? " is-persistent" : ""}`}
            style={selectionStyle}
          >
            <strong>
              {minutesToTime(visibleSelection.startMinutes)} - {visibleSelectionEndLabel}
            </strong>
            <span>{isPersistentSelection ? "Выбранное время" : "Новый интервал"}</span>
            {isPersistentSelection ? (
              <>
                <button
                  aria-orientation="vertical"
                  aria-label="Изменить начало интервала"
                  aria-valuemax={visibleSelection.endMinutes - CALENDAR_SNAP_MINUTES}
                  aria-valuemin={dayStartMinutes}
                  aria-valuenow={visibleSelection.startMinutes}
                  aria-valuetext={minutesToTime(visibleSelection.startMinutes)}
                  className="admin-calendar-time-selection-handle is-start"
                  onKeyDown={(event) => resizePersistentSelectionWithKeyboard(event, "start")}
                  onLostPointerCapture={losePersistentResize}
                  onPointerCancel={cancelPersistentResize}
                  onPointerDown={(event) => startPersistentResize(event, "start")}
                  onPointerMove={updatePersistentResize}
                  onPointerUp={finishPersistentResize}
                  role="slider"
                  type="button"
                />
                <button
                  aria-orientation="vertical"
                  aria-label="Изменить конец интервала"
                  aria-valuemax={dayEndMinutes}
                  aria-valuemin={visibleSelection.startMinutes + CALENDAR_SNAP_MINUTES}
                  aria-valuenow={visibleSelection.endMinutes}
                  aria-valuetext={visibleSelectionEndLabel}
                  className="admin-calendar-time-selection-handle is-end"
                  onKeyDown={(event) => resizePersistentSelectionWithKeyboard(event, "end")}
                  onLostPointerCapture={losePersistentResize}
                  onPointerCancel={cancelPersistentResize}
                  onPointerDown={(event) => startPersistentResize(event, "end")}
                  onPointerMove={updatePersistentResize}
                  onPointerUp={finishPersistentResize}
                  role="slider"
                  type="button"
                />
              </>
            ) : null}
          </div>
          <p aria-live="polite" className="sr-only" role="status">
            Выбран интервал {minutesToTime(visibleSelection.startMinutes)} - {visibleSelectionEndLabel}
          </p>
        </>
      ) : null}
      {laidOutAppointments.map(({ appointment, layout }) => renderAppointment(appointment, compact, layout))}
      {dragPreview?.date === day.date ? renderAppointment(dragPreview, compact, undefined, true) : null}
    </section>
  );
}

export function TimeGrid({
  activeTimeSelection,
  days,
  dragPreview,
  isInteractionLocked = false,
  mode,
  onDragOverAppointment,
  onDropAppointment,
  onSelectTimeRange,
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
              activeTimeSelection={activeTimeSelection}
              compact
              day={day}
              dragPreview={dragPreview}
              isInteractionLocked={isInteractionLocked}
              key={day.date}
              onDragOverAppointment={onDragOverAppointment}
              onDropAppointment={onDropAppointment}
              onSelectTimeRange={onSelectTimeRange}
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
          activeTimeSelection={activeTimeSelection}
          compact={false}
          day={day}
          dragPreview={dragPreview}
          isInteractionLocked={isInteractionLocked}
          key={day.date}
          onDragOverAppointment={onDragOverAppointment}
          onDropAppointment={onDropAppointment}
          onSelectTimeRange={onSelectTimeRange}
          renderAppointment={renderAppointment}
        />
      ) : null}
    </div>
  );
}
