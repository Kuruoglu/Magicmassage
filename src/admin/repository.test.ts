import { describe, expect, it } from "vitest";

import type {
  AdminUserRecord,
  BlogPostRecord,
  ContactChannelRecord,
  ContactSettingsRecord,
  MediaRecord,
  PriceRecord,
  ServiceRecord,
  SettingsRecord,
} from "./domain";
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

const serviceRecord: ServiceRecord = {
  category: "SPA",
  coverImage: "/media/services/aroma-massage.jpg",
  duration: "75 мин",
  locales: ["ru", "bg"],
  name: "Арома массаж",
  order: 9,
  seoTitle: "Арома массаж в Бургасе",
  slug: "aroma-massage",
  status: "Черновик",
  summary: "SPA-услуга с ароматическими маслами.",
};

const priceRecord: PriceRecord = {
  durationMinutes: 90,
  id: "price-aroma-massage-90",
  note: "Длинный вариант для постоянных клиентов.",
  order: 4,
  priceEur: 110,
  serviceSlug: "aroma-massage",
  status: "Активна",
  updatedAt: "2026-07-09",
};

const mediaRecord: MediaRecord = {
  altText: "Арома массаж в кабинете Magic Massage Natali",
  dimensions: "1600x1100",
  folder: "services",
  id: "media-aroma-cover",
  name: "Арома обложка",
  size: "410 KB",
  status: "Готово",
  type: "Фото",
  uploadedAt: "2026-07-09",
  url: "/media/services/aroma-massage.jpg",
  usage: ["Услуга: Арома массаж", "Hero сайта"],
};

const contactChannelRecord: ContactChannelRecord = {
  id: "contact-viber",
  name: "Viber",
  note: "Быстрая связь после подтверждения номера клиента.",
  status: "Активен",
  type: "Мессенджер",
  usage: ["Контакты", "Быстрая связь"],
  value: "viber://chat?number=359887771122",
};

const contactSettingsRecord: ContactSettingsRecord = {
  address: "ул. Места 49, Бургас, Болгария",
  bookingUrl: "https://studio24.bg/magic-massage-natali",
  businessName: "Magic Massage Natali",
  email: "info@magicmassage.bg",
  mapUrl: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas",
  phone: "+359 87 333 4411",
  seoArea: "Burgas, Bulgaria",
  workingHours: "Пн-Сб 10:00-19:00",
};

const blogPostRecord: BlogPostRecord = {
  author: "Natali",
  body: "Памятка помогает клиенту прийти вовремя и выбрать комфортную одежду.",
  category: "Советы",
  coverImage: "/media/blog/prepare-for-massage.jpg",
  excerpt: "Короткая памятка перед первым визитом.",
  id: "blog-prepare-for-massage",
  locales: ["ru", "bg"],
  publishedAt: "2026-07-20",
  seoTitle: "Как подготовиться к массажу в Бургасе",
  slug: "prepare-for-massage",
  status: "Черновик",
  tags: ["подготовка", "массаж"],
  title: "Как подготовиться к массажу",
  updatedAt: "2026-07-09",
};

const settingsRecord: SettingsRecord = {
  auditLogRetentionDays: 365,
  bookingBufferMinutes: 45,
  businessName: "Magic Massage Natali",
  cookiePrivacyMode: "Stripe и Google Maps загружаются только по назначению.",
  currency: "EUR",
  dailySlotCapacity: 5,
  defaultLocale: "ru",
  defaultSeoTitle: "Magic Massage Natali Burgas",
  emailSender: "info@magicmassage.bg",
  googleCalendarId: "natali@example.com",
  googleCalendarMode: "Односторонняя",
  reminderTemplate: "Напоминание о записи за день до сеанса.",
  rolesPolicy: "Бухгалтер: только Stripe-отчеты.",
  stripeMode: "Тестовый",
  timezone: "Europe/Sofia",
  updatedAt: "2026-07-09",
  workingDays: "Пн-Сб",
  workingHours: "10:00-19:00",
};

const adminUserRecord: AdminUserRecord = {
  accessNote: "Профиль Supabase Auth управляется владельцем.",
  email: "accountant@example.com",
  history: ["2026-07-08 09:15: последний успешный вход"],
  id: "00000000-0000-0000-0000-000000000002",
  lastLogin: "2026-07-08 09:15",
  name: "Supabase Accountant",
  role: "accountant",
  status: "Активен",
  twoFactor: false,
};

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
  it("loads admin profiles for the users workspace", async () => {
    const client = new FakeSupabaseClient({
      admin_profiles: [
        {
          created_at: "2026-07-01T08:00:00.000Z",
          display_name: "Supabase Accountant",
          email: "accountant@example.com",
          last_login_at: "2026-07-08T09:15:00.000Z",
          role: "accountant",
          status: "active",
          updated_at: "2026-07-08T09:20:00.000Z",
          user_id: "00000000-0000-0000-0000-000000000002",
        },
      ],
    });
    const repository = createAdminSupabaseRepository(client);

    const users = await repository.listAdminUsers();

    expect(users).toEqual([adminUserRecord]);
    expect(client.operations[0]).toMatchObject({
      order: { ascending: true, column: "display_name" },
      table: "admin_profiles",
    });
  });

  it("loads massage services from Supabase rows", async () => {
    const client = new FakeSupabaseClient({
      admin_services: [
        {
          category: "SPA",
          cover_image_url: "/media/services/supabase-massage.jpg",
          display_order: 7,
          duration_label: "75 мин",
          locale_codes: ["ru", "bg"],
          name: "Supabase Massage",
          seo_title: "Supabase Massage SEO",
          slug: "supabase-massage",
          status: "published",
          summary: "Loaded service summary.",
        },
      ],
    });
    const repository = createAdminSupabaseRepository(client);

    const services = await repository.listServices();

    expect(services).toEqual([
      {
        category: "SPA",
        coverImage: "/media/services/supabase-massage.jpg",
        duration: "75 мин",
        locales: ["ru", "bg"],
        name: "Supabase Massage",
        order: 7,
        seoTitle: "Supabase Massage SEO",
        slug: "supabase-massage",
        status: "Опубликована",
        summary: "Loaded service summary.",
      },
    ]);
    expect(client.operations[0]).toMatchObject({
      order: { ascending: true, column: "display_order" },
      table: "admin_services",
    });
  });

  it("loads EUR price variants from Supabase rows", async () => {
    const client = new FakeSupabaseClient({
      admin_price_variants: [
        {
          currency: "EUR",
          display_order: 3,
          duration_minutes: 75,
          id: "price-supabase-massage-75",
          internal_note: "Loaded price note.",
          price_cents: 12000,
          service_slug: "supabase-massage",
          status: "active",
          updated_on: "2026-07-09",
        },
      ],
    });
    const repository = createAdminSupabaseRepository(client);

    const prices = await repository.listPrices();

    expect(prices).toEqual([
      {
        durationMinutes: 75,
        id: "price-supabase-massage-75",
        note: "Loaded price note.",
        order: 3,
        priceEur: 120,
        serviceSlug: "supabase-massage",
        status: "Активна",
        updatedAt: "2026-07-09",
      },
    ]);
    expect(client.operations[0]).toMatchObject({
      order: { ascending: true, column: "display_order" },
      table: "admin_price_variants",
    });
  });

  it("loads media assets from Supabase rows", async () => {
    const client = new FakeSupabaseClient({
      admin_media_assets: [
        {
          alt_text: "Supabase studio photo",
          dimensions: "1600x1100",
          file_size_label: "420 KB",
          folder: "services",
          id: "media-supabase-studio",
          media_type: "photo",
          name: "Supabase Studio Photo",
          status: "ready",
          uploaded_on: "2026-07-09",
          url: "/media/services/supabase-studio.jpg",
          usage_contexts: ["Service: Supabase Massage"],
        },
      ],
    });
    const repository = createAdminSupabaseRepository(client);

    const media = await repository.listMedia();

    expect(media).toEqual([
      {
        altText: "Supabase studio photo",
        dimensions: "1600x1100",
        folder: "services",
        id: "media-supabase-studio",
        name: "Supabase Studio Photo",
        size: "420 KB",
        status: "Готово",
        type: "Фото",
        uploadedAt: "2026-07-09",
        url: "/media/services/supabase-studio.jpg",
        usage: ["Service: Supabase Massage"],
      },
    ]);
    expect(client.operations[0]).toMatchObject({
      order: { ascending: false, column: "uploaded_on" },
      table: "admin_media_assets",
    });
  });

  it("loads contact channels and the single contact settings row from Supabase", async () => {
    const client = new FakeSupabaseClient({
      admin_contact_channels: [
        {
          channel_type: "messenger",
          id: "contact-supabase-viber",
          internal_note: "Loaded contact note.",
          name: "Supabase Viber",
          status: "active",
          usage_contexts: ["Contacts", "Fast replies"],
          value: "viber://chat?number=359880001122",
        },
      ],
      admin_contact_settings: [
        {
          address: "Supabase Street 1, Burgas",
          booking_url: "https://studio24.bg/supabase",
          business_name: "Supabase Magic Massage",
          email: "supabase@example.com",
          id: "site",
          map_url: "https://maps.google.com/?q=supabase",
          phone: "+359 88 000 1122",
          seo_area: "Burgas",
          working_hours: "Пн-Сб 10:00-19:00",
        },
      ],
    });
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.listContactChannels()).resolves.toEqual([
      {
        id: "contact-supabase-viber",
        name: "Supabase Viber",
        note: "Loaded contact note.",
        status: "Активен",
        type: "Мессенджер",
        usage: ["Contacts", "Fast replies"],
        value: "viber://chat?number=359880001122",
      },
    ]);
    await expect(repository.loadContactSettings()).resolves.toEqual({
      address: "Supabase Street 1, Burgas",
      bookingUrl: "https://studio24.bg/supabase",
      businessName: "Supabase Magic Massage",
      email: "supabase@example.com",
      mapUrl: "https://maps.google.com/?q=supabase",
      phone: "+359 88 000 1122",
      seoArea: "Burgas",
      workingHours: "Пн-Сб 10:00-19:00",
    });
    expect(client.operations).toEqual([
      expect.objectContaining({ order: { ascending: true, column: "name" }, table: "admin_contact_channels" }),
      expect.objectContaining({
        filters: [{ column: "id", operator: "eq", value: "site" }],
        table: "admin_contact_settings",
      }),
    ]);
  });

  it("returns undefined when the contact settings row is not present", async () => {
    const client = new FakeSupabaseClient({ admin_contact_settings: [] });
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.loadContactSettings()).resolves.toBeUndefined();
  });

  it("loads blog posts from Supabase rows", async () => {
    const client = new FakeSupabaseClient({
      admin_blog_posts: [
        {
          author: "Supabase Natali",
          body: "Loaded blog body.",
          category: "Supabase",
          cover_image_url: "/media/blog/supabase.jpg",
          excerpt: "Loaded excerpt.",
          id: "blog-supabase",
          locale_codes: ["ru", "bg"],
          published_on: null,
          seo_title: "Supabase Blog SEO",
          slug: "supabase-blog",
          status: "scheduled",
          tag_labels: ["supabase", "blog"],
          title: "Supabase Blog",
          updated_on: "2026-07-09",
        },
      ],
    });
    const repository = createAdminSupabaseRepository(client);

    const posts = await repository.listBlogPosts();

    expect(posts).toEqual([
      {
        author: "Supabase Natali",
        body: "Loaded blog body.",
        category: "Supabase",
        coverImage: "/media/blog/supabase.jpg",
        excerpt: "Loaded excerpt.",
        id: "blog-supabase",
        locales: ["ru", "bg"],
        publishedAt: "",
        seoTitle: "Supabase Blog SEO",
        slug: "supabase-blog",
        status: "Запланирована",
        tags: ["supabase", "blog"],
        title: "Supabase Blog",
        updatedAt: "2026-07-09",
      },
    ]);
    expect(client.operations[0]).toMatchObject({
      order: { ascending: false, column: "published_on" },
      table: "admin_blog_posts",
    });
  });

  it("loads the single site settings row from Supabase", async () => {
    const client = new FakeSupabaseClient({
      admin_site_settings: [
        {
          audit_log_retention_days: 540,
          booking_buffer_minutes: 45,
          business_name: "Supabase Magic Massage",
          cookie_privacy_mode: "Supabase privacy text.",
          currency: "EUR",
          daily_slot_capacity: 5,
          default_locale: "bg",
          default_seo_title: "Supabase SEO",
          email_sender: "admin@magicmassage.bg",
          google_calendar_id: "natali@example.com",
          google_calendar_mode: "one_way",
          id: "site",
          reminder_template: "Supabase reminder.",
          roles_policy: "Supabase roles.",
          stripe_mode: "live_confirmed",
          timezone: "Europe/Sofia",
          updated_on: "2026-07-09",
          working_days: "Пн-Сб",
          working_hours: "10:00-19:00",
        },
      ],
    });
    const repository = createAdminSupabaseRepository(client);

    const settings = await repository.loadSettings();

    expect(settings).toEqual({
      auditLogRetentionDays: 540,
      bookingBufferMinutes: 45,
      businessName: "Supabase Magic Massage",
      cookiePrivacyMode: "Supabase privacy text.",
      currency: "EUR",
      dailySlotCapacity: 5,
      defaultLocale: "bg",
      defaultSeoTitle: "Supabase SEO",
      emailSender: "admin@magicmassage.bg",
      googleCalendarId: "natali@example.com",
      googleCalendarMode: "Односторонняя",
      reminderTemplate: "Supabase reminder.",
      rolesPolicy: "Supabase roles.",
      stripeMode: "Live после подтверждения",
      timezone: "Europe/Sofia",
      updatedAt: "2026-07-09",
      workingDays: "Пн-Сб",
      workingHours: "10:00-19:00",
    });
    expect(client.operations[0]).toMatchObject({
      filters: [{ column: "id", operator: "eq", value: "site" }],
      table: "admin_site_settings",
    });
  });

  it("returns undefined when the site settings row is not present", async () => {
    const client = new FakeSupabaseClient({ admin_site_settings: [] });
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.loadSettings()).resolves.toBeUndefined();
  });

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

  it("upserts certificates by code for admin fulfillment edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveCertificate({
      amount: "95 €",
      buyer: "Olena K.",
      clientId: "client-359873334411",
      clientName: "Olena K.",
      code: "MMN-2407-1024",
      expiresAt: "2027-01-07",
      history: ["2026-07-07: PDF sent to buyer."],
      note: "Issued from client card.",
      paymentDate: "2026-07-07",
      recipient: "Self",
      status: "Отправлен",
      stripeId: "manual",
    });

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "code" },
      table: "admin_certificates",
      values: {
        amount_cents: 9500,
        buyer_name: "Olena K.",
        client_id: "client-359873334411",
        client_name_snapshot: "Olena K.",
        code: "MMN-2407-1024",
        currency: "EUR",
        expires_on: "2027-01-07",
        history: ["2026-07-07: PDF sent to buyer."],
        internal_note: "Issued from client card.",
        paid_on: "2026-07-07",
        recipient_name: "Self",
        status: "sent",
        stripe_payment_intent_id: "manual",
      },
    });
  });

  it("upserts massage services by slug for admin content edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveService(serviceRecord);

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "slug" },
      table: "admin_services",
      values: {
        category: "SPA",
        cover_image_url: "/media/services/aroma-massage.jpg",
        display_order: 9,
        duration_label: "75 мин",
        locale_codes: ["ru", "bg"],
        name: "Арома массаж",
        seo_title: "Арома массаж в Бургасе",
        slug: "aroma-massage",
        status: "draft",
        summary: "SPA-услуга с ароматическими маслами.",
      },
    });
  });

  it("upserts price variants by id with EUR cents", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.savePrice(priceRecord);

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_price_variants",
      values: {
        currency: "EUR",
        display_order: 4,
        duration_minutes: 90,
        id: "price-aroma-massage-90",
        internal_note: "Длинный вариант для постоянных клиентов.",
        price_cents: 11000,
        service_slug: "aroma-massage",
        status: "active",
        updated_on: "2026-07-09",
      },
    });
  });

  it("upserts media assets by id for admin media edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveMedia(mediaRecord);

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_media_assets",
      values: {
        alt_text: "Арома массаж в кабинете Magic Massage Natali",
        dimensions: "1600x1100",
        file_size_label: "410 KB",
        folder: "services",
        id: "media-aroma-cover",
        media_type: "photo",
        name: "Арома обложка",
        status: "ready",
        uploaded_on: "2026-07-09",
        url: "/media/services/aroma-massage.jpg",
        usage_contexts: ["Услуга: Арома массаж", "Hero сайта"],
      },
    });
  });

  it("upserts contact channels by id for admin contact edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveContactChannel(contactChannelRecord);

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_contact_channels",
      values: {
        channel_type: "messenger",
        id: "contact-viber",
        internal_note: "Быстрая связь после подтверждения номера клиента.",
        name: "Viber",
        status: "active",
        usage_contexts: ["Контакты", "Быстрая связь"],
        value: "viber://chat?number=359887771122",
      },
    });
  });

  it("upserts contact settings as the single site contact record", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveContactSettings(contactSettingsRecord);

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_contact_settings",
      values: {
        address: "ул. Места 49, Бургас, Болгария",
        booking_url: "https://studio24.bg/magic-massage-natali",
        business_name: "Magic Massage Natali",
        email: "info@magicmassage.bg",
        id: "site",
        map_url: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas",
        phone: "+359 87 333 4411",
        seo_area: "Burgas, Bulgaria",
        working_hours: "Пн-Сб 10:00-19:00",
      },
    });
  });

  it("upserts blog posts by id for admin blog edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveBlogPost(blogPostRecord);

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_blog_posts",
      values: {
        author: "Natali",
        body: "Памятка помогает клиенту прийти вовремя и выбрать комфортную одежду.",
        category: "Советы",
        cover_image_url: "/media/blog/prepare-for-massage.jpg",
        excerpt: "Короткая памятка перед первым визитом.",
        id: "blog-prepare-for-massage",
        locale_codes: ["ru", "bg"],
        published_on: "2026-07-20",
        seo_title: "Как подготовиться к массажу в Бургасе",
        slug: "prepare-for-massage",
        status: "draft",
        tag_labels: ["подготовка", "массаж"],
        title: "Как подготовиться к массажу",
        updated_on: "2026-07-09",
      },
    });
  });

  it("stores unscheduled blog posts with a null publication date", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveBlogPost({ ...blogPostRecord, publishedAt: "", status: "Черновик" });

    expect(client.operations[0]).toMatchObject({
      table: "admin_blog_posts",
      values: {
        published_on: null,
        status: "draft",
      },
    });
  });

  it("upserts site settings as the single owner-managed settings record", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveSettings(settingsRecord);

    expect(client.operations[0]).toEqual({
      action: "upsert",
      filters: [],
      options: { onConflict: "id" },
      table: "admin_site_settings",
      values: {
        audit_log_retention_days: 365,
        booking_buffer_minutes: 45,
        business_name: "Magic Massage Natali",
        cookie_privacy_mode: "Stripe и Google Maps загружаются только по назначению.",
        currency: "EUR",
        daily_slot_capacity: 5,
        default_locale: "ru",
        default_seo_title: "Magic Massage Natali Burgas",
        email_sender: "info@magicmassage.bg",
        google_calendar_id: "natali@example.com",
        google_calendar_mode: "one_way",
        id: "site",
        reminder_template: "Напоминание о записи за день до сеанса.",
        roles_policy: "Бухгалтер: только Stripe-отчеты.",
        stripe_mode: "test",
        timezone: "Europe/Sofia",
        updated_on: "2026-07-09",
        working_days: "Пн-Сб",
        working_hours: "10:00-19:00",
      },
    });
  });

  it("throws table-scoped errors when Supabase rejects a query", async () => {
    const client = new FakeSupabaseClient({}, { admin_clients: { message: "permission denied" } });
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.listClients()).rejects.toThrow("admin_clients: permission denied");
  });
});
