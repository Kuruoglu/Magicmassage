import { useRef, useState, type PointerEvent } from "react";

import type { Appointment } from "@/admin/domain";

import { CALENDAR_HOUR_HEIGHT } from "./constants";
import { snapMinutes } from "./time";

type AppointmentResizeHandleProps = {
  appointment: Appointment;
  disabled?: boolean;
  onPreview: (deltaMinutes: number) => void;
  onResize: (appointment: Appointment, deltaMinutes: number) => void;
};

type ResizeDragState = {
  pointerId: number;
  startY: number;
};

export function AppointmentResizeHandle({
  appointment,
  disabled = false,
  onPreview,
  onResize,
}: AppointmentResizeHandleProps) {
  const dragState = useRef<ResizeDragState | null>(null);
  const latestDeltaMinutes = useRef(0);
  const [previewDeltaMinutes, setPreviewDeltaMinutes] = useState(0);

  function updatePreview(deltaMinutes: number) {
    latestDeltaMinutes.current = deltaMinutes;
    setPreviewDeltaMinutes(deltaMinutes);
    onPreview(deltaMinutes);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragState.current = { pointerId: event.pointerId, startY: event.clientY };
    updatePreview(0);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = dragState.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    const minuteDelta = ((event.clientY - currentDrag.startY) / CALENDAR_HOUR_HEIGHT) * 60;
    const snappedDelta = snapMinutes(minuteDelta);
    const minimumDelta = 15 - (appointment.durationMinutes ?? 60);
    updatePreview(Math.max(minimumDelta, snappedDelta));
  }

  function finishPointerResize(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const currentDrag = dragState.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const deltaMinutes = latestDeltaMinutes.current;
    dragState.current = null;
    updatePreview(0);

    if (commit && deltaMinutes !== 0) {
      onResize(appointment, deltaMinutes);
    }
  }

  return (
    <div
      className="admin-timed-appointment-resize"
      aria-label={`Длительность ${appointment.durationMinutes ?? 60} минут`}
      style={{ display: "grid" }}
    >
      <button
        aria-label="Изменить длительность перетаскиванием вверх или вниз"
        className="admin-timed-appointment-resize-grip"
        disabled={disabled}
        onPointerCancel={(event) => finishPointerResize(event, false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointerResize(event, true)}
        style={{ cursor: "ns-resize", touchAction: "none" }}
        type="button"
      >
        ↕
      </button>
      {previewDeltaMinutes !== 0 ? (
        <output aria-live="polite">
          {Math.max(15, (appointment.durationMinutes ?? 60) + previewDeltaMinutes)} мин
        </output>
      ) : null}
      <button
        aria-label="Уменьшить длительность на 15 минут"
        disabled={disabled || (appointment.durationMinutes ?? 60) <= 15}
        onClick={() => onResize(appointment, -15)}
        type="button"
      >
        −
      </button>
      <button
        aria-label="Увеличить длительность на 15 минут"
        disabled={disabled}
        onClick={() => onResize(appointment, 15)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
