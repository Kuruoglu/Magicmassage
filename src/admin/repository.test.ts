import { describe, expect, it } from "vitest";

import { createAdminSupabaseRepository, type AdminFinanceExportLogInput } from "./repository";

type QueryFilter = {
  column: string;
  operator: "eq" | "gte" | "lte";
  value: unknown;
};

type QueryOperation = {
  action: "insert" | "select" | "upsert";
  columns?: string;
  filters: QueryFilter[];
  options?: unknown;
  order?: { ascending: boolean; column: string };
  table: string;
  values?: unknown;
};

class FakeSelectQuery implements PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  private readonly filters: QueryFilter[] = [];
  private orderBy?: { ascending: boolean; column: string };

  constructor(
    private readonly table: string,
    private readonly columns: string,
    private readonly rows: unknown[],
    private readonly operations: QueryOperation[],
    private readonly error?: { message: string },
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { ascending: options?.ascending ?? true, column };
    return this;
  }

  then<TResult1 = { data: unknown[] | null; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[] | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    this.operations.push({
      action: "select",
      columns: this.columns,
      filters: [...this.filters],
      order: this.orderBy,
      table: this.table,
    });

    return Promise.resolve({
      data: this.error ? null : this.rows,
      error: this.error ?? null,
    }).then(onfulfilled, onrejected);
  }
}

class FakeSupabaseClient {
  readonly operations: QueryOperation[] = [];

  constructor(
    private readonly rowsByTable: Record<string, unknown[]> = {},
    private readonly errorsByTable: Record<string, { message: string }> = {},
  ) {}

  from(table: string) {
    return {
      insert: (values: unknown) => {
        this.operations.push({ action: "insert", filters: [], table, values });
        return Promise.resolve({ data: null, error: this.errorsByTable[table] ?? null });
      },
      select: (columns: string) =>
        new FakeSelectQuery(table, columns, this.rowsByTable[table] ?? [], this.operations, this.errorsByTable[table]),
      upsert: (values: unknown, options?: unknown) => {
        this.operations.push({ action: "upsert", filters: [], options, table, values });
        return Promise.resolve({ data: null, error: this.errorsByTable[table] ?? null });
      },
    };
  }
}

const clientRows = [
  {
    email: "olena.k@example.com",
    full_name: "Olena K.",
    id: "client-359873334411",
    locale: "ua",
    next_visit_label: "15 Jul 11:30",
    notes: "Prefers evening slots.",
    phone: "+359 87 333 4411",
    phone_normalized: "359873334411",
    preferred_contact: "Telegram",
    status: "Active client",
    tags: ["UA", "deep tissue"],
    telegram_url: "https://t.me/olena_k_demo",
    total_spend_label: "520 EUR",
    visit_count: 5,
  },
];

const appointmentRows = [
  {
    client_id: "client-359873334411",
    client_name_snapshot: "Olena K.",
    id: "demo-3",
    internal_note: "Check neck and shoulders before session.",
    service_name: "Deep tissue massage",
    starts_at: "15:00:00",
    starts_on: "2026-07-08",
    status: "confirmed",
  },
];

const certificateRows = [
  {
    amount_cents: 25000,
    buyer_name: "Oksana",
    client_id: "client-359873334411",
    client_name_snapshot: "Olena K.",
    code: "MMN-2407-1023",
    currency: "EUR",
    expires_on: "2027-01-03",
    history: ["2026-07-03: Stripe payment linked."],
    internal_note: "Check PDF before resend.",
    paid_on: "2026-07-03",
    recipient_name: "Self",
    status: "pending_pdf",
    stripe_payment_intent_id: "pi_3QMMN1023",
  },
];

const stripeRows = [
  {
    buyer_name: "Oksana",
    certificate_code: "MMN-2407-1023",
    gross_cents: 25000,
    paid_at: "2026-07-03T10:15:00.000Z",
    payment_intent_id: "pi_3QMMN1023",
    payment_status: "succeeded",
    refund_cents: 0,
    stripe_fee_cents: 860,
  },
];

describe("admin Supabase repository", () => {
  it("loads admin domain records from Supabase rows", async () => {
    const client = new FakeSupabaseClient({
      admin_appointments: appointmentRows,
      admin_certificates: certificateRows,
      admin_clients: clientRows,
    });
    const repository = createAdminSupabaseRepository(client);

    const records = await repository.loadDomainRecords();

    expect(records.clients[0]).toMatchObject({
      email: "olena.k@example.com",
      history: [{ date: "2026-07-08 15:00", service: "Deep tissue massage", status: "Подтверждена" }],
      id: "client-359873334411",
      name: "Olena K.",
      phone: "+359 87 333 4411",
      totalSpend: "520 EUR",
      visits: 5,
    });
    expect(records.appointments[0]).toMatchObject({
      client: "Olena K.",
      clientId: "client-359873334411",
      date: "2026-07-08",
      id: "demo-3",
      service: "Deep tissue massage",
      time: "15:00",
    });
    expect(records.certificates[0]).toMatchObject({
      amount: "250 €",
      clientId: "client-359873334411",
      code: "MMN-2407-1023",
      paymentDate: "2026-07-03",
      stripeId: "pi_3QMMN1023",
    });
    expect(client.operations.filter((operation) => operation.action === "select")).toEqual([
      expect.objectContaining({ order: { ascending: true, column: "full_name" }, table: "admin_clients" }),
      expect.objectContaining({ order: { ascending: true, column: "starts_on" }, table: "admin_appointments" }),
      expect.objectContaining({ order: { ascending: false, column: "paid_on" }, table: "admin_certificates" }),
    ]);
  });

  it("loads Stripe sales for an accountant period export", async () => {
    const client = new FakeSupabaseClient({ admin_stripe_sales: stripeRows });
    const repository = createAdminSupabaseRepository(client);

    const rows = await repository.listStripeSales({ from: "2026-07-01", to: "2026-07-31" });

    expect(rows).toEqual([
      {
        buyer: "Oksana",
        certificateCode: "MMN-2407-1023",
        date: "2026-07-03",
        gross: 250,
        id: "pi_3QMMN1023",
        refund: 0,
        status: "Оплачено",
        stripeFee: 8.6,
      },
    ]);
    expect(client.operations[0]).toMatchObject({
      filters: [
        { column: "paid_at", operator: "gte", value: "2026-07-01T00:00:00.000Z" },
        { column: "paid_at", operator: "lte", value: "2026-07-31T23:59:59.999Z" },
      ],
      order: { ascending: true, column: "paid_at" },
      table: "admin_stripe_sales",
    });
  });

  it("logs finance exports with integer cents for audit history", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);
    const input: AdminFinanceExportLogInput = {
      downloadedBy: "00000000-0000-0000-0000-000000000001",
      exportFormat: "csv",
      periodEnd: "2026-07-31",
      periodStart: "2026-07-01",
      summary: {
        gross: 550,
        net: 491.1,
        payments: 3,
        refunds: 40,
        stripeFees: 18.9,
      },
    };

    await repository.logFinanceExport(input);

    expect(client.operations[0]).toEqual({
      action: "insert",
      filters: [],
      table: "admin_finance_export_audit",
      values: {
        downloaded_by: "00000000-0000-0000-0000-000000000001",
        export_format: "csv",
        gross_cents: 55000,
        net_cents: 49110,
        period_end: "2026-07-31",
        period_start: "2026-07-01",
        refund_cents: 4000,
        row_count: 3,
        stripe_fee_cents: 1890,
      },
    });
  });

  it("upserts clients by id for admin edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveClient({
      email: "irina@example.com",
      history: [],
      id: "client-359887771122",
      language: "bg",
      name: "Irina Test",
      next: "Not scheduled",
      note: "Prefers daytime slots.",
      phone: "+359 88 777 1122",
      preferredContact: "Telegram",
      status: "New client",
      tags: ["BG", "new"],
      telegram: "https://t.me/irina_demo",
      totalSpend: "0 EUR",
      visits: 0,
    });

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_clients",
      values: {
        email: "irina@example.com",
        full_name: "Irina Test",
        id: "client-359887771122",
        locale: "bg",
        next_visit_label: "Not scheduled",
        notes: "Prefers daytime slots.",
        phone: "+359 88 777 1122",
        phone_normalized: "359887771122",
        preferred_contact: "Telegram",
        status: "New client",
        tags: ["BG", "new"],
        telegram_url: "https://t.me/irina_demo",
        total_spend_label: "0 EUR",
        visit_count: 0,
      },
    });
  });

  it("upserts appointments with a stable client id", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveAppointment({
      client: "Olena K.",
      clientId: "client-359873334411",
      date: "2026-07-08",
      id: "appointment-1",
      note: "Check neck and shoulders before session.",
      service: "Deep tissue massage",
      status: "Подтверждена",
      time: "15:00",
    });

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_appointments",
      values: {
        client_id: "client-359873334411",
        client_name_snapshot: "Olena K.",
        id: "appointment-1",
        internal_note: "Check neck and shoulders before session.",
        service_name: "Deep tissue massage",
        starts_at: "15:00",
        starts_on: "2026-07-08",
        status: "confirmed",
      },
    });
  });

  it("does not persist appointments without an exact client id", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await expect(
      repository.saveAppointment({
        client: "Olena K.",
        date: "2026-07-08",
        id: "appointment-1",
        note: "",
        service: "Deep tissue massage",
        status: "Ожидает",
        time: "15:00",
      }),
    ).rejects.toThrow("admin_appointments: client_id is required");

    expect(client.operations).toEqual([]);
  });

  it("throws table-scoped errors when Supabase rejects a query", async () => {
    const client = new FakeSupabaseClient({}, { admin_clients: { message: "permission denied" } });
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.listClients()).rejects.toThrow("admin_clients: permission denied");
  });
});
