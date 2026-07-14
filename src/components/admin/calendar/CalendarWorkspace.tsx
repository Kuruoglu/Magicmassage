"use client";

import Link from "next/link";
import { type DragEvent, useMemo, useState } from "react";

import type { AdminRoleId } from "@/admin/config";
import {
  appointmentBelongsToClient,
  findAppointmentClient,
  findClientByIdentity,
  type Appointment,
  type ClientRecord,
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
  | { ok: true }
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

export type CalendarWorkspaceProps = {
  appointments: Appointment[];
  bookingBufferMinutes: number;
  clients: ClientRecord[];
  dailySlotCapacity: number;
  onCancelAppointment: (appointment: Appointment) => void;
  onCalendarDateChange: (date: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
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
};

export function CalendarWorkspace({
  appointments,
  bookingBufferMinutes,
  clients,
  dailySlotCapacity,
  onCancelAppointment,
  onCalendarDateChange,
  onEditAppointment,
  onSaveAppointment,
  query,
  role,
  selectedAppointmentFocus,
  selectedCalendarDate,
  selectedClientName,
  siteSettings,
}: CalendarWorkspaceProps) {
  const workingSchedule = useMemo(
    () => createCalendarWorkingSchedule(siteSettings),
    [siteSettings],
  );
  const selectedClientFilter = findClientByIdentity(clients, selectedClientName);
  const selectedClientFilterName = selectedClientFilter?.name;
  const clientScopedAppointments = selectedClientFilterName
    ? appointments.filter((appointment) => appointmentBelongsToClient(appointment, selectedClientFilter, clients))
    : appointments;
  const fallbackAppointment = appointments[0] ?? {
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
      [appointment.date, appointment.time, appointment.client, appointment.service, appointment.status, appointment.note],
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
  const [selectedKey, setSelectedKey] = useState(
    () => selectedAppointmentFocus?.appointmentKey ?? appointmentKey(initialSelectedAppointment ?? fallbackAppointment),
  );
  const [pendingAppointmentKey, setPendingAppointmentKey] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [pendingConflict, setPendingConflict] = useState<PendingCalendarConflict | null>(null);
  const [overlapOverrideReason, setOverlapOverrideReason] = useState("");
  const selectedDayAppointments = sortAppointments(
    filteredAppointments.filter((appointment) => appointment.date === selectedDate),
  );
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
  const selectedDayFreeCount = freeSlotCount(selectedDayAppointments.length, dailySlotCapacity);
  const confirmedListCount = listAppointments.filter((appointment) => appointment.status === "Подтверждена").length;
  const attentionListCount = listAppointments.filter(
    (appointment) => appointment.status !== "Подтверждена" && appointment.status !== "Отменена",
  ).length;
  const canOverrideOverlap = role === "owner" || role === "administrator";

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

  function classificationFor(appointment: Appointment) {
    const key = appointmentKey(appointment);

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
      bufferMinutes: appointment.bufferMinutes ?? bookingBufferMinutes,
      date: appointment.date,
      duration: appointment.durationMinutes ?? 60,
      start: appointment.time,
    };

    return {
      ...classifyAppointmentAgainstSchedule(candidate, workingSchedule),
      overlap: hasAppointmentOverlap(
        candidate,
        filteredAppointments
          .filter(
            (candidate) =>
              appointmentKey(candidate) !== key && isSchedulingBlockingStatus(candidate.status),
          )
          .map((candidate) => ({
            bufferMinutes: candidate.bufferMinutes ?? bookingBufferMinutes,
            date: candidate.date,
            duration: candidate.durationMinutes ?? 60,
            start: candidate.time,
          })),
      ),
    };
  }

  function conflictingAppointmentFor(appointment: Appointment, originalAppointment: Appointment) {
    if (!isSchedulingBlockingStatus(appointment.status)) return undefined;

    const originalKey = appointmentKey(originalAppointment);

    return filteredAppointments.find(
      (candidate) =>
        appointmentKey(candidate) !== originalKey &&
        isSchedulingBlockingStatus(candidate.status) &&
        appointmentsOverlap(
          {
            bufferMinutes: appointment.bufferMinutes ?? bookingBufferMinutes,
            date: appointment.date,
            duration: appointment.durationMinutes ?? 60,
            start: appointment.time,
          },
          {
            bufferMinutes: candidate.bufferMinutes ?? bookingBufferMinutes,
            date: candidate.date,
            duration: candidate.durationMinutes ?? 60,
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
    setPendingAppointmentKey(key);
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
      setPendingAppointmentKey("");
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
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/admin-appointment-key", key);
    setDraggedAppointmentKey(key);
  }

  function dropAppointment(event: DragEvent<HTMLElement>, date: string) {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/admin-appointment-key") || draggedAppointmentKey;
    const appointment = filteredAppointments.find((candidate) => appointmentKey(candidate) === key);

    if (!appointment) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height);
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
    const snappedTime = minutesToTime(snappedMinutes);
    const movedAppointment = { ...appointment, date, time: snappedTime };
    setDraggedAppointmentKey("");
    requestAppointmentChange(appointment, movedAppointment, "appointment.drag");
  }

  function renderAppointment(
    appointment: Appointment,
    compact = false,
    layout?: AppointmentOverlapLayout,
  ) {
    const key = appointmentKey(appointment);

    return (
      <AppointmentBlock
        appointment={appointment}
        classification={classificationFor(appointment)}
        compact={compact}
        isPending={key === pendingAppointmentKey}
        isSelected={key === selectedAppointmentKey}
        key={key}
        layout={layout}
        onDragEnd={() => setDraggedAppointmentKey("")}
        onDragStart={startAppointmentDrag}
        onResize={resizeAppointment}
        onSelect={selectAppointment}
      />
    );
  }

  return (
    <div className="admin-split-view admin-calendar-workspace">
      <section className="admin-panel admin-calendar-panel" aria-labelledby="calendar-heading">
        <CalendarToolbar
          heading={calendarHeading}
          mode={mode}
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
        {selectedClientFilterName ? (
          <div className="admin-route-context" aria-label="Фильтр календаря по клиенту">
            <div>
              <strong>Показаны записи клиента {selectedClientFilterName}</strong>
              <span>Календарь открыт на ближайшей записи клиента, список и месяц тоже считаются только по нему.</span>
            </div>
            <div className="admin-route-context-actions">
              <Link className="admin-client-inline-link" href={clientProfileHref(selectedClientFilter.id, role)}>
                Открыть карточку клиента
              </Link>
              <Link className="admin-client-inline-link" href={adminSectionHref("calendar", role)}>
                Сбросить фильтр
              </Link>
            </div>
          </div>
        ) : null}

        {pendingAppointmentKey ? (
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
          <div className="admin-form-alert" role="alert">
            <strong>Изменение пересекается с другой записью</strong>
            <p>
              {pendingConflict.conflictingAppointment.client}, {formatCalendarDay(pendingConflict.conflictingAppointment.date)} в{" "}
              {pendingConflict.conflictingAppointment.time}, {pendingConflict.conflictingAppointment.service}.
            </p>
            {canOverrideOverlap ? (
              <label>
                Причина ручного пересечения
                <textarea
                  onChange={(event) => setOverlapOverrideReason(event.target.value)}
                  required
                  rows={2}
                  value={overlapOverrideReason}
                />
              </label>
            ) : (
              <p>Для сохранения с пересечением требуется роль владельца или администратора.</p>
            )}
            <div className="admin-detail-actions">
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
              <button className="admin-text-action" onClick={() => setPendingConflict(null)} type="button">
                Отменить изменение
              </button>
            </div>
          </div>
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
                const countLabel = appointmentCountLabel(dayAppointments.length);
                const freeCount = freeSlotCount(dayAppointments.length, dailySlotCapacity);
                const freeLabel = freeSlotLabel(freeCount);
                const compactCountLabel = compactAppointmentCountLabel(dayAppointments.length);
                const compactFreeLabel = compactFreeSlotLabel(freeCount);

                return (
                  <span
                    className={`admin-calendar-month-cell${day.date.startsWith(selectedMonth) ? "" : " is-adjacent-month"}`}
                    key={day.date}
                    role="gridcell"
                  >
                    <button
                      aria-label={`${formatCalendarDay(day.date)}, ${countLabel}, ${freeLabel}`}
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
                  В ячейках месяца показаны только количество записей и свободные слоты. Нажатие на день открывает дневной режим.
                </p>
              </div>
              <dl className="admin-detail-list">
                <div>
                  <dt>Расчет слотов</dt>
                  <dd>{slotCountLabel(dailySlotCapacity)} в день</dd>
                </div>
                <div>
                  <dt>Буфер между сеансами</dt>
                  <dd>{bookingBufferMinutes} минут, Настройки → Запись</dd>
                </div>
              </dl>
            </div>
          </>
        ) : mode === "week" ? (
          <WeekCalendar
            appointments={filteredAppointments}
            heading={calendarHeading}
            onDropAppointment={dropAppointment}
            onSelectDate={(date, dateAppointments) => selectDate(date, dateAppointments, "day")}
            renderAppointment={renderAppointment}
            weekDays={weekDays}
          />
        ) : mode === "day" ? (
          <DayCalendar
            appointments={selectedDayAppointments}
            bookingBufferMinutes={bookingBufferMinutes}
            freeSlotCount={selectedDayFreeCount}
            onDropAppointment={dropAppointment}
            renderAppointment={renderAppointment}
            selectedDate={selectedDate}
          />
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
        {mode !== "month" && mode !== "week" && visibleAppointments.length === 0 ? (
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
