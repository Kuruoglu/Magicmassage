import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import type { Appointment } from "@/admin/domain";

import {
  CALENDAR_DAY_END,
  CALENDAR_HOUR_HEIGHT,
} from "./constants";
import {
  CALENDAR_SNAP_MINUTES,
  MIN_APPOINTMENT_DURATION_MINUTES,
  snapMinutes,
  timeToMinutes,
} from "./time";

type AppointmentResizeHandleProps = {
  appointment: Appointment;
  disabled?: boolean;
  onActivate?: () => void;
  onInteractionChange?: (isResizing: boolean) => void;
  onPreview: (deltaMinutes: number) => void;
  onResize: (appointment: Appointment, deltaMinutes: number) => void;
  useWholeCardTarget?: boolean;
};

type ResizeDragState = {
  hasMoved: boolean;
  pointerId: number;
  startY: number;
};

const minimumResizeMovementPixels =
  (CALENDAR_HOUR_HEIGHT * CALENDAR_SNAP_MINUTES) / 60 / 2;

export function AppointmentResizeHandle({
  appointment,
  disabled = false,
  onActivate,
  onInteractionChange,
  onPreview,
  onResize,
  useWholeCardTarget = false,
}: AppointmentResizeHandleProps) {
  const dragState = useRef<ResizeDragState | null>(null);
  const latestDeltaMinutes = useRef(0);
  const interactionChangeRef = useRef(onInteractionChange);
  const [previewDeltaMinutes, setPreviewDeltaMinutes] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const duration = appointment.durationMinutes ?? 60;
  const availableMinutes = timeToMinutes(CALENDAR_DAY_END) - timeToMinutes(appointment.time);
  const maximumDuration = Math.max(
    MIN_APPOINTMENT_DURATION_MINUTES,
    Math.floor(availableMinutes / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES,
  );
  const ariaMaximumDuration = Math.max(duration, maximumDuration);
  const previewDuration = duration + previewDeltaMinutes;

  useEffect(() => {
    interactionChangeRef.current = onInteractionChange;
  }, [onInteractionChange]);

  useEffect(
    () => () => {
      if (!dragState.current) return;

      dragState.current = null;
      interactionChangeRef.current?.(false);
    },
    [],
  );

  function clampDelta(deltaMinutes: number) {
    const snappedDelta = snapMinutes(deltaMinutes);

    if (snappedDelta === 0) return 0;

    const minimumDelta = MIN_APPOINTMENT_DURATION_MINUTES - duration;
    const maximumDelta = Math.max(0, maximumDuration - duration);
    return Math.min(maximumDelta, Math.max(minimumDelta, snappedDelta));
  }

  function updatePreview(deltaMinutes: number) {
    const clampedDelta = clampDelta(deltaMinutes);
    latestDeltaMinutes.current = clampedDelta;
    setPreviewDeltaMinutes(clampedDelta);
    onPreview(clampedDelta);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    onInteractionChange?.(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragState.current = { hasMoved: false, pointerId: event.pointerId, startY: event.clientY };
    setIsResizing(true);
    updatePreview(0);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const currentDrag = dragState.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    if (Math.abs(event.clientY - currentDrag.startY) >= minimumResizeMovementPixels) {
      currentDrag.hasMoved = true;
    }
    const minuteDelta = ((event.clientY - currentDrag.startY) / CALENDAR_HOUR_HEIGHT) * 60;
    updatePreview(minuteDelta);
  }

  function finishPointerResize(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const currentDrag = dragState.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const deltaMinutes = latestDeltaMinutes.current;
    const shouldActivate = commit && !currentDrag.hasMoved && deltaMinutes === 0;
    dragState.current = null;
    setIsResizing(false);
    onInteractionChange?.(false);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    updatePreview(0);

    if (shouldActivate) {
      onActivate?.();
    } else if (commit && deltaMinutes !== 0) {
      onResize(appointment, deltaMinutes);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;

    let deltaMinutes: number | null = null;

    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      deltaMinutes = CALENDAR_SNAP_MINUTES;
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      deltaMinutes = -CALENDAR_SNAP_MINUTES;
    } else if (event.key === "Home") {
      deltaMinutes = MIN_APPOINTMENT_DURATION_MINUTES - duration;
    } else if (event.key === "End") {
      deltaMinutes = ariaMaximumDuration - duration;
    }

    if (deltaMinutes === null) return;

    event.preventDefault();
    event.stopPropagation();
    const clampedDelta = clampDelta(deltaMinutes);

    if (clampedDelta !== 0) {
      onResize(appointment, clampedDelta);
    }
  }

  function preventAppointmentDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      aria-label={`Длительность ${duration} минут`}
      className={`admin-timed-appointment-resize${useWholeCardTarget ? " uses-whole-card-target" : ""}${isResizing ? " is-resizing" : ""}`}
    >
      <div
        aria-disabled={disabled || undefined}
        aria-label="Изменить длительность записи"
        aria-orientation="vertical"
        aria-valuemax={ariaMaximumDuration}
        aria-valuemin={MIN_APPOINTMENT_DURATION_MINUTES}
        aria-valuenow={previewDuration}
        aria-valuetext={`${previewDuration} минут`}
        className="admin-timed-appointment-resize-grip"
        draggable={false}
        onDragStart={preventAppointmentDrag}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={(event) => finishPointerResize(event, false)}
        onPointerCancel={(event) => finishPointerResize(event, false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointerResize(event, true)}
        role="slider"
        tabIndex={disabled ? -1 : 0}
      >
        <span aria-hidden="true" />
      </div>
      {previewDeltaMinutes !== 0 ? (
        <output aria-live="polite">{duration + previewDeltaMinutes} мин</output>
      ) : null}
    </div>
  );
}
