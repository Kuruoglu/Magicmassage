"use client";

import { type FormEvent, type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

import type { AdminRoleId } from "@/admin/config";
import {
  findClientByIdentity,
  findUniqueClientByName,
  getAppointmentNotificationEmail,
  normalizeSearch,
  type Appointment,
  type AppointmentStatus,
  type CalendarBlock,
  type ClientRecord,
  type SpecialistRecord,
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
import {
  appointmentOverlapsCalendarBlock,
  appointmentsOverlap,
  hasAppointmentOverlap,
  isSchedulingBlockingStatus,
} from "./conflicts";
import { isIsoDate } from "./date";
import {
  classifyAppointmentAgainstSchedule,
  createCalendarWorkingSchedule,
  createSpecialistWorkingSchedule,
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
  calendarBlocks?: CalendarBlock[];
  clients: ClientRecord[];
  initialAppointment?: Appointment;
  onClose: () => void;
  onSave: (
    appointment: Appointment,
    options: { notifyClient: boolean },
  ) => Promise<CalendarAppointmentSaveResult>;
  prefillClient?: ClientRecord;
  prefillClientName?: string;
  prefillDate?: string;
  prefillDurationMinutes?: number;
  prefillSpecialistId?: string;
  prefillTime?: string;
  requireSpecialistSelection?: boolean;
  role: AdminRoleId;
  siteSettings: CalendarScheduleSettings;
  specialists?: SpecialistRecord[];
  currentSpecialistId?: string;
};

function CalendarAppointmentCloseButton({ disabled = false, onClose }: { disabled?: boolean; onClose: () => void }) {
  const requestClose = useAdminDrawerClose();

  return (
    <button className="admin-secondary-button" disabled={disabled} onClick={requestClose ?? onClose} type="button">
      Отмена
    </button>
  );
}

export function CalendarAppointmentDialog({
  appointments,
  bookingBufferMinutes,
  calendarBlocks = [],
  clients,
  initialAppointment,
  onClose,
  onSave,
  prefillClient,
  prefillClientName,
  prefillDate,
  prefillDurationMinutes,
  prefillSpecialistId,
  prefillTime,
  requireSpecialistSelection = false,
  role,
  siteSettings,
  specialists = [],
  currentSpecialistId,
}: CalendarAppointmentDialogProps) {
  const workingSchedule = useMemo(
    () => createCalendarWorkingSchedule(siteSettings),
    [siteSettings],
  );
  const activeSpecialists = useMemo(
    () => specialists.filter((specialist) => specialist.status === "active"),
    [specialists],
  );
  const defaultSpecialist =
    activeSpecialists.find((specialist) => specialist.id === prefillSpecialistId) ??
    activeSpecialists.find((specialist) => specialist.id === currentSpecialistId) ??
    activeSpecialists[0];
  const [initialForm] = useState<Appointment>(() => ({
    client: initialAppointment?.client ?? prefillClient?.name ?? prefillClientName ?? "",
    clientId: initialAppointment?.clientId ?? prefillClient?.id,
    bufferMinutes: initialAppointment?.bufferMinutes ?? bookingBufferMinutes,
    date: initialAppointment?.date ?? prefillDate ?? getCalendarIsoDate(workingSchedule),
    durationMinutes: initialAppointment?.durationMinutes ?? prefillDurationMinutes ?? 60,
    id: initialAppointment?.id,
    locale: initialAppointment?.locale,
    note: initialAppointment?.note ?? "",
    origin: initialAppointment?.origin,
    overlapOverride: initialAppointment?.overlapOverride ?? false,
    overlapOverrideReason: initialAppointment?.overlapOverrideReason ?? "",
    overlapOverriddenAt: initialAppointment?.overlapOverriddenAt,
    overlapOverriddenBy: initialAppointment?.overlapOverriddenBy,
    postVisitComment: initialAppointment?.postVisitComment ?? "",
    postVisitCommentedAt: initialAppointment?.postVisitCommentedAt,
    publicContactPreference: initialAppointment?.publicContactPreference,
    publicEmail: initialAppointment?.publicEmail,
    publicNote: initialAppointment?.publicNote,
    publicPhone: initialAppointment?.publicPhone,
    publicReference: initialAppointment?.publicReference,
    service: initialAppointment?.service ?? appointmentServiceOptions[0],
    serviceSlug: initialAppointment?.serviceSlug,
    specialistId: initialAppointment?.specialistId ?? (requireSpecialistSelection ? undefined : defaultSpecialist?.id),
    specialistName: initialAppointment?.specialistName ?? (requireSpecialistSelection ? undefined : defaultSpecialist?.displayName),
    status: initialAppointment?.status ?? "Новая заявка",
    time: initialAppointment?.time ?? prefillTime ?? "14:00",
    version: initialAppointment?.version,
  }));
  const [form, setForm] = useState<Appointment>(() => initialForm);
  const minimumDurationMinutes = Math.min(15, initialForm.durationMinutes ?? 15);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const saveInFlightRef = useRef(false);
  const [notifyClient, setNotifyClient] = useState(true);
  const [activeClientSuggestion, setActiveClientSuggestion] = useState(-1);
  const [areClientSuggestionsDismissed, setAreClientSuggestionsDismissed] = useState(false);
  const clientSuggestionsId = useId();
  const isEditing = Boolean(initialAppointment);
  const isPublicBooking = initialAppointment?.origin === "public";
  const schedulingClassification = useMemo(() => {
    if (!isIsoDate(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) {
      return {
        outsideDailyWorkingHours: false,
        outsideWorkingDay: false,
        outsideWorkingHours: false,
        blockedByCalendarBlock: false,
        overlap: false,
      };
    }

    const candidate = {
      date: form.date,
      duration: form.durationMinutes ?? 60,
      specialistId: form.specialistId,
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
          specialistId: appointment.specialistId,
          start: appointment.time,
        })),
    );
    const blockedByCalendarBlock = isSchedulingBlockingStatus(form.status) && calendarBlocks.some((block) =>
      appointmentOverlapsCalendarBlock(
        { ...candidate, buffer: form.bufferMinutes ?? bookingBufferMinutes },
        block,
      ),
    );
    const appointmentSpecialist = specialists.find(
      (specialist) => specialist.id === form.specialistId,
    );
    const appointmentSchedule = appointmentSpecialist
      ? createSpecialistWorkingSchedule(appointmentSpecialist, siteSettings.timezone)
      : workingSchedule;

    return {
      ...classifyAppointmentAgainstSchedule(candidate, appointmentSchedule),
      blockedByCalendarBlock,
      overlap,
    };
  }, [appointments, bookingBufferMinutes, calendarBlocks, form, siteSettings.timezone, specialists, workingSchedule]);
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
            specialistId: form.specialistId,
            start: form.time,
          },
          {
            date: appointment.date,
            duration: appointment.durationMinutes ?? 60,
            specialistId: appointment.specialistId,
            start: appointment.time,
          },
        ),
    );
  }, [appointments, form]);
  const conflictingCalendarBlock = useMemo(() => {
    if (!isSchedulingBlockingStatus(form.status) || !isIsoDate(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) {
      return undefined;
    }

    return calendarBlocks.find((block) =>
      appointmentOverlapsCalendarBlock(
        {
          date: form.date,
          buffer: form.bufferMinutes ?? bookingBufferMinutes,
          duration: form.durationMinutes ?? 60,
          specialistId: form.specialistId,
          start: form.time,
        },
        block,
      ),
    );
  }, [bookingBufferMinutes, calendarBlocks, form]);
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
  const notificationEmail = getAppointmentNotificationEmail(clients, form);
  const canNotifyClient = (role === "owner" || role === "administrator") && Boolean(notificationEmail.trim());
  const hasUnsavedChanges =
    JSON.stringify(form) !== JSON.stringify(initialForm) ||
    (canNotifyClient && !notifyClient);

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

  function selectSpecialist(specialistId: string) {
    const specialist = activeSpecialists.find((candidate) => candidate.id === specialistId);
    setForm((current) => ({
      ...current,
      specialistId: specialist?.id,
      specialistName: specialist?.displayName,
    }));
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
    if (saveInFlightRef.current) return;

    const client = form.client.trim();

    if (!client || !form.date || !form.time || (activeSpecialists.length > 0 && !form.specialistId)) {
      setError("Укажите клиента, специалиста, дату и время.");
      return;
    }

    const linkedClient = findClientByIdentity(clients, form.clientId) ?? findUniqueClientByName(clients, client);

    if (isSchedulingBlockingStatus(form.status) && schedulingClassification.blockedByCalendarBlock) {
      setError("Выбранное время уже заблокировано. Измените время или специалиста.");
      return;
    }

    const hasBlockingOverlap = isSchedulingBlockingStatus(form.status) && schedulingClassification.overlap;

    if (hasBlockingOverlap && !canOverrideOverlap) {
      setError("Для пересечения записей требуется роль владельца или администратора.");
      return;
    }

    if (hasBlockingOverlap && !form.overlapOverrideReason?.trim()) {
      setError("Укажите причину ручного пересечения записей.");
      return;
    }

    setIsPending(true);
    saveInFlightRef.current = true;
    setError("");
    try {
      const result = await onSave({
        ...form,
        bufferMinutes: initialAppointment ? form.bufferMinutes : bookingBufferMinutes,
        client,
        clientId: linkedClient?.id,
        durationMinutes: Math.max(form.durationMinutes ?? 60, minimumDurationMinutes),
        note: form.note.trim(),
        overlapOverride: hasBlockingOverlap,
        overlapOverrideReason: hasBlockingOverlap ? form.overlapOverrideReason?.trim() : "",
        overlapOverriddenAt: hasBlockingOverlap ? form.overlapOverriddenAt : undefined,
        overlapOverriddenBy: hasBlockingOverlap ? form.overlapOverriddenBy : undefined,
        postVisitComment: form.postVisitComment?.trim(),
        postVisitCommentedAt: form.postVisitComment?.trim()
          ? (form.postVisitCommentedAt ?? new Date().toISOString())
          : undefined,
      }, { notifyClient: canNotifyClient && notifyClient });
      if (result.ok) onClose();
      else setError(result.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить запись.");
    } finally {
      saveInFlightRef.current = false;
      setIsPending(false);
    }
  }

  function closeIfIdle() {
    if (!saveInFlightRef.current) onClose();
  }

  return (
    <AdminDrawer
      ariaLabelledBy="calendar-action-title"
      className="admin-calendar-appointment-drawer"
      hasUnsavedChanges={!isPending && hasUnsavedChanges}
      onClose={closeIfIdle}
    >
      <form
        aria-busy={isPending}
        aria-label={isEditing ? "Форма редактирования записи" : "Форма новой записи"}
        className="admin-drawer-form"
        noValidate
        onSubmit={handleSubmit}
      >
        <AdminDrawerHeader
          closeDisabled={isPending}
          kicker="Календарь"
          onClose={closeIfIdle}
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
                  <p>Услуга зафиксирована клиентом при онлайн-записи. Фактическую длительность можно изменить.</p>
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
              {role === "owner" || role === "administrator" ? (
                <label>
                  Специалист
                  <select
                    aria-invalid={error && !form.specialistId ? "true" : undefined}
                    disabled={activeSpecialists.length === 0}
                    onChange={(event) => selectSpecialist(event.target.value)}
                    required
                    value={form.specialistId ?? ""}
                  >
                    {requireSpecialistSelection && activeSpecialists.length > 0 ? (
                      <option value="">Выберите специалиста</option>
                    ) : null}
                    {activeSpecialists.length === 0 ? (
                      <option value="">Нет доступных специалистов</option>
                    ) : null}
                    {activeSpecialists.map((specialist) => (
                      <option key={specialist.id} value={specialist.id}>
                        {specialist.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="admin-form-readonly" aria-label="Специалист">
                  <span>Специалист</span>
                  <strong>{form.specialistName ?? "Календарь специалиста"}</strong>
                </div>
              )}
            </AdminDrawerSection>

            <AdminDrawerSection title="Дата и статус">
              {schedulingClassification.outsideWorkingHours ||
              schedulingClassification.overlap ||
              schedulingClassification.blockedByCalendarBlock ? (
                <div className="admin-form-alert" role="status">
                  {schedulingClassification.outsideWorkingHours ? (
                    schedulingClassification.outsideWorkingDay ? (
                      <p>Выбран нерабочий день по графику специалиста. Сохранение разрешено.</p>
                    ) : (
                      <p>Время находится вне графика специалиста. Сохранение разрешено.</p>
                    )
                  ) : null}
                  {schedulingClassification.overlap ? (
                    <p>
                      Запись пересекается с {conflictingAppointment?.client ?? "другой записью"}
                      {conflictingAppointment ? ` в ${conflictingAppointment.time}` : ""}.
                    </p>
                  ) : null}
                  {schedulingClassification.blockedByCalendarBlock ? (
                    <p>
                      Время пересекается с блокировкой
                      {conflictingCalendarBlock
                        ? ` ${conflictingCalendarBlock.startsAt} - ${conflictingCalendarBlock.endsAt}`
                        : " в календаре"}
                      . Выберите другой интервал или специалиста.
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
                  min={minimumDurationMinutes}
                  onChange={(event) => updateForm("durationMinutes", Number(event.target.value))}
                  step={minimumDurationMinutes < 15 ? 1 : 15}
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

            {role === "owner" || role === "administrator" ? (
            <AdminDrawerSection title="Email-уведомление">
              <label className="admin-checkbox-field admin-form-wide">
                <input
                  aria-describedby={`${clientSuggestionsId}-notification-helper`}
                  checked={canNotifyClient && notifyClient}
                  disabled={!canNotifyClient}
                  onChange={(event) => setNotifyClient(event.target.checked)}
                  type="checkbox"
                />
                <span>{isEditing ? "Уведомить клиента об изменении записи" : "Отправить клиенту подтверждение записи"}</span>
              </label>
              <p className="admin-form-helper" id={`${clientSuggestionsId}-notification-helper`}>
                {canNotifyClient
                  ? `Письмо будет отправлено на ${notificationEmail}.`
                  : "У выбранного клиента нет email. Уведомление недоступно, но запись можно сохранить."}
              </p>
            </AdminDrawerSection>
            ) : null}
          </div>
        </AdminDrawerBody>

        <AdminDrawerFooter>
          <button className="admin-primary-button" disabled={isPending} type="submit">
            {isPending ? "Сохранение…" : isEditing ? "Сохранить изменения" : "Сохранить запись"}
          </button>
          <CalendarAppointmentCloseButton disabled={isPending} onClose={closeIfIdle} />
        </AdminDrawerFooter>
      </form>
    </AdminDrawer>
  );
}
