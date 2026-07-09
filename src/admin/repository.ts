import type { FinanceRow, FinanceSummary } from "./config";
import { normalizeClientPhone, parseEuroAmountToCents } from "./domain";
import type {
  AdminAppointmentDatabaseRow,
  AdminCertificateDatabaseRow,
  AdminClientDatabaseRow,
  AdminDomainRecords,
  Appointment,
  AppointmentStatus,
  CertificateRecord,
  CertificateStatus,
  ClientRecord,
} from "./domain";

type SupabaseError = {
  message: string;
};

type SupabaseQueryResult<T> = {
  data: T[] | null;
  error: SupabaseError | null;
};

type SupabaseMutationResult = {
  error: SupabaseError | null;
};

type AdminSupabaseSelectQuery<T> = PromiseLike<SupabaseQueryResult<T>> & {
  eq(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  gte(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  lte(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  order(column: string, options?: { ascending?: boolean }): AdminSupabaseSelectQuery<T>;
};

type AdminSupabaseTable<T> = {
  insert(values: unknown): PromiseLike<SupabaseMutationResult>;
  select(columns: string): AdminSupabaseSelectQuery<T>;
  upsert(values: unknown, options?: { onConflict?: string }): PromiseLike<SupabaseMutationResult>;
};

export type AdminSupabaseClient = {
  from(table: string): AdminSupabaseTable<unknown>;
};

export type AdminStripeSaleDatabaseRow = {
  buyer_name: string;
  certificate_code: string | null;
  gross_cents: number;
  paid_at: string;
  payment_intent_id: string;
  payment_status: string;
  refund_cents: number;
  stripe_fee_cents: number;
};

export type AdminFinancePeriod = {
  from: string;
  to: string;
};

export type AdminFinanceExportLogInput = {
  downloadedBy: string;
  exportFormat: "csv" | "pdf" | "xlsx";
  periodEnd: string;
  periodStart: string;
  summary: FinanceSummary;
};

export type AdminRepository = {
  listAppointments(): Promise<Appointment[]>;
  listCertificates(): Promise<CertificateRecord[]>;
  listClients(): Promise<ClientRecord[]>;
  listStripeSales(period: AdminFinancePeriod): Promise<FinanceRow[]>;
  loadDomainRecords(): Promise<AdminDomainRecords>;
  logFinanceExport(input: AdminFinanceExportLogInput): Promise<void>;
  saveAppointment(appointment: Appointment): Promise<void>;
  saveCertificate(certificate: CertificateRecord): Promise<void>;
  saveClient(client: ClientRecord): Promise<void>;
};

const clientColumns = [
  "id",
  "email",
  "full_name",
  "locale",
  "next_visit_label",
  "notes",
  "phone",
  "phone_normalized",
  "preferred_contact",
  "status",
  "tags",
  "telegram_url",
  "total_spend_label",
  "visit_count",
].join(", ");

const appointmentColumns = [
  "id",
  "client_id",
  "client_name_snapshot",
  "internal_note",
  "service_name",
  "starts_at",
  "starts_on",
  "status",
].join(", ");

const certificateColumns = [
  "code",
  "amount_cents",
  "buyer_name",
  "client_id",
  "client_name_snapshot",
  "currency",
  "expires_on",
  "history",
  "internal_note",
  "paid_on",
  "recipient_name",
  "status",
  "stripe_payment_intent_id",
].join(", ");

const stripeSaleColumns = [
  "buyer_name",
  "certificate_code",
  "gross_cents",
  "paid_at",
  "payment_intent_id",
  "payment_status",
  "refund_cents",
  "stripe_fee_cents",
].join(", ");

const appointmentStatusByDatabase: Record<string, AppointmentStatus> = {
  cancelled: "Отменена",
  confirmed: "Подтверждена",
  pending: "Ожидает",
  request: "Новая заявка",
  "Новая заявка": "Новая заявка",
  Ожидает: "Ожидает",
  Отменена: "Отменена",
  Подтверждена: "Подтверждена",
};

const databaseAppointmentStatusByStatus = new Map<AppointmentStatus, string>([
  [appointmentStatusByDatabase.cancelled, "cancelled"],
  [appointmentStatusByDatabase.confirmed, "confirmed"],
  [appointmentStatusByDatabase.pending, "pending"],
  [appointmentStatusByDatabase.request, "request"],
]);

const certificateStatusByDatabase: Record<string, CertificateStatus> = {
  paid: "Оплачено",
  pending_pdf: "Ожидает PDF",
  redeemed: "Погашен",
  sent: "Отправлен",
  Оплачено: "Оплачено",
  "Ожидает PDF": "Ожидает PDF",
  Отправлен: "Отправлен",
  Погашен: "Погашен",
};

const databaseCertificateStatusByStatus = new Map<CertificateStatus, string>([
  [certificateStatusByDatabase.paid, "paid"],
  [certificateStatusByDatabase.pending_pdf, "pending_pdf"],
  [certificateStatusByDatabase.redeemed, "redeemed"],
  [certificateStatusByDatabase.sent, "sent"],
]);

function toCents(value: number) {
  return Math.round(value * 100);
}

function fromCents(value: number) {
  return Math.round((value / 100 + Number.EPSILON) * 100) / 100;
}

function formatEuroCents(value: number, currency = "EUR") {
  const amount = fromCents(value);
  const label = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const symbol = currency === "EUR" ? "€" : currency;

  return `${label} ${symbol}`;
}

function normalizeTime(value: string) {
  return value.match(/^\d{2}:\d{2}/)?.[0] ?? value;
}

function startOfUtcDay(value: string) {
  return `${value.slice(0, 10)}T00:00:00.000Z`;
}

function endOfUtcDay(value: string) {
  return `${value.slice(0, 10)}T23:59:59.999Z`;
}

function mapAppointmentStatus(status: string): AppointmentStatus {
  return appointmentStatusByDatabase[status] ?? "Ожидает";
}

function mapAppointmentStatusToDatabase(status: AppointmentStatus) {
  return databaseAppointmentStatusByStatus.get(status) ?? "pending";
}

function mapCertificateStatus(status: string): CertificateStatus {
  return certificateStatusByDatabase[status] ?? "Оплачено";
}

function mapCertificateStatusToDatabase(status: CertificateStatus) {
  return databaseCertificateStatusByStatus.get(status) ?? "paid";
}

function mapStripeStatus(row: Pick<AdminStripeSaleDatabaseRow, "gross_cents" | "refund_cents">): FinanceRow["status"] {
  if (row.refund_cents >= row.gross_cents && row.refund_cents > 0) {
    return "Возврат";
  }

  if (row.refund_cents > 0) {
    return "Частичный возврат";
  }

  return "Оплачено";
}

function mapClientRow(row: AdminClientDatabaseRow): ClientRecord {
  return {
    email: row.email,
    history: [],
    id: row.id,
    language: row.locale,
    name: row.full_name,
    next: row.next_visit_label,
    note: row.notes,
    phone: row.phone,
    preferredContact: row.preferred_contact,
    status: row.status,
    tags: [...row.tags],
    telegram: row.telegram_url,
    totalSpend: row.total_spend_label,
    visits: row.visit_count,
  };
}

function mapClientRecordToRow(client: ClientRecord): AdminClientDatabaseRow {
  return {
    email: client.email,
    full_name: client.name,
    id: client.id,
    locale: client.language,
    next_visit_label: client.next,
    notes: client.note,
    phone: client.phone,
    phone_normalized: normalizeClientPhone(client.phone),
    preferred_contact: client.preferredContact,
    status: client.status,
    tags: [...client.tags],
    telegram_url: client.telegram,
    total_spend_label: client.totalSpend,
    visit_count: client.visits,
  };
}

function mapAppointmentRow(row: AdminAppointmentDatabaseRow): Appointment {
  return {
    client: row.client_name_snapshot,
    clientId: row.client_id ?? undefined,
    date: row.starts_on,
    id: row.id,
    note: row.internal_note,
    service: row.service_name,
    status: mapAppointmentStatus(row.status),
    time: normalizeTime(row.starts_at),
  };
}

function mapAppointmentRecordToRow(appointment: Appointment): AdminAppointmentDatabaseRow {
  if (!appointment.clientId) {
    throw new Error("admin_appointments: client_id is required");
  }

  return {
    client_id: appointment.clientId,
    client_name_snapshot: appointment.client,
    id: appointment.id ?? `${appointment.date}-${appointment.time}-${appointment.clientId}`,
    internal_note: appointment.note,
    service_name: appointment.service,
    starts_at: appointment.time,
    starts_on: appointment.date,
    status: mapAppointmentStatusToDatabase(appointment.status),
  };
}

function mapCertificateRow(row: AdminCertificateDatabaseRow): CertificateRecord {
  return {
    amount: formatEuroCents(row.amount_cents, row.currency),
    buyer: row.buyer_name,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name_snapshot,
    code: row.code,
    expiresAt: row.expires_on,
    history: [...row.history],
    note: row.internal_note,
    paymentDate: row.paid_on,
    recipient: row.recipient_name,
    status: mapCertificateStatus(row.status),
    stripeId: row.stripe_payment_intent_id,
  };
}

function mapCertificateRecordToRow(certificate: CertificateRecord): AdminCertificateDatabaseRow {
  return {
    amount_cents: parseEuroAmountToCents(certificate.amount),
    buyer_name: certificate.buyer,
    client_id: certificate.clientId ?? null,
    client_name_snapshot: certificate.clientName,
    code: certificate.code,
    currency: "EUR",
    expires_on: certificate.expiresAt,
    history: [...certificate.history],
    internal_note: certificate.note,
    paid_on: certificate.paymentDate,
    recipient_name: certificate.recipient,
    status: mapCertificateStatusToDatabase(certificate.status),
    stripe_payment_intent_id: certificate.stripeId,
  };
}

function mapStripeSaleRow(row: AdminStripeSaleDatabaseRow): FinanceRow {
  return {
    buyer: row.buyer_name,
    certificateCode: row.certificate_code ?? undefined,
    date: row.paid_at.slice(0, 10),
    gross: fromCents(row.gross_cents),
    id: row.payment_intent_id,
    refund: fromCents(row.refund_cents),
    status: mapStripeStatus(row),
    stripeFee: fromCents(row.stripe_fee_cents),
  };
}

function addAppointmentHistories(clients: ClientRecord[], appointments: Appointment[]): ClientRecord[] {
  return clients.map((client) => ({
    ...client,
    history: appointments
      .filter((appointment) => appointment.clientId === client.id)
      .map((appointment) => ({
        date: `${appointment.date} ${appointment.time}`,
        service: appointment.service,
        status: appointment.status,
      })),
  }));
}

async function selectRows<T>(
  client: AdminSupabaseClient,
  table: string,
  columns: string,
  configure: (query: AdminSupabaseSelectQuery<T>) => AdminSupabaseSelectQuery<T>,
) {
  const query = configure(client.from(table).select(columns) as AdminSupabaseSelectQuery<T>);
  const { data, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}

async function insertRow(client: AdminSupabaseClient, table: string, values: unknown) {
  const { error } = await client.from(table).insert(values);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function upsertRow(
  client: AdminSupabaseClient,
  table: string,
  values: unknown,
  options?: { onConflict?: string },
) {
  const { error } = await client.from(table).upsert(values, options);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

export function createAdminSupabaseRepository(client: AdminSupabaseClient): AdminRepository {
  async function listClients() {
    const rows = await selectRows<AdminClientDatabaseRow>(client, "admin_clients", clientColumns, (query) =>
      query.order("full_name", { ascending: true }),
    );

    return rows.map(mapClientRow);
  }

  async function listAppointments() {
    const rows = await selectRows<AdminAppointmentDatabaseRow>(client, "admin_appointments", appointmentColumns, (query) =>
      query.order("starts_on", { ascending: true }),
    );

    return rows.map(mapAppointmentRow);
  }

  async function listCertificates() {
    const rows = await selectRows<AdminCertificateDatabaseRow>(client, "admin_certificates", certificateColumns, (query) =>
      query.order("paid_on", { ascending: false }),
    );

    return rows.map(mapCertificateRow);
  }

  async function loadDomainRecords() {
    const clients = await listClients();
    const appointments = await listAppointments();
    const certificates = await listCertificates();

    return {
      appointments,
      certificates,
      clients: addAppointmentHistories(clients, appointments),
    };
  }

  async function listStripeSales(period: AdminFinancePeriod) {
    const rows = await selectRows<AdminStripeSaleDatabaseRow>(client, "admin_stripe_sales", stripeSaleColumns, (query) =>
      query
        .gte("paid_at", startOfUtcDay(period.from))
        .lte("paid_at", endOfUtcDay(period.to))
        .order("paid_at", { ascending: true }),
    );

    return rows.map(mapStripeSaleRow);
  }

  async function logFinanceExport(input: AdminFinanceExportLogInput) {
    await insertRow(client, "admin_finance_export_audit", {
      downloaded_by: input.downloadedBy,
      export_format: input.exportFormat,
      gross_cents: toCents(input.summary.gross),
      net_cents: toCents(input.summary.net),
      period_end: input.periodEnd,
      period_start: input.periodStart,
      refund_cents: toCents(input.summary.refunds),
      row_count: input.summary.payments,
      stripe_fee_cents: toCents(input.summary.stripeFees),
    });
  }

  async function saveClient(clientRecord: ClientRecord) {
    await upsertRow(client, "admin_clients", mapClientRecordToRow(clientRecord), { onConflict: "id" });
  }

  async function saveAppointment(appointment: Appointment) {
    await upsertRow(client, "admin_appointments", mapAppointmentRecordToRow(appointment), { onConflict: "id" });
  }

  async function saveCertificate(certificate: CertificateRecord) {
    await upsertRow(client, "admin_certificates", mapCertificateRecordToRow(certificate), { onConflict: "code" });
  }

  return {
    listAppointments,
    listCertificates,
    listClients,
    listStripeSales,
    loadDomainRecords,
    logFinanceExport,
    saveAppointment,
    saveCertificate,
    saveClient,
  };
}
