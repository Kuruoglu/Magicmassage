"use client";

import Link from "next/link";
import { type CSSProperties, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { AdminRoleId } from "@/admin/config";
import {
  appointmentBelongsToClient,
  findAppointmentClient,
  findClientByIdentity,
  type Appointment,
  type CalendarBlock,
  type ClientRecord,
  type SpecialistRecord,
} from "@/admin/domain";
import type { AdminAuditAction } from "@/admin/persistence";
import { matchesSearch } from "@/components/admin/lib/filters";
import { statusClass } from "@/components/admin/lib/formatters";
import { adminSectionHref, appointmentKey, clientProfileHref } from "@/components/admin/lib/links";

import { AppointmentBlock, clampAppointmentDurationToDay } from "./AppointmentBlock";
import { AppointmentDetailDrawer } from "./AppointmentDetailDrawer";
import { CalendarToolbar } from "./CalendarToolbar";
import {
  CALENDAR_DAY_END,
  CALENDAR_DAY_START,
  CALENDAR_HOUR_HEIGHT,
  CALENDAR_WEEKDAY_LABELS,
  type CalendarMode,
} from "./constants";
import { DayCalendar } from "./DayCalendar";
import {
  addDays,
  generateMonthGrid,
  isIsoDate,
  navigatePeriod,
  startOfWeek,
} from "./date";
import {
  appointmentCountLabel,
  calendarHeadingLabel,
  compactAppointmentCountLabel,
  compactFreeSlotLabel,
  formatCalendarDay,
  freeSlotCount,
  freeSlotLabel,
  manualAppointmentOverflow,
  slotCountLabel,
  sortAppointments,
} from "./format";
import {
  appointmentsOverlap,
  hasAppointmentOverlap,
  isSchedulingBlockingStatus,
} from "./conflicts";
import type { AppointmentOverlapLayout } from "./TimeGrid";
import {
  classifyAppointmentAgainstSchedule,
  createCalendarWorkingSchedule,
  getCalendarIsoDate,
  type CalendarScheduleSettings,
} from "./schedule";
import {
  CALENDAR_SNAP_MINUTES,
  MIN_APPOINTMENT_DURATION_MINUTES,
  minutesToTime,
  positionToTime,
  snapMinutes,
  timeToMinutes,
} from "./time";
import { WeekCalendar } from "./WeekCalendar";

export type CalendarAppointmentFocus = {
  appointmentKey: string;
  date: string;
  routeDate?: string;
};

export type CalendarAppointmentSaveResult =
  | { ok: true; version?: number }
  | {
      message: string;
      ok: false;
    };

type PendingCalendarConflict = {
  action: "appointment.drag" | "appointment.resize";
  appointment: Appointment;
  conflictingAppointment: Appointment;
  originalAppointment: Appointment;
};

type AppointmentDragPreview = {
  appointment: Appointment;
  originalKey: string;
};

export type CalendarWorkspaceProps = {
  actorUserId?: string;
  appointments: Appointment[];
  bookingBufferMinutes: number;
  calendarBlocks?: CalendarBlock[];
  canManageBlocks: boolean;
  clients: ClientRecord[];
  dailySlotCapacity: number;
  onCancelAppointment: (appointment: Appointment) => void;
  onCreateCalendarBlock?: (date: string) => void;
  onDeleteCalendarBlock?: (block: CalendarBlock) => void;
  onCalendarDateChange: (date: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
  onEditCalendarBlock?: (block: CalendarBlock) => void;
  onSaveAppointment: (
    appointment: Appointment,
    action?: AdminAuditAction,
    originalAppointment?: Appointment,
  ) => Promise<CalendarAppointmentSaveResult>;
  query: string;
  role: AdminRoleId;
  selectedAppointmentFocus?: CalendarAppointmentFocus;
  selectedCalendarDate?: string;
  selectedClientName?: string;
  siteSettings: CalendarScheduleSettings;
  specialists?: SpecialistRecord[];
  currentSpecialistId?: string;
};

function isFullDayCalendarBlock(block: CalendarBlock) {
  return block.startsAt === "00:00" && (block.endsAt === "23:59" || block.endsAt === "24:00");
}

function calendarBlockKindLabel(block: CalendarBlock) {
  if (block.kind === "personal") return "Личное время";
  if (block.kind === "unavailable") return "Недоступно";
  return "Другое";
}

function calendarBlockCountLabel(count: number) {
  if (count === 1) return "1 блокировка";
  if (count > 1 && count < 5) return `${count} блокировки`;
  return `${count} блокировок`;
}

function monthAvailabilityLabels(
  blocks: CalendarBlock[],
  freeCount: number,
  manualOverflow: number,
) {
  if (blocks.some(isFullDayCalendarBlock)) {
    return { compact: "Недоступно", full: "Недоступно весь день" };
  }

  if (manualOverflow > 0) {
    if (blocks.length > 0) {
      return {
        compact: "Ограничено",
        full: `Ограничено: ${calendarBlockCountLabel(blocks.length)}; +${manualOverflow} вручную`,
      };
    }

    return { compact: `+${manualOverflow} ручн.`, full: `+${manualOverflow} вручную` };
  }

  if (blocks.length > 0) {
    const capacityLabel = freeCount > 0 ? `${freeCount} по дневному лимиту` : "дневной лимит исчерпан";
    return {
      compact: "Ограничено",
      full: `Ограничено: ${calendarBlockCountLabel(blocks.length)}, ${capacityLabel}`,
    };
  }

  return { compact: compactFreeSlotLabel(freeCount), full: freeSlotLabel(freeCount) };
}

function CalendarBlockScheduleItem({
  block,
  canEdit,
  compact,
  onEdit,
}: {
  block: CalendarBlock;
  canEdit: boolean;
  compact: boolean;
  onEdit?: (block: CalendarBlock) => void;
}) {
  const dayStartMinutes = timeToMinutes(CALENDAR_DAY_START);
  const dayEndMinutes = timeToMinutes(CALENDAR_DAY_END);
  const blockStartMinutes = Math.min(
    dayEndMinutes,
    Math.max(dayStartMinutes, timeToMinutes(block.startsAt)),
  );
  const rawEndMinutes = isFullDayCalendarBlock(block)
    ? dayEndMinutes
    : timeToMinutes(block.endsAt);
  const blockEndMinutes = Math.min(dayEndMinutes, Math.max(blockStartMinutes, rawEndMinutes));
  const top = ((blockStartMinutes - dayStartMinutes) / 60) * CALENDAR_HOUR_HEIGHT;
  const height = Math.max(
    24,
    ((blockEndMinutes - blockStartMinutes) / 60) * CALENDAR_HOUR_HEIGHT - 2,
  );
  const kindLabel = calendarBlockKindLabel(block);
  const timeLabel = isFullDayCalendarBlock(block)
    ? "Весь день"
    : `${block.startsAt} - ${block.endsAt}`;
  const style = {
    background: "rgba(255, 248, 230, 0.94)",
    border: "1px solid #b37719",
    borderLeft: "4px solid #b37719",
    borderRadius: "6px",
    color: "#68430a",
    display: "grid",
    gap: "2px",
    height: `${height}px`,
    left: compact ? "2px" : "4px",
    overflow: "hidden",
    padding: compact ? "3px 4px" : "6px 8px",
    pointerEvents: canEdit ? "auto" : "none",
    position: "absolute",
    right: compact ? "2px" : "4px",
    top: `${top}px`,
    zIndex: 2,
  } satisfies CSSProperties;

  const content = (
    <>
      <strong style={{ fontSize: compact ? "0.68rem" : "0.78rem", lineHeight: 1.2 }}>{timeLabel}</strong>
      <span
        style={{
          fontSize: compact ? "0.62rem" : "0.72rem",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {kindLabel}
        {block.specialistName ? ` · ${block.specialistName}` : ""}
        {block.internalNote && !compact ? ` · ${block.internalNote}` : ""}
      </span>
    </>
  );

  const label = `Недоступное время: ${timeLabel}, ${kindLabel}${block.specialistName ? `, ${block.specialistName}` : ""}${block.internalNote ? `, ${block.internalNote}` : ""}`;
  return canEdit ? (
    <button
      aria-label={`${label}. Изменить`}
      className="admin-calendar-block-overlay is-interactive"
      onClick={() => onEdit?.(block)}
      style={style}
      type="button"
    >
      {content}
    </button>
  ) : (
    <article aria-label={label} className="admin-calendar-block-overlay" role="listitem" style={style}>
      {content}
    </article>
  );
}

export function CalendarWorkspace({
  appointments,
  bookingBufferMinutes,
  calendarBlocks = [],
  canManageBlocks,
  clients,
  dailySlotCapacity,
  onCancelAppointment,
  onCreateCalendarBlock,
  onDeleteCalendarBlock,
  onCalendarDateChange,
  onEditAppointment,
  onEditCalendarBlock,
  onSaveAppointment,
  query,
  role,
  selectedAppointmentFocus,
  selectedCalendarDate,
  selectedClientName,
  siteSettings,
  specialists = [],
  currentSpecialistId,
}: CalendarWorkspaceProps) {
  const calendarViewRef = useRef<HTMLDivElement>(null);
  const [blockOverlayTargets, setBlockOverlayTargets] = useState<HTMLElement[]>([]);
  const workingSchedule = useMemo(
    () => createCalendarWorkingSchedule(siteSettings),
    [siteSettings],
  );
  const activeSpecialists = useMemo(
    () => specialists
      .filter((specialist) => specialist.status === "active")
      .sort((first, second) => first.displayOrder - second.displayOrder),
    [specialists],
  );
  const [selectedSpecialistId, setSelectedSpecialistId] = useState(
    role === "specialist" ? (currentSpecialistId ?? activeSpecialists[0]?.id ?? "all") : "all",
  );
  const effectiveSpecialistId = role === "specialist"
    ? (currentSpecialistId ?? selectedSpecialistId)
    : selectedSpecialistId;
  const specialistScopedAppointments = effectiveSpecialistId === "all"
    ? appointments
    : appointments.filter((appointment) => appointment.specialistId === effectiveSpecialistId);
  const specialistScopedBlocks = effectiveSpecialistId === "all"
    ? calendarBlocks
    : calendarBlocks.filter((block) => block.specialistId === effectiveSpecialistId);
  const selectedSpecialist = activeSpecialists.find(
    (specialist) => specialist.id === effectiveSpecialistId,
  );
  const selectedClientFilter = findClientByIdentity(clients, selectedClientName);
  const selectedClientFilterName = selectedClientFilter?.name;
  const clientScopedAppointments = selectedClientFilterName
    ? specialistScopedAppointments.filter((appointment) => appointmentBelongsToClient(appointment, selectedClientFilter, clients))
    : specialistScopedAppointments;
  const fallbackAppointment = specialistScopedAppointments[0] ?? {
    client: "Нет записи",
    date: getCalendarIsoDate(workingSchedule),
    durationMinutes: 60,
    note: "",
    service: "Не выбрано",
    status: "Новая заявка" as const,
    time: "00:00",
  };
  const filteredAppointments = clientScopedAppointments.filter((appointment) =>
    matchesSearch(
      [appointment.date, appointment.time, appointment.client, appointment.service, appointment.specialistName, appointment.status, appointment.note],
      query,
    ),
  );
  const initialSelectedDate =
    selectedAppointmentFocus?.date ??
    (selectedCalendarDate && isIsoDate(selectedCalendarDate)
      ? selectedCalendarDate
      : (sortAppointments(filteredAppointments)[0]?.date ?? getCalendarIsoDate(workingSchedule)));
  const initialSelectedAppointment = selectedAppointmentFocus
    ? filteredAppointments.find(
        (appointment) => appointmentKey(appointment) === selectedAppointmentFocus.appointmentKey,
      )
    : selectedCalendarDate && isIsoDate(selectedCalendarDate)
      ? filteredAppointments.find((appointment) => appointment.date === initialSelectedDate)
      : filteredAppointments[0];
  const [mode, setMode] = useState<CalendarMode>("day");
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [isAppointmentDrawerOpen, setIsAppointmentDrawerOpen] = useState(Boolean(selectedAppointmentFocus));
  const [draggedAppointmentKey, setDraggedAppointmentKey] = useState("");
  const [resizingAppointmentKey, setResizingAppointmentKey] = useState("");
  const [appointmentDragPreview, setAppointmentDragPreview] = useState<AppointmentDragPreview | null>(null);
  const appointmentDragGrabOffsetRef = useRef(0);
  const nativeDragImageRef = useRef<HTMLElement | null>(null);
  const pendingAppointmentKeysRef = useRef(new Set<string>());
  const [selectedKey, setSelectedKey] = useState(
    () => selectedAppointmentFocus?.appointmentKey ?? appointmentKey(initialSelectedAppointment ?? fallbackAppointment),
  );
  const [pendingAppointmentKeys, setPendingAppointmentKeys] = useState<Set<string>>(() => new Set());
  const [calendarError, setCalendarError] = useState("");
  const [pendingConflict, setPendingConflict] = useState<PendingCalendarConflict | null>(null);
  const [overlapOverrideReason, setOverlapOverrideReason] = useState("");
  const selectedDayAppointments = sortAppointments(
    filteredAppointments.filter((appointment) => appointment.date === selectedDate),
  );
  const selectedDayBlocks = specialistScopedBlocks
    .filter((block) => block.blockDate === selectedDate)
    .sort((first, second) => first.startsAt.localeCompare(second.startsAt));
  const selectedDayCapacityCount = specialistScopedAppointments.filter(
    (appointment) => appointment.date === selectedDate,
  ).filter(
    (appointment) => appointment.status !== "Отменена",
  ).length;
  const listAppointments = sortAppointments(filteredAppointments);
  const visibleAppointments = mode === "day" ? selectedDayAppointments : listAppointments;
  const appointmentDetailPool = mode === "day" ? selectedDayAppointments : listAppointments;
  const hasVisibleAppointments = visibleAppointments.length > 0;
  const selectedAppointment = hasVisibleAppointments
    ? (appointmentDetailPool.find((appointment) => appointmentKey(appointment) === selectedKey) ??
      appointmentDetailPool[0] ??
      fallbackAppointment)
    : fallbackAppointment;
  const selectedAppointmentKey = hasVisibleAppointments ? appointmentKey(selectedAppointment) : "";
  const calendarHeading = calendarHeadingLabel(mode, selectedDate);
  const selectedAppointmentClient = findAppointmentClient(clients, selectedAppointment);
  const shouldShowAppointmentDrawer = isAppointmentDrawerOpen && mode !== "month" && hasVisibleAppointments;
  const monthDays = generateMonthGrid(selectedDate).map((date) => ({ date, day: Number(date.slice(-2)) }));
  const selectedMonth = selectedDate.slice(0, 7);
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => ({
    date: addDays(weekStart, index),
    day: Number(addDays(weekStart, index).slice(-2)),
  }));
  const specialistCapacity = effectiveSpecialistId === "all"
    ? dailySlotCapacity * Math.max(activeSpecialists.length, 1)
    : dailySlotCapacity;
  const selectedDayFreeCount = selectedDayBlocks.some(isFullDayCalendarBlock)
    ? 0
    : freeSlotCount(selectedDayCapacityCount, specialistCapacity);

  useEffect(() => {
    if (!resizingAppointmentKey) return;

    document.body.classList.add("admin-calendar-resize-active");
    return () => document.body.classList.remove("admin-calendar-resize-active");
  }, [resizingAppointmentKey]);
  const selectedDayManualOverflow = manualAppointmentOverflow(selectedDayCapacityCount, specialistCapacity);
  const confirmedListCount = listAppointments.filter((appointment) => appointment.status === "Подтверждена").length;
  const attentionListCount = listAppointments.filter(
    (appointment) => appointment.status !== "Подтверждена" && appointment.status !== "Отменена",
  ).length;
  const canOverrideOverlap = role === "owner" || role === "administrator";

  useEffect(() => {
    const targets =
      mode === "day" || mode === "week"
        ? Array.from(
            calendarViewRef.current?.querySelectorAll<HTMLElement>(".admin-calendar-time-column") ?? [],
          )
        : [];
    setBlockOverlayTargets(targets);
  }, [mode, selectedDate]);

  useEffect(
    () => () => {
      nativeDragImageRef.current?.remove();
    },
    [],
  );

  function renderCalendarBlockOverlays(days: Array<{ date: string }>, compact: boolean) {
    return blockOverlayTargets.flatMap((target, index) => {
      const date = days[index]?.date;
      if (!date) return [];

      return specialistScopedBlocks
        .filter((block) => block.blockDate === date)
        .map((block) =>
          createPortal(
            <CalendarBlockScheduleItem
              block={block}
              canEdit={canManageBlocks}
              compact={compact}
              onEdit={onEditCalendarBlock}
            />,
            target,
            block.id,
          ),
        );
    });
  }

  function switchMode(nextMode: CalendarMode) {
    setMode(nextMode);
    setIsAppointmentDrawerOpen(false);
  }

  function movePeriod(direction: "next" | "previous") {
    const nextDate = navigatePeriod(selectedDate, mode === "list" ? "month" : mode, direction);
    const nextAppointments = filteredAppointments.filter((appointment) => appointment.date === nextDate);
    selectDate(nextDate, nextAppointments, mode);
  }

  function goToToday() {
    const today = getCalendarIsoDate(workingSchedule);
    selectDate(
      today,
      filteredAppointments.filter((appointment) => appointment.date === today),
      mode,
    );
  }

  function selectAppointment(appointment: Appointment) {
    onCalendarDateChange(appointment.date);
    setSelectedDate(appointment.date);
    setSelectedKey(appointmentKey(appointment));
    setIsAppointmentDrawerOpen(true);
  }

  function selectDate(date: string, dateAppointments: Appointment[], nextMode: CalendarMode = mode) {
    onCalendarDateChange(date);
    setSelectedDate(date);
    setMode(nextMode);
    setIsAppointmentDrawerOpen(false);

    if (dateAppointments[0]) {
      setSelectedKey(appointmentKey(dateAppointments[0]));
    } else {
      setSelectedKey("");
    }
  }

  function classificationFor(appointment: Appointment, ignoredAppointmentKey = appointmentKey(appointment)) {
    if (!isSchedulingBlockingStatus(appointment.status)) {
      return {
        outsideWorkingHours: classifyAppointmentAgainstSchedule(
          {
            date: appointment.date,
            duration: appointment.durationMinutes ?? 60,
            start: appointment.time,
          },
          workingSchedule,
        ).outsideWorkingHours,
        overlap: false,
      };
    }

    const candidate = {
      date: appointment.date,
      duration: appointment.durationMinutes ?? 60,
      start: appointment.time,
    };

    return {
      ...classifyAppointmentAgainstSchedule(candidate, workingSchedule),
      overlap: hasAppointmentOverlap(
        { ...candidate, specialistId: appointment.specialistId },
        specialistScopedAppointments
          .filter(
            (candidate) =>
              appointmentKey(candidate) !== ignoredAppointmentKey && isSchedulingBlockingStatus(candidate.status),
          )
          .map((candidate) => ({
            date: candidate.date,
            duration: candidate.durationMinutes ?? 60,
            specialistId: candidate.specialistId,
            start: candidate.time,
          })),
      ),
    };
  }

  function conflictingAppointmentFor(appointment: Appointment, originalAppointment: Appointment) {
    if (!isSchedulingBlockingStatus(appointment.status)) return undefined;

    const originalKey = appointmentKey(originalAppointment);

    return specialistScopedAppointments.find(
      (candidate) =>
        appointmentKey(candidate) !== originalKey &&
        isSchedulingBlockingStatus(candidate.status) &&
        appointmentsOverlap(
          {
            date: appointment.date,
            duration: appointment.durationMinutes ?? 60,
            specialistId: appointment.specialistId,
            start: appointment.time,
          },
          {
            date: candidate.date,
            duration: candidate.durationMinutes ?? 60,
            specialistId: candidate.specialistId,
            start: candidate.time,
          },
        ),
    );
  }

  async function saveAppointmentChange(
    originalAppointment: Appointment,
    appointment: Appointment,
    action: "appointment.drag" | "appointment.resize",
  ) {
    const key = appointmentKey(originalAppointment);

    if (pendingAppointmentKeysRef.current.has(key)) return;

    pendingAppointmentKeysRef.current.add(key);
    setPendingAppointmentKeys((current) => new Set(current).add(key));
    setCalendarError("");

    try {
      const result = await onSaveAppointment(appointment, action, originalAppointment);

      if (!result.ok) {
        setSelectedDate(originalAppointment.date);
        setSelectedKey(appointmentKey(originalAppointment));
        setCalendarError(result.message);
        return;
      }

      setSelectedDate(appointment.date);
      setSelectedKey(appointmentKey(appointment));
    } catch {
      setSelectedDate(originalAppointment.date);
      setSelectedKey(appointmentKey(originalAppointment));
      setCalendarError("Не удалось сохранить изменение записи. Исходное время восстановлено.");
    } finally {
      pendingAppointmentKeysRef.current.delete(key);
      setPendingAppointmentKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  function requestAppointmentChange(
    originalAppointment: Appointment,
    appointment: Appointment,
    action: "appointment.drag" | "appointment.resize",
  ) {
    const conflictingAppointment = conflictingAppointmentFor(appointment, originalAppointment);

    if (conflictingAppointment) {
      setCalendarError("");
      setOverlapOverrideReason("");
      setPendingConflict({ action, appointment, conflictingAppointment, originalAppointment });
      return;
    }

    void saveAppointmentChange(
      originalAppointment,
      {
        ...appointment,
        overlapOverride: false,
        overlapOverrideReason: "",
        overlapOverriddenAt: undefined,
        overlapOverriddenBy: undefined,
      },
      action,
    );
  }

  function resizeAppointment(appointment: Appointment, deltaMinutes: number) {
    const durationMinutes = clampAppointmentDurationToDay(appointment, deltaMinutes);

    if (durationMinutes === (appointment.durationMinutes ?? 60)) {
      return;
    }

    requestAppointmentChange(
      appointment,
      { ...appointment, durationMinutes },
      "appointment.resize",
    );
  }

  function startAppointmentDrag(event: DragEvent<HTMLElement>, appointment: Appointment) {
    const key = appointmentKey(appointment);

    if (resizingAppointmentKey || pendingAppointmentKeysRef.current.has(key)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const clientY = Number.isFinite(event.clientY) ? event.clientY : bounds.top;
    appointmentDragGrabOffsetRef.current = Math.min(
      Math.max(clientY - bounds.top, 0),
      bounds.height,
    );
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/admin-appointment-key", key);
    if (typeof event.dataTransfer.setDragImage === "function") {
      nativeDragImageRef.current?.remove();
      const dragImage = document.createElement("span");
      dragImage.setAttribute("aria-hidden", "true");
      Object.assign(dragImage.style, {
        height: "1px",
        left: "0",
        opacity: "0",
        pointerEvents: "none",
        position: "fixed",
        top: "0",
        width: "1px",
      });
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, 0, 0);
      nativeDragImageRef.current = dragImage;
    }
    setDraggedAppointmentKey(key);
    setAppointmentDragPreview(null);
  }

  function draggedAppointmentFor(event: DragEvent<HTMLElement>) {
    const key = event.dataTransfer.getData("text/admin-appointment-key") || draggedAppointmentKey;
    return filteredAppointments.find((candidate) => appointmentKey(candidate) === key);
  }

  function draggedAppointmentTime(event: DragEvent<HTMLElement>, appointment: Appointment) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clientY = Number.isFinite(event.clientY) ? event.clientY : bounds.top;
    const position = Math.min(
      Math.max(clientY - bounds.top - appointmentDragGrabOffsetRef.current, 0),
      bounds.height,
    );
    const rawTime = positionToTime(position, CALENDAR_DAY_START, CALENDAR_HOUR_HEIGHT);
    const dayStartMinutes = timeToMinutes(CALENDAR_DAY_START);
    const appointmentDuration = Math.max(
      MIN_APPOINTMENT_DURATION_MINUTES,
      appointment.durationMinutes ?? 60,
    );
    const latestStartMinutes = timeToMinutes(CALENDAR_DAY_END) - appointmentDuration;
    const latestSnappedStartMinutes =
      dayStartMinutes +
      Math.floor(Math.max(0, latestStartMinutes - dayStartMinutes) / CALENDAR_SNAP_MINUTES) *
        CALENDAR_SNAP_MINUTES;
    const snappedMinutes = Math.min(
      Math.max(dayStartMinutes, snapMinutes(timeToMinutes(rawTime))),
      latestSnappedStartMinutes,
    );

    return minutesToTime(snappedMinutes);
  }

  function previewAppointmentDrag(event: DragEvent<HTMLElement>, date: string) {
    event.preventDefault();
    const appointment = draggedAppointmentFor(event);

    if (!appointment) return;

    const originalKey = appointmentKey(appointment);
    const time = draggedAppointmentTime(event, appointment);
    event.dataTransfer.dropEffect = "move";
    setAppointmentDragPreview((current) => {
      if (
        current?.originalKey === originalKey &&
        current.appointment.date === date &&
        current.appointment.time === time
      ) {
        return current;
      }

      return {
        appointment: { ...appointment, date, time },
        originalKey,
      };
    });
  }

  function clearAppointmentDrag() {
    appointmentDragGrabOffsetRef.current = 0;
    nativeDragImageRef.current?.remove();
    nativeDragImageRef.current = null;
    setDraggedAppointmentKey("");
    setAppointmentDragPreview(null);
  }

  function dropAppointment(event: DragEvent<HTMLElement>, date: string) {
    event.preventDefault();
    const appointment = draggedAppointmentFor(event);

    if (!appointment) {
      clearAppointmentDrag();
      return;
    }

    const snappedTime = draggedAppointmentTime(event, appointment);
    const movedAppointment = { ...appointment, date, time: snappedTime };
    clearAppointmentDrag();
    requestAppointmentChange(appointment, movedAppointment, "appointment.drag");
  }

  function renderAppointment(
    appointment: Appointment,
    compact = false,
    layout?: AppointmentOverlapLayout,
    isDragPreview = false,
  ) {
    const key = appointmentKey(appointment);
    const classification = isDragPreview
      ? classificationFor(appointment, appointmentDragPreview?.originalKey)
      : classificationFor(appointment);

    return (
      <AppointmentBlock
        appointment={appointment}
        classification={classification}
        compact={compact}
        isDragging={!isDragPreview && key === draggedAppointmentKey}
        isDragPreview={isDragPreview}
        isPending={pendingAppointmentKeys.has(key)}
        isSelected={key === selectedAppointmentKey}
        key={isDragPreview ? `drag-preview-${appointmentDragPreview?.originalKey}` : key}
        layout={layout}
        onDragEnd={clearAppointmentDrag}
        onDragStart={startAppointmentDrag}
        onResizeInteractionChange={(active) => {
          if (active) clearAppointmentDrag();
          setResizingAppointmentKey((current) => (active ? key : current === key ? "" : current));
        }}
        onResize={resizeAppointment}
        onSelect={selectAppointment}
      />
    );
  }

  function changeSpecialistScope(specialistId: string) {
    setSelectedSpecialistId(specialistId);
    setIsAppointmentDrawerOpen(false);
    setSelectedKey("");
    setPendingConflict(null);
    setCalendarError("");
  }

  return (
    <div className="admin-split-view admin-calendar-workspace">
      <section className="admin-panel admin-calendar-panel" aria-labelledby="calendar-heading">
        <CalendarToolbar
          canManageBlocks={canManageBlocks}
          heading={calendarHeading}
          mode={mode}
          onAddBlock={() => onCreateCalendarBlock?.(selectedDate)}
          onDateChange={(date) =>
            selectDate(
              date,
              filteredAppointments.filter((appointment) => appointment.date === date),
              mode,
            )
          }
          onGoToToday={goToToday}
          onMovePeriod={movePeriod}
          onSwitchMode={switchMode}
          selectedDate={selectedDate}
        />
        {role === "owner" || role === "administrator" ? (
          <div className="admin-route-context" aria-label="Фильтр календаря по специалисту">
            <label>
              Специалист
              <select
                aria-label="Показать календарь специалиста"
                onChange={(event) => changeSpecialistScope(event.target.value)}
                value={effectiveSpecialistId}
              >
                <option value="all">Все специалисты</option>
                {activeSpecialists.map((specialist) => (
                  <option key={specialist.id} value={specialist.id}>
                    {specialist.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : role === "specialist" ? (
          <div className="admin-route-context" aria-label="Текущий календарь специалиста">
            <div>
              <strong>Мой календарь</strong>
              <span>{selectedSpecialist?.displayName ?? "Назначенный специалист"}</span>
            </div>
          </div>
        ) : null}
        {selectedClientFilterName ? (
          <div className="admin-route-context" aria-label="Фильтр календаря по клиенту">
            <div>
              <strong>Показаны записи клиента {selectedClientFilterName}</strong>
              <span>Календарь открыт на ближайшей записи клиента, список и месяц тоже считаются только по нему.</span>
            </div>
            <div className="admin-route-context-actions">
              {role !== "specialist" ? (
                <Link className="admin-client-inline-link" href={clientProfileHref(selectedClientFilter.id, role)}>
                  Открыть карточку клиента
                </Link>
              ) : null}
              <Link className="admin-client-inline-link" href={adminSectionHref("calendar", role)}>
                Сбросить фильтр
              </Link>
            </div>
          </div>
        ) : null}

        <p aria-atomic="true" aria-label="Время переноса записи" aria-live="polite" className="sr-only">
          {appointmentDragPreview
            ? `Перенос записи ${appointmentDragPreview.appointment.client}: ${formatCalendarDay(appointmentDragPreview.appointment.date)}, ${appointmentDragPreview.appointment.time}`
            : ""}
        </p>

        {pendingAppointmentKeys.size > 0 ? (
          <p className="admin-export-notice" role="status">
            Сохраняем изменение записи…
          </p>
        ) : null}
        {calendarError ? (
          <p className="admin-form-alert" role="alert">
            {calendarError}
          </p>
        ) : null}
        {pendingConflict ? (
          <section className="admin-calendar-conflict" aria-labelledby="admin-calendar-conflict-title">
            <div className="admin-calendar-conflict-copy" role="alert">
              <strong className="admin-calendar-conflict-title" id="admin-calendar-conflict-title">
                Изменение пересекается с другой записью
              </strong>
              <p>
                {pendingConflict.conflictingAppointment.client}, {formatCalendarDay(pendingConflict.conflictingAppointment.date)} в{" "}
                {pendingConflict.conflictingAppointment.time}, {pendingConflict.conflictingAppointment.service}.
              </p>
            </div>
            {canOverrideOverlap ? (
              <label className="admin-calendar-conflict-reason">
                Причина ручного пересечения
                <textarea
                  className="admin-calendar-conflict-reason-input"
                  onChange={(event) => setOverlapOverrideReason(event.target.value)}
                  required
                  rows={2}
                  value={overlapOverrideReason}
                />
              </label>
            ) : (
              <p>Для сохранения с пересечением требуется роль владельца или администратора.</p>
            )}
            <div className="admin-detail-actions admin-calendar-conflict-actions">
              <button className="admin-outline-action" onClick={() => setPendingConflict(null)} type="button">
                Отменить изменение
              </button>
              {canOverrideOverlap ? (
                <button
                  className="admin-danger-button"
                  disabled={!overlapOverrideReason.trim()}
                  onClick={() => {
                    const conflict = pendingConflict;
                    setPendingConflict(null);
                    void saveAppointmentChange(
                      conflict.originalAppointment,
                      {
                        ...conflict.appointment,
                        overlapOverride: true,
                        overlapOverrideReason: overlapOverrideReason.trim(),
                      },
                      conflict.action,
                    );
                  }}
                  type="button"
                >
                  Сохранить с пересечением
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {mode === "month" ? (
          <>
            <div className="admin-calendar-month-grid" role="grid" aria-label={`Месяц ${calendarHeading}`}>
              {CALENDAR_WEEKDAY_LABELS.map((weekday) => (
                <span className="admin-calendar-weekday" key={weekday} role="columnheader">
                  {weekday}
                </span>
              ))}
              {monthDays.map((day) => {
                const dayAppointments = filteredAppointments.filter((appointment) => appointment.date === day.date);
                const dayBlocks = specialistScopedBlocks.filter((block) => block.blockDate === day.date);
                const dayBlockCount = dayBlocks.length;
                const capacityAppointmentCount = specialistScopedAppointments.filter(
                  (appointment) => appointment.date === day.date,
                ).filter(
                  (appointment) => appointment.status !== "Отменена",
                ).length;
                const countLabel = appointmentCountLabel(dayAppointments.length);
                const freeCount = freeSlotCount(capacityAppointmentCount, specialistCapacity);
                const manualOverflow = manualAppointmentOverflow(capacityAppointmentCount, specialistCapacity);
                const availabilityLabels = monthAvailabilityLabels(dayBlocks, freeCount, manualOverflow);
                const freeLabel = availabilityLabels.full;
                const compactCountLabel = compactAppointmentCountLabel(dayAppointments.length);
                const compactFreeLabel = availabilityLabels.compact;

                return (
                  <span
                    className={`admin-calendar-month-cell${day.date.startsWith(selectedMonth) ? "" : " is-adjacent-month"}`}
                    key={day.date}
                    role="gridcell"
                  >
                    <button
                      aria-label={`${formatCalendarDay(day.date)}, ${countLabel}, ${freeLabel}${dayBlockCount ? `, блокировок: ${dayBlockCount}` : ""}`}
                      aria-pressed={selectedDate === day.date}
                      className="admin-calendar-day-button"
                      onClick={() => selectDate(day.date, dayAppointments, "day")}
                      type="button"
                    >
                      <strong>{day.day}</strong>
                      <small>
                        <span className="admin-month-count-full">{countLabel}</span>
                        <span className="admin-month-count-compact">{compactCountLabel}</span>
                        <span className="admin-month-free-full">{freeLabel}</span>
                        <span className="admin-month-free-compact">{compactFreeLabel}</span>
                        {dayBlockCount ? <span>Блоков: {dayBlockCount}</span> : null}
                      </small>
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="admin-calendar-context-note" aria-label="План месяца">
              <div>
                <span className="admin-kicker">План месяца</span>
                <p>
                  В ячейках месяца показаны количество записей, дневной лимит и ограничения по времени. Нажатие на день открывает дневной режим.
                </p>
              </div>
              <dl className="admin-detail-list">
                <div>
                  <dt>Расчет слотов</dt>
                  <dd>{slotCountLabel(specialistCapacity)} в день</dd>
                </div>
                <div>
                  <dt>Буфер между сеансами</dt>
                  <dd>{bookingBufferMinutes} минут, Настройки → Запись</dd>
                </div>
              </dl>
            </div>
          </>
        ) : mode === "week" ? (
          <div ref={calendarViewRef} style={{ display: "contents" }}>
            <WeekCalendar
              appointments={filteredAppointments}
              dragPreview={appointmentDragPreview?.appointment}
              heading={calendarHeading}
              isInteractionLocked={Boolean(resizingAppointmentKey)}
              onDragOverAppointment={previewAppointmentDrag}
              onDropAppointment={dropAppointment}
              onSelectDate={(date, dateAppointments) => selectDate(date, dateAppointments, "day")}
              renderAppointment={renderAppointment}
              weekDays={weekDays}
            />
            {renderCalendarBlockOverlays(weekDays, true)}
          </div>
        ) : mode === "day" ? (
          <div ref={calendarViewRef} style={{ display: "contents" }}>
            {selectedDayBlocks.length > 0 ? (
              <div className="admin-calendar-block-list" aria-label="Недоступное время">
                {selectedDayBlocks.map((block) => (
                  <article className="admin-calendar-block-row" key={block.id}>
                    <div>
                      <strong>
                        {isFullDayCalendarBlock(block) ? "Весь день" : `${block.startsAt} - ${block.endsAt}`}
                      </strong>
                      <span>
                        {calendarBlockKindLabel(block)}
                        {block.specialistName ? ` · ${block.specialistName}` : ""}
                        {block.internalNote ? ` · ${block.internalNote}` : ""}
                      </span>
                    </div>
                    {canManageBlocks ? (
                      <div className="admin-detail-actions">
                        <button className="admin-secondary-button" onClick={() => onEditCalendarBlock?.(block)} type="button">
                          Изменить
                        </button>
                        <button className="admin-danger-button" onClick={() => onDeleteCalendarBlock?.(block)} type="button">
                          Удалить
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
            {selectedDayManualOverflow > 0 ? (
              <div className="admin-calendar-capacity-note" role="status">
                <strong>
                  {selectedDayCapacityCount} из {specialistCapacity}
                </strong>
                <span>
                  {selectedDayManualOverflow} {selectedDayManualOverflow === 1 ? "запись добавлена" : "записи добавлены"} вручную.
                  Онлайн-запись на этот день закрыта.
                </span>
              </div>
            ) : null}
            <DayCalendar
              appointments={selectedDayAppointments}
              bookingBufferMinutes={bookingBufferMinutes}
              dragPreview={appointmentDragPreview?.appointment}
              freeSlotCount={selectedDayFreeCount}
              isInteractionLocked={Boolean(resizingAppointmentKey)}
              onDragOverAppointment={previewAppointmentDrag}
              onDropAppointment={dropAppointment}
              renderAppointment={renderAppointment}
              selectedDate={selectedDate}
            />
            {renderCalendarBlockOverlays([{ date: selectedDate }], false)}
          </div>
        ) : (
          <>
            <div className="admin-appointment-summary" aria-label="Сводка списка записей">
              <div className="admin-appointment-summary-card">
                <span>Всего записей</span>
                <strong>{listAppointments.length}</strong>
              </div>
              <div className="admin-appointment-summary-card">
                <span>Подтверждены</span>
                <strong>{confirmedListCount}</strong>
              </div>
              <div className="admin-appointment-summary-card">
                <span>Требуют внимания</span>
                <strong>{attentionListCount}</strong>
              </div>
            </div>
            <div className="admin-appointment-feed" aria-label="Лента всех записей">
              {listAppointments.map((appointment) => {
                const key = appointmentKey(appointment);

                return (
                  <button
                    aria-pressed={key === selectedAppointmentKey}
                    className="admin-calendar-item admin-appointment-feed-item"
                    key={key}
                    onClick={() => selectAppointment(appointment)}
                    type="button"
                  >
                    <time className="admin-tabular">{appointment.time}</time>
                    <span className="admin-appointment-feed-main">
                      <strong>{appointment.client}</strong>
                      <small>
                        {formatCalendarDay(appointment.date)} · {appointment.service}
                        {appointment.specialistName ? ` · ${appointment.specialistName}` : ""}
                      </small>
                      {appointment.note ? <small>{appointment.note}</small> : null}
                    </span>
                    <span className={statusClass(appointment.status)}>{appointment.status}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {mode !== "month" && mode !== "week" && visibleAppointments.length === 0 && (mode !== "day" || selectedDayBlocks.length === 0) ? (
          <p className="admin-empty-state">Записи не найдены.</p>
        ) : null}
      </section>

      {shouldShowAppointmentDrawer ? (
        <AppointmentDetailDrawer
          appointment={selectedAppointment}
          appointmentClient={selectedAppointmentClient}
          onCancelAppointment={onCancelAppointment}
          onClose={() => setIsAppointmentDrawerOpen(false)}
          onEditAppointment={onEditAppointment}
          onSaveAppointment={onSaveAppointment}
          role={role}
        />
      ) : null}
    </div>
  );
}
