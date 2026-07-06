"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import {
  calculateFinanceSummary,
  getAdminModule,
  getAdminNavigationForRole,
  roleLabels,
  type AdminRoleId,
  type AdminSectionId,
  type FinanceRow,
} from "@/admin/config";
import {
  certificateRows,
  clientRows,
  dashboardMetrics,
  financeRows,
  sectionSamples,
  upcomingAppointments,
} from "@/admin/demo-data";

type AdminShellProps = {
  activeSection: AdminSectionId;
  role: AdminRoleId;
  selectedClientName?: string;
};

type AppointmentStatus = "Подтверждена" | "Ожидает" | "Новая заявка" | "Отменена";
type Appointment = {
  id?: string;
  date: string;
  time: string;
  client: string;
  service: string;
  status: AppointmentStatus;
};
type ClientVisit = {
  date: string;
  service: string;
  status: string;
};
type ClientRecord = {
  email: string;
  history: ClientVisit[];
  language: string;
  name: string;
  next: string;
  note: string;
  phone: string;
  preferredContact: string;
  status: string;
  tags: string[];
  telegram: string;
  totalSpend: string;
  visits: number;
};
type CalendarMode = "day" | "week" | "month" | "list";
type ClientCertificate = (typeof certificateRows)[number];

const groupedNavigation = ["Операции", "Контент", "Финансы", "Система"] as const;
const clientFilterOptions = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "ru", label: "RU" },
  { id: "bg", label: "BG" },
] as const;
type ClientFilterId = (typeof clientFilterOptions)[number]["id"];
const appointmentServiceOptions = ["Классический массаж", "Лимфодренажный массаж", "Deep tissue massage", "SPA процедура"] as const;
const appointmentStatusOptions: AppointmentStatus[] = ["Новая заявка", "Ожидает", "Подтверждена", "Отменена"];
const calendarModes: Array<{ id: CalendarMode; label: string }> = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "list", label: "Список" },
];
const calendarMonthLabel = "Июль 2026";
const calendarWeekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const calendarMonthDays = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;

  return {
    date: `2026-07-${String(day).padStart(2, "0")}`,
    day,
  };
});
const calendarLeadingBlankDays = 2;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "EUR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function statusClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes("ожидает") || normalizedStatus.includes("новая")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("отмен") || normalizedStatus.includes("возврат")) {
    return "admin-status admin-status-danger";
  }

  return "admin-status admin-status-success";
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function matchesSearch(values: Array<string | number | undefined>, query: string) {
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => String(value ?? "").toLocaleLowerCase("ru-RU").includes(normalizedQuery));
}

function buildInitialClientRows(): ClientRecord[] {
  return clientRows.map((client) => ({
    ...client,
    history: client.history.map((visit) => ({ ...visit })),
    tags: [...client.tags],
  }));
}

function findClientByName(clients: ClientRecord[], name: string | undefined) {
  const normalizedName = name ? normalizeSearch(name) : "";

  if (!normalizedName) {
    return undefined;
  }

  return clients.find((client) => normalizeSearch(client.name) === normalizedName);
}

function findClientCertificates(clientName: string): ClientCertificate[] {
  const normalizedName = normalizeSearch(clientName);

  return certificateRows.filter((certificate) => normalizeSearch(certificate.clientName) === normalizedName);
}

function matchesClientFilter(client: ClientRecord, filter: ClientFilterId) {
  if (filter === "active") {
    return normalizeSearch(client.status).startsWith("актив");
  }

  if (filter === "ru" || filter === "bg") {
    return normalizeSearch(client.language) === filter;
  }

  return true;
}

function clientProfileHref(clientName: string, role: AdminRoleId) {
  return `/admin?section=clients&role=${role}&client=${encodeURIComponent(clientName)}`;
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function appointmentKey(appointment: Appointment) {
  return appointment.id ?? `${appointment.date}-${appointment.time}-${appointment.client}`;
}

function sortAppointments(appointments: Appointment[]) {
  return [...appointments].sort((first, second) =>
    `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`),
  );
}

function buildInitialCalendarAppointments() {
  return upcomingAppointments.map((appointment, index) => ({
    ...appointment,
    id: `demo-${index + 1}`,
  }));
}

function calendarModeLabel(mode: CalendarMode) {
  return calendarModes.find((item) => item.id === mode)?.label ?? "День";
}

function formatCalendarDay(date: string) {
  return `${Number(date.slice(-2))} июля`;
}

function appointmentCountLabel(count: number) {
  if (count === 1) {
    return "1 запись";
  }

  if (count > 1 && count < 5) {
    return `${count} записи`;
  }

  return `${count} записей`;
}

function paymentCountLabel(count: number) {
  if (count === 1) {
    return "1 платеж";
  }

  if (count > 1 && count < 5) {
    return `${count} платежа`;
  }

  return `${count} платежей`;
}

function matchesDatePeriod(date: string | undefined, startDate: string, endDate: string) {
  if (!date) {
    return false;
  }

  const startsAfterOrAtStart = startDate ? date >= startDate : true;
  const endsBeforeOrAtEnd = endDate ? date <= endDate : true;

  return startsAfterOrAtStart && endsBeforeOrAtEnd;
}

function formatFinancePeriod(startDate: string, endDate: string) {
  if (startDate && endDate) {
    return `${startDate} - ${endDate}`;
  }

  if (startDate) {
    return `с ${startDate}`;
  }

  if (endDate) {
    return `по ${endDate}`;
  }

  return "весь период";
}

function csvCell(value: string | number | undefined) {
  const stringValue = String(value ?? "");

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function buildFinanceCsv(rows: FinanceRow[]) {
  const header = ["date", "payment_id", "certificate", "buyer", "gross_eur", "stripe_fee_eur", "refund_eur", "net_eur", "status"];
  const body = rows.map((row) => [
    row.date,
    row.id,
    row.certificateCode,
    row.buyer,
    row.gross.toFixed(2),
    row.stripeFee.toFixed(2),
    row.refund.toFixed(2),
    (row.gross - row.refund - row.stripeFee).toFixed(2),
    row.status,
  ]);

  return [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined" || typeof Blob === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }

  if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
    return;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EmptyState({ label }: { label: string }) {
  return <p className="admin-empty-state">{label}</p>;
}

function QuickActionDialog({
  action,
  moduleTitle,
  onClose,
}: {
  action: string;
  moduleTitle: string;
  onClose: () => void;
}) {
  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="admin-action-title" className="admin-action-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">{moduleTitle}</span>
            <h2 id="admin-action-title">Быстрое действие</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <div className="admin-action-body">
          <label>
            Действие
            <input readOnly value={action} />
          </label>
          <label>
            Ответственный
            <input readOnly value="Natali" />
          </label>
          <label>
            Статус
            <select defaultValue="draft">
              <option value="draft">Черновик</option>
              <option value="review">На проверке</option>
              <option value="ready">Готово</option>
            </select>
          </label>
        </div>

        <div className="admin-action-footer">
          <button onClick={onClose} type="button">
            Сохранить черновик
          </button>
          <button className="admin-secondary-button" onClick={onClose} type="button">
            Отмена
          </button>
        </div>
      </section>
    </div>
  );
}

function CalendarAppointmentDialog({
  initialAppointment,
  onClose,
  onSave,
}: {
  initialAppointment?: Appointment;
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
}) {
  const [form, setForm] = useState<Appointment>({
    client: initialAppointment?.client ?? "",
    date: initialAppointment?.date ?? "2026-07-06",
    id: initialAppointment?.id,
    service: initialAppointment?.service ?? appointmentServiceOptions[0],
    status: initialAppointment?.status ?? "Новая заявка",
    time: initialAppointment?.time ?? "14:00",
  });
  const [error, setError] = useState("");
  const isEditing = Boolean(initialAppointment);

  function updateForm<Field extends keyof Appointment>(field: Field, value: Appointment[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = form.client.trim();

    if (!client || !form.date || !form.time) {
      setError("Укажите клиента, дату и время.");
      return;
    }

    onSave({ ...form, client });
    onClose();
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="calendar-action-title" aria-modal="true" className="admin-action-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Календарь</span>
            <h2 id="calendar-action-title">{isEditing ? "Редактировать запись" : "Новая запись"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body">
            <label>
              Клиент
              <input
                aria-invalid={error && !form.client.trim() ? "true" : undefined}
                autoComplete="name"
                onChange={(event) => updateForm("client", event.target.value)}
                required
                type="text"
                value={form.client}
              />
            </label>
            {error ? (
              <p className="admin-form-alert" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Услуга
              <select onChange={(event) => updateForm("service", event.target.value)} value={form.service}>
                {appointmentServiceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>
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
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить запись"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CalendarAppointmentCancelDialog({
  appointment,
  onClose,
  onConfirm,
}: {
  appointment: Appointment;
  onClose: () => void;
  onConfirm: (appointment: Appointment) => void;
}) {
  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="calendar-cancel-title" aria-modal="true" className="admin-action-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Календарь</span>
            <h2 id="calendar-cancel-title">Отменить запись</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <p className="admin-confirm-copy">
          Запись клиента <strong>{appointment.client}</strong> на {formatCalendarDay(appointment.date)} в{" "}
          <strong>{appointment.time}</strong> будет отмечена как отмененная. История останется в календаре.
        </p>
        <div className="admin-confirm-summary" aria-label="Запись для отмены">
          <span>{appointment.service}</span>
          <span className={statusClass(appointment.status)}>{appointment.status}</span>
        </div>

        <div className="admin-action-footer">
          <button className="admin-danger-action" onClick={() => onConfirm(appointment)} type="button">
            Подтвердить отмену
          </button>
          <button className="admin-secondary-button" onClick={onClose} type="button">
            Оставить запись
          </button>
        </div>
      </section>
    </div>
  );
}

function DashboardWorkspace({ query, role }: { query: string; role: AdminRoleId }) {
  const filteredAppointments = upcomingAppointments.filter((appointment) =>
    matchesSearch([appointment.time, appointment.client, appointment.service, appointment.status], query),
  );
  const filteredCertificates = certificateRows.filter((certificate) =>
    matchesSearch([certificate.code, certificate.buyer, certificate.clientName, certificate.recipient, certificate.status], query),
  );

  return (
    <div className="admin-dashboard-grid">
      <section className="admin-metric-row" aria-label="Ключевые показатели">
        {dashboardMetrics.map((metric) => (
          <article className={`admin-metric admin-metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel admin-panel-large" aria-labelledby="appointments-heading">
        <div className="admin-panel-head">
          <h2 id="appointments-heading">Ближайшие записи</h2>
          <Link className="admin-text-action" href={`/admin?section=calendar&role=${role}`}>
            Открыть календарь
          </Link>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Клиент</th>
                <th>Услуга</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appointment) => (
                <tr key={appointmentKey(appointment)}>
                  <td className="admin-tabular">{appointment.time}</td>
                  <td>{appointment.client}</td>
                  <td>{appointment.service}</td>
                  <td>
                    <span className={statusClass(appointment.status)}>{appointment.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAppointments.length === 0 ? <EmptyState label="По этому запросу записей нет." /> : null}
      </section>

      <section className="admin-panel" aria-labelledby="certificate-heading">
        <div className="admin-panel-head">
          <h2 id="certificate-heading">Сертификаты</h2>
          <Link className="admin-text-action" href={`/admin?section=certificates&role=${role}`}>
            Все
          </Link>
        </div>
        <div className="admin-list">
          {filteredCertificates.map((certificate) => (
            <article className="admin-list-item" key={certificate.code}>
              <div>
                <strong>{certificate.code}</strong>
                <span>
                  {certificate.buyer} {"->"} {certificate.recipient}
                </span>
              </div>
              <span className={statusClass(certificate.status)}>{certificate.status}</span>
            </article>
          ))}
        </div>
        {filteredCertificates.length === 0 ? <EmptyState label="Сертификаты не найдены." /> : null}
      </section>
    </div>
  );
}

function ClientDetailCard({
  certificates,
  client,
  onSaveNote,
}: {
  certificates: ClientCertificate[];
  client: ClientRecord;
  onSaveNote: (clientName: string, note: string) => void;
}) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(client.note);
  const [saveNotice, setSaveNotice] = useState("");
  const clientInitials = client.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function startNoteEdit() {
    setDraftNote(client.note);
    setSaveNotice("");
    setIsEditingNote(true);
  }

  function cancelNoteEdit() {
    setDraftNote(client.note);
    setIsEditingNote(false);
  }

  function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextNote = draftNote.trim();
    onSaveNote(client.name, nextNote);
    setDraftNote(nextNote);
    setIsEditingNote(false);
    setSaveNotice("Заметка сохранена.");
  }

  return (
    <aside className="admin-panel admin-client-card" aria-label="Карточка клиента">
      <span className="admin-kicker">Карточка клиента</span>
      <div className="admin-client-profile-head">
        <span className="admin-client-avatar" aria-hidden="true">
          {clientInitials}
        </span>
        <div>
          <h2>{client.name}</h2>
          <p>
            {client.language.toUpperCase()} · {client.status}
          </p>
        </div>
      </div>

      <dl className="admin-client-contact-list">
        <div>
          <dt>Телефон</dt>
          <dd className="admin-tabular">{client.phone}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{client.email}</dd>
        </div>
        <div>
          <dt>Канал связи</dt>
          <dd>{client.preferredContact}</dd>
        </div>
      </dl>

      <div className="admin-client-actions" aria-label="Быстрые действия клиента">
        <a className="admin-outline-action" href={phoneHref(client.phone)}>
          Позвонить
        </a>
        <a className="admin-outline-action" href={`mailto:${client.email}`}>
          Email
        </a>
        <a className="admin-outline-action" href={client.telegram} rel="noreferrer" target="_blank">
          Telegram
        </a>
      </div>

      <div className="admin-client-metrics" aria-label="Показатели клиента">
        <div>
          <span>Визиты</span>
          <strong>{client.visits}</strong>
        </div>
        <div>
          <span>Следующий</span>
          <strong>{client.next}</strong>
        </div>
        <div>
          <span>Сумма</span>
          <strong>{client.totalSpend}</strong>
        </div>
      </div>

      <section className="admin-client-section">
        <h3>История визитов</h3>
        <ol className="admin-client-history">
          {client.history.map((visit) => (
            <li key={`${visit.date}-${visit.service}`}>
              <div>
                <strong>{visit.service}</strong>
                <span>{visit.date}</span>
              </div>
              <span className={statusClass(visit.status)}>{visit.status}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="admin-client-section">
        <h3>Сертификаты</h3>
        {certificates.length > 0 ? (
          <ul className="admin-client-certificates">
            {certificates.map((certificate) => (
              <li key={certificate.code}>
                <div>
                  <strong>{certificate.code}</strong>
                  <span>
                    {certificate.buyer} → {certificate.recipient}
                  </span>
                </div>
                <div>
                  <strong>{certificate.amount}</strong>
                  <span className={statusClass(certificate.status)}>{certificate.status}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Сертификатов пока нет.</p>
        )}
      </section>

      <section className="admin-client-section">
        <div className="admin-client-section-head">
          <h3>Заметки</h3>
          {isEditingNote ? null : (
            <button className="admin-outline-action" onClick={startNoteEdit} type="button">
              Редактировать заметку
            </button>
          )}
        </div>
        {isEditingNote ? (
          <form className="admin-client-note-form" onSubmit={handleNoteSubmit}>
            <label htmlFor="admin-client-note-editor">Заметка клиента</label>
            <textarea
              id="admin-client-note-editor"
              onChange={(event) => setDraftNote(event.target.value)}
              rows={5}
              value={draftNote}
            />
            <div className="admin-client-note-actions">
              <button className="admin-text-action" type="submit">
                Сохранить заметку
              </button>
              <button className="admin-outline-action" onClick={cancelNoteEdit} type="button">
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <p>{client.note || "Заметка пока пустая."}</p>
        )}
        {saveNotice ? (
          <p className="admin-client-save-notice" role="status">
            {saveNotice}
          </p>
        ) : null}
        <div className="admin-client-tags" aria-label="Теги клиента">
          {client.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function ClientsWorkspace({
  clients,
  onSaveClientNote,
  query,
  selectedClientName,
}: {
  clients: ClientRecord[];
  onSaveClientNote: (clientName: string, note: string) => void;
  query: string;
  selectedClientName?: string;
}) {
  const initialSelectedClientName = findClientByName(clients, selectedClientName)?.name ?? clients[0]?.name ?? "";
  const [selectedName, setSelectedName] = useState(initialSelectedClientName);
  const [clientFilter, setClientFilter] = useState<ClientFilterId>("all");
  const filteredClients = clients.filter(
    (client) =>
      matchesClientFilter(client, clientFilter) &&
      matchesSearch(
        [
          client.name,
          client.phone,
          client.email,
          client.language,
          client.visits,
          client.next,
          client.status,
          client.preferredContact,
          client.note,
        ],
        query,
      ),
  );
  const selectedClient =
    findClientByName(filteredClients, selectedName) ?? filteredClients[0] ?? findClientByName(clients, selectedName) ?? clients[0];

  if (!selectedClient) {
    return <EmptyState label="Клиенты не найдены." />;
  }

  return (
    <div className="admin-split-view admin-clients-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="clients-heading">
        <div className="admin-panel-head">
          <h2 id="clients-heading">Клиентская база</h2>
          <div className="admin-filter-row" aria-label="Фильтры клиентов">
            {clientFilterOptions.map((filter) => (
              <button
                aria-pressed={clientFilter === filter.id}
                key={filter.id}
                onClick={() => setClientFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Язык</th>
                <th>Визиты</th>
                <th>Следующий визит</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr aria-selected={client.name === selectedClient.name} key={client.phone}>
                  <td>
                    <button className="admin-row-action" onClick={() => setSelectedName(client.name)} type="button">
                      {client.name}
                    </button>
                  </td>
                  <td className="admin-tabular">{client.phone}</td>
                  <td>{client.language.toUpperCase()}</td>
                  <td className="admin-tabular">{client.visits}</td>
                  <td>{client.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredClients.length === 0 ? <EmptyState label="Клиенты не найдены." /> : null}
      </section>

      <ClientDetailCard
        certificates={findClientCertificates(selectedClient.name)}
        key={selectedClient.name}
        client={selectedClient}
        onSaveNote={onSaveClientNote}
      />
    </div>
  );
}

function CalendarWorkspace({
  appointments,
  clients,
  onCancelAppointment,
  onEditAppointment,
  query,
  role,
}: {
  appointments: Appointment[];
  clients: ClientRecord[];
  onCancelAppointment: (appointment: Appointment) => void;
  onEditAppointment: (appointment: Appointment) => void;
  query: string;
  role: AdminRoleId;
}) {
  const fallbackAppointment = appointments[0] ?? {
    client: "Нет записи",
    date: "2026-07-06",
    service: "Не выбрано",
    status: "Новая заявка" as const,
    time: "00:00",
  };
  const filteredAppointments = appointments.filter((appointment) =>
    matchesSearch([appointment.date, appointment.time, appointment.client, appointment.service, appointment.status], query),
  );
  const [mode, setMode] = useState<CalendarMode>("day");
  const [selectedDate, setSelectedDate] = useState("2026-07-06");
  const [selectedKey, setSelectedKey] = useState(() => appointmentKey(appointments[1] ?? fallbackAppointment));
  const selectedDayAppointments = filteredAppointments.filter((appointment) => appointment.date === selectedDate);
  const selectedAppointment =
    filteredAppointments.find((appointment) => appointmentKey(appointment) === selectedKey) ??
    selectedDayAppointments[0] ??
    filteredAppointments[0] ??
    fallbackAppointment;
  const selectedAppointmentKey = appointmentKey(selectedAppointment);
  const calendarHeading = mode === "month" ? calendarMonthLabel : calendarModeLabel(mode);
  const selectedAppointmentClient = findClientByName(clients, selectedAppointment.client);

  function selectAppointment(appointment: Appointment) {
    setSelectedDate(appointment.date);
    setSelectedKey(appointmentKey(appointment));
  }

  function selectDate(date: string, appointments: Appointment[]) {
    setSelectedDate(date);

    if (appointments[0]) {
      setSelectedKey(appointmentKey(appointments[0]));
    }
  }

  return (
    <div className="admin-split-view">
      <section className="admin-panel admin-calendar-panel" aria-labelledby="calendar-heading">
        <div className="admin-panel-head">
          <h2 id="calendar-heading">{calendarHeading}</h2>
          <div className="admin-filter-row" aria-label="Режимы календаря">
            {calendarModes.map((calendarMode) => (
              <button
                aria-pressed={mode === calendarMode.id}
                key={calendarMode.id}
                onClick={() => setMode(calendarMode.id)}
                type="button"
              >
                {calendarMode.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "month" ? (
          <div className="admin-calendar-month-grid" role="grid" aria-label={`Месяц ${calendarMonthLabel}`}>
            {calendarWeekdayLabels.map((weekday) => (
              <span className="admin-calendar-weekday" key={weekday} role="columnheader">
                {weekday}
              </span>
            ))}
            {Array.from({ length: calendarLeadingBlankDays }, (_, index) => (
              <span aria-hidden="true" className="admin-calendar-month-cell admin-calendar-month-cell-empty" key={`blank-${index}`} role="gridcell" />
            ))}
            {calendarMonthDays.map((day) => {
              const dayAppointments = filteredAppointments.filter((appointment) => appointment.date === day.date);
              const countLabel = appointmentCountLabel(dayAppointments.length);

              return (
                <span className="admin-calendar-month-cell" key={day.date} role="gridcell">
                  <button
                    aria-label={`${day.day} июля, ${countLabel}`}
                    aria-pressed={selectedDate === day.date}
                    className="admin-calendar-day-button"
                    onClick={() => selectDate(day.date, dayAppointments)}
                    type="button"
                  >
                    <strong>{day.day}</strong>
                    {dayAppointments.slice(0, 2).map((appointment) => (
                      <span className="admin-month-event" key={appointmentKey(appointment)}>
                        <time className="admin-tabular">{appointment.time}</time>
                        <span>{appointment.service}</span>
                      </span>
                    ))}
                    <small>
                      <span className="admin-month-count-full">{countLabel}</span>
                      <span className="admin-month-count-compact">{dayAppointments.length}</span>
                    </small>
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="admin-calendar-list">
            {filteredAppointments.map((appointment) => {
              const key = appointmentKey(appointment);

              return (
                <button
                  aria-pressed={key === selectedAppointmentKey}
                  className="admin-calendar-item"
                  key={key}
                  onClick={() => selectAppointment(appointment)}
                  type="button"
                >
                  <time className="admin-tabular">{appointment.time}</time>
                  <span>
                    <strong>{appointment.client}</strong>
                    <small>
                      {formatCalendarDay(appointment.date)} · {appointment.service}
                    </small>
                  </span>
                  <span className={statusClass(appointment.status)}>{appointment.status}</span>
                </button>
              );
            })}
          </div>
        )}
        {filteredAppointments.length === 0 ? <EmptyState label="Записи не найдены." /> : null}
      </section>

      <aside className="admin-panel admin-detail-panel" aria-label="Детали выбранной записи">
        <span className="admin-kicker">Правая панель</span>
        {mode === "month" ? (
          <>
            <h2>{formatCalendarDay(selectedDate)}</h2>
            <div className="admin-selected-day-list">
              {selectedDayAppointments.length > 0 ? (
                selectedDayAppointments.map((appointment) => (
                  <article className="admin-selected-day-item" key={appointmentKey(appointment)}>
                    <time className="admin-tabular">{appointment.time}</time>
                    <div>
                      <strong>{appointment.client}</strong>
                      <span>{appointment.service}</span>
                    </div>
                    <span className={statusClass(appointment.status)}>{appointment.status}</span>
                  </article>
                ))
              ) : (
                <EmptyState label="На выбранный день записей нет." />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="admin-detail-heading">
              <h2>{selectedAppointment.client}</h2>
              <div className="admin-detail-actions">
                {selectedAppointmentClient ? (
                  <Link className="admin-outline-action" href={clientProfileHref(selectedAppointment.client, role)}>
                    Открыть клиента
                  </Link>
                ) : null}
                <button className="admin-text-action" onClick={() => onEditAppointment(selectedAppointment)} type="button">
                  Редактировать
                </button>
                {selectedAppointment.status === "Отменена" ? null : (
                  <button
                    className="admin-danger-button"
                    onClick={() => onCancelAppointment(selectedAppointment)}
                    type="button"
                  >
                    Отменить
                  </button>
                )}
              </div>
            </div>
            <dl className="admin-detail-list">
              <div>
                <dt>Дата</dt>
                <dd>{formatCalendarDay(selectedAppointment.date)}</dd>
              </div>
              <div>
                <dt>Услуга</dt>
                <dd>{selectedAppointment.service}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  <span className={statusClass(selectedAppointment.status)}>{selectedAppointment.status}</span>
                </dd>
              </div>
              <div>
                <dt>Время</dt>
                <dd>{selectedAppointment.time}</dd>
              </div>
            </dl>
          </>
        )}
      </aside>
    </div>
  );
}

function FinanceWorkspace({ query }: { query: string }) {
  const [exportNotice, setExportNotice] = useState("");
  const [periodStart, setPeriodStart] = useState("2026-07-01");
  const [periodEnd, setPeriodEnd] = useState("2026-07-03");
  const filteredFinanceRows = useMemo(
    () =>
      financeRows.filter((row) =>
        matchesDatePeriod(row.date, periodStart, periodEnd) &&
        matchesSearch([row.date, row.id, row.certificateCode, row.buyer, row.status, row.gross, row.refund], query),
      ),
    [periodEnd, periodStart, query],
  );
  const currentSummary = useMemo(() => calculateFinanceSummary(filteredFinanceRows), [filteredFinanceRows]);
  const financePeriod = formatFinancePeriod(periodStart, periodEnd);

  function handleExport(format: "CSV" | "XLSX" | "PDF") {
    if (format === "CSV") {
      downloadCsv("magic-massage-stripe-sales.csv", buildFinanceCsv(filteredFinanceRows));
    }

    setExportNotice(`${format} отчет за ${financePeriod} готов к скачиванию.`);
  }

  return (
    <section className="admin-panel admin-panel-large" aria-labelledby="finance-heading">
      <div className="admin-panel-head admin-panel-head-finance">
        <div>
          <h2 id="finance-heading">Stripe-продажи за период</h2>
          <p>Период считается по timezone бизнеса Europe/Sofia.</p>
        </div>
        <div className="admin-export-actions" aria-label="Форматы выгрузки">
          <button onClick={() => handleExport("CSV")} type="button">
            CSV
          </button>
          <button onClick={() => handleExport("XLSX")} type="button">
            XLSX
          </button>
          <button onClick={() => handleExport("PDF")} type="button">
            PDF
          </button>
        </div>
      </div>

      <div className="admin-finance-period" aria-label="Период продаж Stripe">
        <label>
          <span>С</span>
          <input
            aria-label="Начало периода"
            onChange={(event) => setPeriodStart(event.target.value)}
            type="date"
            value={periodStart}
          />
        </label>
        <label>
          <span>По</span>
          <input
            aria-label="Конец периода"
            onChange={(event) => setPeriodEnd(event.target.value)}
            type="date"
            value={periodEnd}
          />
        </label>
        <p>
          Показано <strong>{paymentCountLabel(currentSummary.payments)}</strong> за <strong>{financePeriod}</strong>.
        </p>
      </div>

      {exportNotice ? (
        <p className="admin-export-notice" role="status">
          {exportNotice}
        </p>
      ) : null}

      <div className="admin-finance-summary" aria-label="Finance summary">
        <article>
          <span>Gross</span>
          <strong>{formatCurrency(currentSummary.gross)}</strong>
        </article>
        <article>
          <span>Refunds</span>
          <strong>{formatCurrency(currentSummary.refunds)}</strong>
        </article>
        <article>
          <span>Stripe fees</span>
          <strong>{formatCurrency(currentSummary.stripeFees)}</strong>
        </article>
        <article>
          <span>Net</span>
          <strong>{formatCurrency(currentSummary.net)}</strong>
        </article>
        <article>
          <span>Payments</span>
          <strong>{currentSummary.payments}</strong>
        </article>
      </div>

      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Платеж</th>
              <th>Сертификат</th>
              <th>Покупатель</th>
              <th>Gross</th>
              <th>Fee</th>
              <th>Refund</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredFinanceRows.map((row) => (
              <tr key={row.id}>
                <td className="admin-tabular">{row.date}</td>
                <td className="admin-tabular">{row.id}</td>
                <td>{row.certificateCode}</td>
                <td>{row.buyer}</td>
                <td className="admin-tabular">{formatCurrency(row.gross)}</td>
                <td className="admin-tabular">{formatCurrency(row.stripeFee)}</td>
                <td className="admin-tabular">{formatCurrency(row.refund)}</td>
                <td className="admin-tabular">{formatCurrency(row.gross - row.refund - row.stripeFee)}</td>
                <td>
                  <span className={statusClass(row.status ?? "Оплачено")}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredFinanceRows.length === 0 ? <EmptyState label="Платежи не найдены." /> : null}

      <div className="admin-finance-footer">
        <span>Последняя выгрузка: 2026-07-03 18:20</span>
        <span>
          Следующая выгрузка будет записана в <strong>audit log</strong>
        </span>
      </div>
    </section>
  );
}

function GenericWorkspace({ query, section }: { query: string; section: AdminSectionId }) {
  const sectionModule = getAdminModule(section);
  const filteredItems = sectionSamples[section].filter((item) => matchesSearch([item, sectionModule.title], query));
  const [selectedItem, setSelectedItem] = useState(filteredItems[0] ?? sectionSamples[section][0]);
  const visibleSelectedItem = filteredItems.includes(selectedItem) ? selectedItem : filteredItems[0];

  return (
    <div className="admin-split-view">
      <section className="admin-panel admin-panel-large" aria-labelledby={`${section}-workspace-heading`}>
        <div className="admin-panel-head">
          <h2 id={`${section}-workspace-heading`}>Рабочий список</h2>
          <div className="admin-filter-row" aria-label="Фильтры раздела">
            <button aria-pressed="true" type="button">
              Все
            </button>
            <button type="button">Активные</button>
            <button type="button">Черновики</button>
          </div>
        </div>
        <div className="admin-module-grid">
          {filteredItems.map((item) => (
            <button className="admin-module-tile" key={item} onClick={() => setSelectedItem(item)} type="button">
              <strong>{item}</strong>
              <span>{sectionModule.title}</span>
            </button>
          ))}
        </div>
        {filteredItems.length === 0 ? <EmptyState label="Элементы не найдены." /> : null}
      </section>

      <aside className="admin-panel admin-detail-panel" aria-label="Детали выбранного объекта">
        <span className="admin-kicker">Детали</span>
        <h2>{visibleSelectedItem ?? sectionModule.title}</h2>
        <p>{sectionModule.description}</p>
        <dl className="admin-detail-list">
          <div>
            <dt>Публикация</dt>
            <dd>
              <span className="admin-status admin-status-warning">Черновик</span>
            </dd>
          </div>
          <div>
            <dt>Локализации</dt>
            <dd>bg, ru, ua, en</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function Workspace({
  appointments,
  clients,
  onCancelAppointment,
  onEditAppointment,
  onSaveClientNote,
  query,
  role,
  section,
  selectedClientName,
}: {
  appointments: Appointment[];
  clients: ClientRecord[];
  onCancelAppointment: (appointment: Appointment) => void;
  onEditAppointment: (appointment: Appointment) => void;
  onSaveClientNote: (clientName: string, note: string) => void;
  query: string;
  role: AdminRoleId;
  section: AdminSectionId;
  selectedClientName?: string;
}) {
  if (section === "dashboard") {
    return <DashboardWorkspace query={query} role={role} />;
  }

  if (section === "clients") {
    return (
      <ClientsWorkspace
        clients={clients}
        key={selectedClientName ?? "default-client"}
        onSaveClientNote={onSaveClientNote}
        query={query}
        selectedClientName={selectedClientName}
      />
    );
  }

  if (section === "calendar") {
    return (
      <CalendarWorkspace
        appointments={appointments}
        clients={clients}
        onCancelAppointment={onCancelAppointment}
        onEditAppointment={onEditAppointment}
        query={query}
        role={role}
      />
    );
  }

  if (section === "finances") {
    return <FinanceWorkspace query={query} />;
  }

  return <GenericWorkspace query={query} section={section} />;
}

export function AdminShell({ activeSection, role, selectedClientName }: AdminShellProps) {
  const navigation = getAdminNavigationForRole(role);
  const activeModule = getAdminModule(activeSection);
  const [query, setQuery] = useState("");
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | undefined>();
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>();
  const [calendarAppointments, setCalendarAppointments] = useState<Appointment[]>(() => buildInitialCalendarAppointments());
  const [clients, setClients] = useState<ClientRecord[]>(() => buildInitialClientRows());

  function handleAppointmentCreate(appointment: Appointment) {
    setCalendarAppointments((current) =>
      sortAppointments([
        ...current,
        {
          ...appointment,
          id: `custom-${current.length + 1}`,
        },
      ]),
    );
  }

  function handleAppointmentUpdate(appointment: Appointment) {
    setCalendarAppointments((current) =>
      sortAppointments(
        current.map((currentAppointment) =>
          appointmentKey(currentAppointment) === appointmentKey(appointment) ? appointment : currentAppointment,
        ),
      ),
    );
  }

  function openPrimaryAction() {
    setEditingAppointment(undefined);
    setIsActionOpen(true);
  }

  function openAppointmentEdit(appointment: Appointment) {
    setCancellingAppointment(undefined);
    setEditingAppointment(appointment);
    setIsActionOpen(true);
  }

  function openAppointmentCancel(appointment: Appointment) {
    setEditingAppointment(undefined);
    setIsActionOpen(false);
    setCancellingAppointment(appointment);
  }

  function closeActionDialog() {
    setIsActionOpen(false);
    setEditingAppointment(undefined);
  }

  function closeCancelDialog() {
    setCancellingAppointment(undefined);
  }

  function saveCalendarAppointment(appointment: Appointment) {
    if (editingAppointment) {
      handleAppointmentUpdate(appointment);
    } else {
      handleAppointmentCreate(appointment);
    }

    closeActionDialog();
  }

  function cancelCalendarAppointment(appointment: Appointment) {
    handleAppointmentUpdate({ ...appointment, status: "Отменена" });
    closeCancelDialog();
  }

  function saveClientNote(clientName: string, note: string) {
    setClients((current) =>
      current.map((client) => (normalizeSearch(client.name) === normalizeSearch(clientName) ? { ...client, note } : client)),
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href={`/admin?role=${role}`} aria-label="Magic Massage Natali admin home">
          <span>MMN</span>
          <strong>Magic Massage Natali</strong>
        </Link>

        <nav className="admin-nav" aria-label="Admin sections">
          {groupedNavigation.map((group) => {
            const groupItems = navigation.filter((item) => item.group === group);

            if (groupItems.length === 0) {
              return null;
            }

            return (
              <div className="admin-nav-group" key={group}>
                <span>{group}</span>
                {groupItems.map((item) => (
                  <Link
                    aria-current={item.id === activeSection ? "page" : undefined}
                    href={`/admin?section=${item.id}&role=${role}`}
                    key={item.id}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-search" role="search">
            <label htmlFor="admin-search-input">Поиск</label>
            <input
              id="admin-search-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Клиент, сертификат, платеж"
              type="search"
              value={query}
            />
          </div>
          <div className="admin-user-chip" aria-label="Текущая роль и профиль">
            <span>{roleLabels[role]}</span>
            <strong>Профиль</strong>
          </div>
        </header>

        <section className="admin-page-head" aria-labelledby="admin-page-title">
          <div>
            <span className="admin-kicker">{activeModule.group}</span>
            <h1 id="admin-page-title">{activeModule.title}</h1>
            <p>{activeModule.description}</p>
          </div>
          <button onClick={openPrimaryAction} type="button">
            {activeModule.primaryAction}
          </button>
        </section>

        <Workspace
          appointments={calendarAppointments}
          clients={clients}
          onCancelAppointment={openAppointmentCancel}
          onEditAppointment={openAppointmentEdit}
          onSaveClientNote={saveClientNote}
          query={query}
          role={role}
          section={activeSection}
          selectedClientName={selectedClientName}
        />

        {isActionOpen && activeSection === "calendar" ? (
          <CalendarAppointmentDialog
            initialAppointment={editingAppointment}
            onClose={closeActionDialog}
            onSave={saveCalendarAppointment}
          />
        ) : isActionOpen ? (
          <QuickActionDialog
            action={activeModule.primaryAction}
            moduleTitle={activeModule.title}
            onClose={closeActionDialog}
          />
        ) : null}
        {cancellingAppointment ? (
          <CalendarAppointmentCancelDialog
            appointment={cancellingAppointment}
            onClose={closeCancelDialog}
            onConfirm={cancelCalendarAppointment}
          />
        ) : null}
      </main>
    </div>
  );
}
