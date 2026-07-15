"use client";

import { type FormEvent, type KeyboardEvent, useId, useMemo, useState } from "react";

import type { AdminRoleId } from "@/admin/config";
import {
  findClientByIdentity,
  findUniqueClientByName,
  normalizeSearch,
  type Appointment,
  type AppointmentStatus,
  type ClientRecord,
} from "@/admin/domain";
import { appointmentKey } from "@/components/admin/lib/links";
import {
  AdminDrawer,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerHeader,
  AdminDrawerSection,
  useAdminDrawerClose,
} from "@/components/admin/drawer";

import type { CalendarAppointmentSaveResult } from "./CalendarWorkspace";
import { appointmentsOverlap, hasAppointmentOverlap, isSchedulingBlockingStatus } from "./conflicts";
import { isIsoDate } from "./date";
import {
  classifyAppointmentAgainstSchedule,
  createCalendarWorkingSchedule,
  getCalendarIsoDate,
  type CalendarScheduleSettings,
} from "./schedule";

const appointmentServiceOptions = [
  "Классический массаж",
  "Лимфодренажный массаж",
  "Deep tissue massage",
  "SPA процедура",
] as const;

const appointmentStatusOptions: AppointmentStatus[] = [
  "Новая заявка",
  "Ожидает",
  "Подтверждена",
  "Завершена",
  "Не пришёл",
  "Отменена",
];

export type CalendarAppointmentDialogProps = {
  appointments: Appointment[];
  bookingBufferMinutes: number;
  clients: ClientRecord[];
  initialAppointment?: Appointment;
  onClose: () => void;
  onSave: (appointment: Appointment) => Promise<CalendarAppointmentSaveResult>;
  prefillClient?: ClientRecord;
  prefillClientName?: string;
  prefillDate?: string;
  role: AdminRoleId;
  siteSettings: CalendarScheduleSettings;
};

function CalendarAppointmentCloseButton({ onClose }: { onClose: () => void }) {
  const requestClose = useAdminDrawerClose();

  return (
    <button className="admin-secondary-button" onClick={requestClose ?? onClose} type="button">
      Отмена
    </button>
  );
}

export function CalendarAppointmentDialog({
  appointments,
  bookingBufferMinutes,
  clients,
  initialAppointment,
  onClose,
  onSave,
  prefillClient,
  prefillClientName,
  prefillDate,
  role,
  siteSettings,
}: CalendarAppointmentDialogProps) {
  const workingSchedule = useMemo(
    () => createCalendarWorkingSchedule(siteSettings),
    [siteSettings],
  );
  const [initialForm] = useState<Appointment>(() => ({
    client: initialAppointment?.client ?? prefillClient?.name ?? prefillClientName ?? "",
    clientId: initialAppointment?.clientId ?? prefillClient?.id,
    bufferMinutes: initialAppointment?.bufferMinutes ?? bookingBufferMinutes,
    date: initialAppointment?.date ?? prefillDate ?? getCalendarIsoDate(workingSchedule),
    durationMinutes: initialAppointment?.durationMinutes ?? 60,
    id: initialAppointment?.id,
    note: initialAppointment?.note ?? "",
    overlapOverride: initialAppointment?.overlapOverride ?? false,
    overlapOverrideReason: initialAppointment?.overlapOverrideReason ?? "",
    overlapOverriddenAt: initialAppointment?.overlapOverriddenAt,
    overlapOverriddenBy: initialAppointment?.overlapOverriddenBy,
    postVisitComment: initialAppointment?.postVisitComment ?? "",
    postVisitCommentedAt: initialAppointment?.postVisitCommentedAt,
    service: initialAppointment?.service ?? appointmentServiceOptions[0],
    status: initialAppointment?.status ?? "Новая заявка",
    time: initialAppointment?.time ?? "14:00",
    version: initialAppointment?.version,
  }));
  const [form, setForm] = useState<Appointment>(() => initialForm);
  const [error, setError] = useState("");
  const [activeClientSuggestion, setActiveClientSuggestion] = useState(-1);
  const [areClientSuggestionsDismissed, setAreClientSuggestionsDismissed] = useState(false);
  const clientSuggestionsId = useId();
  const isEditing = Boolean(initialAppointment);
  const isPublicBooking = initialAppointment?.origin === "public";
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);
  const schedulingClassification = useMemo(() => {
    if (!isIsoDate(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) {
      return {
        outsideDailyWorkingHours: false,
        outsideWorkingDay: false,
        outsideWorkingHours: false,
        overlap: false,
      };
    }

    const candidate = {
      date: form.date,
      duration: form.durationMinutes ?? 60,
      start: form.time,
    };
    const overlap = hasAppointmentOverlap(
      candidate,
      appointments
        .filter(
          (appointment) =>
            appointmentKey(appointment) !== appointmentKey(form) &&
            isSchedulingBlockingStatus(appointment.status),
        )
        .map((appointment) => ({
          date: appointment.date,
          duration: appointment.durationMinutes ?? 60,
          start: appointment.time,
        })),
    );

    return {
      ...classifyAppointmentAgainstSchedule(candidate, workingSchedule),
      overlap,
    };
  }, [appointments, form, workingSchedule]);
  const conflictingAppointment = useMemo(() => {
    if (!isIsoDate(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) {
      return undefined;
    }

    if (!isSchedulingBlockingStatus(form.status)) return undefined;

    return appointments.find(
      (appointment) =>
        appointmentKey(appointment) !== appointmentKey(form) &&
        isSchedulingBlockingStatus(appointment.status) &&
        appointmentsOverlap(
          {
            date: form.date,
            duration: form.durationMinutes ?? 60,
            start: form.time,
          },
          {
            date: appointment.date,
            duration: appointment.durationMinutes ?? 60,
            start: appointment.time,
          },
        ),
    );
  }, [appointments, form]);
  const canOverrideOverlap = role === "owner" || role === "administrator";
  const normalizedClientQuery = normalizeSearch(form.client);
  const clientSuggestions =
    normalizedClientQuery.length > 0
      ? clients
          .filter(
            (client) =>
              normalizeSearch(client.name).includes(normalizedClientQuery) ||
              normalizeSearch(client.phone).includes(normalizedClientQuery) ||
              normalizeSearch(client.email).includes(normalizedClientQuery),
          )
          .filter((client) => normalizeSearch(client.name) !== normalizedClientQuery)
          .sort((first, second) => first.name.localeCompare(second.name, "ru"))
          .slice(0, 4)
      : [];
  const showClientSuggestions = clientSuggestions.length > 0 && !areClientSuggestionsDismissed;

  function updateForm<Field extends keyof Appointment>(field: Field, value: Appointment[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function updateClientInput(value: string) {
    const linkedClient = findClientByIdentity(clients, value) ?? findUniqueClientByName(clients, value);

    setForm((current) => ({ ...current, client: value, clientId: linkedClient?.id }));
    setActiveClientSuggestion(0);
    setAreClientSuggestionsDismissed(false);
    setError("");
  }

  function selectClient(client: ClientRecord) {
    setForm((current) => ({ ...current, client: client.name, clientId: client.id }));
    setActiveClientSuggestion(-1);
    setAreClientSuggestionsDismissed(true);
    setError("");
  }

  function handleClientKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && showClientSuggestions) {
      event.preventDefault();
      event.stopPropagation();
      setActiveClientSuggestion(-1);
      setAreClientSuggestionsDismissed(true);
      return;
    }

    if (clientSuggestions.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setAreClientSuggestionsDismissed(false);
      setActiveClientSuggestion((current) => {
        if (event.key === "ArrowDown") return current >= clientSuggestions.length - 1 ? 0 : current + 1;
        return current <= 0 ? clientSuggestions.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === "Enter" && showClientSuggestions && activeClientSuggestion >= 0) {
      event.preventDefault();
      selectClient(clientSuggestions[activeClientSuggestion]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = form.client.trim();

    if (!client || !form.date || !form.time) {
      setError("Укажите клиента, дату и время.");
      return;
    }

    const linkedClient = findClientByIdentity(clients, form.clientId) ?? findUniqueClientByName(clients, client);

    const hasBlockingOverlap = isSchedulingBlockingStatus(form.status) && schedulingClassification.overlap;

    if (hasBlockingOverlap && !canOverrideOverlap) {
      setError("Для пересечения записей требуется роль владельца или администратора.");
      return;
    }

    if (hasBlockingOverlap && !form.overlapOverrideReason?.trim()) {
      setError("Укажите причину ручного пересечения записей.");
      return;
    }

    const result = await onSave({
      ...form,
      bufferMinutes: initialAppointment ? form.bufferMinutes : bookingBufferMinutes,
      client,
      clientId: linkedClient?.id,
      durationMinutes: Math.max(form.durationMinutes ?? 60, 15),
      note: form.note.trim(),
      overlapOverride: hasBlockingOverlap,
      overlapOverrideReason: hasBlockingOverlap ? form.overlapOverrideReason?.trim() : "",
      overlapOverriddenAt: hasBlockingOverlap ? form.overlapOverriddenAt : undefined,
      overlapOverriddenBy: hasBlockingOverlap ? form.overlapOverriddenBy : undefined,
      postVisitComment: form.postVisitComment?.trim(),
      postVisitCommentedAt: form.postVisitComment?.trim()
        ? (form.postVisitCommentedAt ?? new Date().toISOString())
        : undefined,
    });
    if (result.ok) onClose();
    else setError(result.message);
  }

  return (
    <AdminDrawer
      ariaLabelledBy="calendar-action-title"
      className="admin-calendar-appointment-drawer"
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <form className="admin-drawer-form" noValidate onSubmit={handleSubmit}>
        <AdminDrawerHeader
          kicker="Календарь"
          onClose={onClose}
          title={isEditing ? "Редактировать запись" : "Новая запись"}
          titleId="calendar-action-title"
        />

        <AdminDrawerBody>
          <div className="admin-action-body">
            {error ? (
              <p className="admin-form-alert" role="alert">
                {error}
              </p>
            ) : null}

            <AdminDrawerSection title="Клиент и услуга">
              {isPublicBooking ? (
                <div className="admin-form-alert" role="status">
                  <p>Услуга и длительность зафиксированы клиентом при онлайн-записи.</p>
                </div>
              ) : null}
              <label>
                Клиент
                <input
                  aria-activedescendant={
                    showClientSuggestions && activeClientSuggestion >= 0
                      ? `${clientSuggestionsId}-option-${activeClientSuggestion}`
                      : undefined
                  }
                  aria-autocomplete="list"
                  aria-controls={clientSuggestionsId}
                  aria-expanded={showClientSuggestions}
                  aria-invalid={error && !form.client.trim() ? "true" : undefined}
                  autoComplete="off"
                  onChange={(event) => updateClientInput(event.target.value)}
                  onFocus={() => setAreClientSuggestionsDismissed(false)}
                  onKeyDown={handleClientKeyDown}
                  required
                  role="combobox"
                  type="text"
                  value={form.client}
                />
              </label>
              {showClientSuggestions ? (
                <div
                  aria-label="Найденные клиенты"
                  className="admin-client-suggestions"
                  id={clientSuggestionsId}
                  role="listbox"
                >
                  {clientSuggestions.map((client, index) => (
                    <button
                      aria-selected={activeClientSuggestion === index}
                      id={`${clientSuggestionsId}-option-${index}`}
                      key={client.id}
                      onClick={() => selectClient(client)}
                      onMouseEnter={() => setActiveClientSuggestion(index)}
                      role="option"
                      type="button"
                    >
                      <span>{client.name}</span>
                      <small>
                        {client.phone} · {client.language.toUpperCase()}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}
              <label>
                Услуга
                <select
                  disabled={isPublicBooking}
                  onChange={(event) => updateForm("service", event.target.value)}
                  value={form.service}
                >
                  {appointmentServiceOptions.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </label>
            </AdminDrawerSection>

            <AdminDrawerSection title="Дата и статус">
              {schedulingClassification.outsideWorkingHours || schedulingClassification.overlap ? (
                <div className="admin-form-alert" role="status">
                  {schedulingClassification.outsideWorkingHours ? (
                    schedulingClassification.outsideWorkingDay ? (
                      <p>Выбран нерабочий день согласно настройкам сайта. Сохранение разрешено.</p>
                    ) : (
                      <p>Время находится вне рабочих часов согласно настройкам сайта. Сохранение разрешено.</p>
                    )
                  ) : null}
                  {schedulingClassification.overlap ? (
                    <p>
                      Запись пересекается с {conflictingAppointment?.client ?? "другой записью"}
                      {conflictingAppointment ? ` в ${conflictingAppointment.time}` : ""}.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {schedulingClassification.overlap && canOverrideOverlap ? (
                <label>
                  Причина ручного пересечения
                  <textarea
                    onChange={(event) => updateForm("overlapOverrideReason", event.target.value)}
                    required
                    rows={2}
                    value={form.overlapOverrideReason ?? ""}
                  />
                </label>
              ) : null}
              <label>
                Дата
                <input
                  aria-invalid={error && !form.date ? "true" : undefined}
                  onChange={(event) => updateForm("date", event.target.value)}
                  required
                  type="date"
                  value={form.date}
                />
              </label>
              <label>
                Время
                <input
                  aria-invalid={error && !form.time ? "true" : undefined}
                  onChange={(event) => updateForm("time", event.target.value)}
                  required
                  type="time"
                  value={form.time}
                />
              </label>
              <label>
                Длительность, минут
                <input
                  disabled={isPublicBooking}
                  min="15"
                  onChange={(event) => updateForm("durationMinutes", Number(event.target.value))}
                  step="15"
                  type="number"
                  value={form.durationMinutes ?? 60}
                />
              </label>
              <label>
                Статус
                <select
                  onChange={(event) => updateForm("status", event.target.value as AppointmentStatus)}
                  value={form.status}
                >
                  {appointmentStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </AdminDrawerSection>

            <AdminDrawerSection title="Комментарии">
              <label>
                Комментарий к записи
                <textarea onChange={(event) => updateForm("note", event.target.value)} rows={3} value={form.note} />
              </label>
              <label>
                Комментарий после визита
                <textarea
                  onChange={(event) => updateForm("postVisitComment", event.target.value)}
                  rows={3}
                  value={form.postVisitComment ?? ""}
                />
              </label>
            </AdminDrawerSection>
          </div>
        </AdminDrawerBody>

        <AdminDrawerFooter>
          <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить запись"}</button>
          <CalendarAppointmentCloseButton onClose={onClose} />
        </AdminDrawerFooter>
      </form>
    </AdminDrawer>
  );
}
