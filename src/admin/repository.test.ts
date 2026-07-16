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
import {
  createAdminSupabaseRepository,
  sofiaLocalDateTimeToIso,
  sofiaUtcDateTimeToLocal,
  type AdminFinanceExportLogInput,
} from "./repository";

type QueryFilter = {
  column: string;
  operator: "eq" | "gt" | "gte" | "lte";
  value: unknown;
};

type QueryOperation = {
  action: "insert" | "rpc" | "select" | "upsert";
  columns?: string;
  filters?: QueryFilter[];
  functionName?: string;
  options?: unknown;
  order?: { ascending: boolean; column: string };
  orders?: { ascending: boolean; column: string }[];
  parameters?: Record<string, unknown>;
  range?: { from: number; to: number };
  table?: string;
  values?: unknown;
};

class FakeSelectQuery implements PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  private readonly filters: QueryFilter[] = [];
  private readonly orderBy: { ascending: boolean; column: string }[] = [];
  private selectedRange?: { from: number; to: number };

  constructor(
    private readonly table: string,
    private readonly columns: string,
    private readonly rows: unknown[],
    private readonly operations: QueryOperation[],
    private readonly error?: { message: string },
    private readonly selectLimit?: number,
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, operator: "gt", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ ascending: options?.ascending ?? true, column });
    return this;
  }

  range(from: number, to: number) {
    this.selectedRange = { from, to };
    return this;
  }

  then<TResult1 = { data: unknown[] | null; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[] | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const operation: QueryOperation = {
      action: "select",
      columns: this.columns,
      filters: [...this.filters],
      order: this.orderBy[0],
      table: this.table,
    };

    if (this.orderBy.length > 1) {
      operation.orders = [...this.orderBy];
    }

    if (this.selectedRange) {
      operation.range = this.selectedRange;
    }

    this.operations.push(operation);

    const filteredRows = this.rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.operator !== "gt" || typeof row !== "object" || row === null) {
          return true;
        }

        return String((row as Record<string, unknown>)[filter.column]) > String(filter.value);
      }),
    );
    const rangedRows = this.selectedRange
      ? filteredRows.slice(this.selectedRange.from, this.selectedRange.to + 1)
      : filteredRows;
    const rows = this.selectLimit ? rangedRows.slice(0, this.selectLimit) : rangedRows;

    return Promise.resolve({
      data: this.error ? null : rows,
      error: this.error ?? null,
    }).then(onfulfilled, onrejected);
  }
}

class FakeSupabaseClient {
  readonly operations: QueryOperation[] = [];

  constructor(
    private readonly rowsByTable: Record<string, unknown[]> = {},
    private readonly errorsByTable: Record<string, { message: string }> = {},
    private readonly selectLimit?: number,
  ) {}

  from(table: string) {
    return {
      insert: (values: unknown) => {
        this.operations.push({ action: "insert", filters: [], table, values });
        return Promise.resolve({ data: null, error: this.errorsByTable[table] ?? null });
      },
      select: (columns: string) =>
        new FakeSelectQuery(
          table,
          columns,
          this.rowsByTable[table] ?? [],
          this.operations,
          this.errorsByTable[table],
          this.selectLimit,
        ),
      upsert: (values: unknown, options?: unknown) => {
        this.operations.push({ action: "upsert", filters: [], options, table, values });
        return Promise.resolve({ data: null, error: this.errorsByTable[table] ?? null });
      },
    };
  }

  rpc(functionName: string, parameters: Record<string, unknown>) {
    this.operations.push({ action: "rpc", functionName, parameters });
    return Promise.resolve({ data: null, error: this.errorsByTable[functionName] ?? null });
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
  coverAlt: "Светлый массажный кабинет",
  coverImage: "/media/blog/prepare-for-massage.jpg",
  excerpt: "Короткая памятка перед первым визитом.",
  id: "blog-prepare-for-massage",
  locales: ["ru", "bg"],
  publishedAt: "2026-07-20",
  seoDescription: "SEO-памятка перед первым визитом в студию.",
  seoTitle: "Как подготовиться к массажу в Бургасе",
  slug: "prepare-for-massage",
  status: "Черновик",
  tags: ["подготовка", "массаж"],
  title: "Как подготовиться к массажу",
  updatedAt: "2026-07-09",
};

const settingsRecord: SettingsRecord = {
  auditLogRetentionDays: 365,
  bookingBufferMinutes: 30,
  bookingHoldMinutes: 5,
  bookingHorizonDays: 60,
  bookingMinLeadMinutes: 30,
  bookingSlotStepMinutes: 30,
  businessName: "Magic Massage Natali",
  cookiePrivacyMode: "Stripe и Google Maps загружаются только по назначению.",
  currency: "EUR",
  dailySlotCapacity: 5,
  defaultLocale: "ru",
  defaultSeoTitle: "Magic Massage Natali Burgas",
  emailSender: "info@magicmassage.bg",
  googleCalendarId: "natali@example.com",
  googleCalendarMode: "Односторонняя",
  publicBookingDailyLimit: 8,
  publicBookingEnabled: true,
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

const repositoryAuditContext = {
  actorUserId: "11111111-1111-4111-8111-111111111111",
  metadata: { role: "administrator" },
};

function expectAtomicRecordRpc(
  client: FakeSupabaseClient,
  recordType: string,
  record: Record<string, unknown>,
) {
  const actionByRecordType: Record<string, string> = {
    appointment: "appointment.update",
    certificate: "record.certificate.upsert",
    client: "record.client.upsert",
    contactChannel: "record.contactChannel.upsert",
    contactSettings: "record.contactSettings.upsert",
    media: "media.asset",
    price: "record.price.upsert",
    settings: "site.gift_certificates",
  };

  expect(client.operations[0]).toEqual({
    action: "rpc",
    functionName: "admin_save_record_with_audit",
    parameters: {
      p_action: actionByRecordType[recordType],
      p_actor_user_id: repositoryAuditContext.actorUserId,
      p_audit_metadata: repositoryAuditContext.metadata,
      p_record: record,
      p_record_type: recordType,
    },
  });
}

describe("admin Supabase repository", () => {
  it("loads admin profiles for the users workspace", async () => {
    const client = new FakeSupabaseClient({
      admin_profiles: [
        {
          created_at: "2026-07-01T08:00:00.000Z",
          display_name: "Supabase Accountant",
          email: "accountant@example.com",
          last_login_at: "2026-07-08T09:15:00.000Z",
          mfa_verified_at: null,
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
        translations: {},
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
        placements: [],
        publicationConsent: "unknown",
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
          meta_description: "Loaded SEO description.",
          published_on: null,
          scheduled_for: "2026-07-20T07:30:00.000Z",
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
        canonicalUrl: undefined,
        category: "Supabase",
        coverAlt: "Supabase Blog",
        coverImage: "/media/blog/supabase.jpg",
        editorJson: {},
        excerpt: "Loaded excerpt.",
        hreflang: {},
        id: "blog-supabase",
        locales: ["ru", "bg"],
        ogDescription: undefined,
        ogTitle: undefined,
        publishedAt: "",
        robotsDirectives: undefined,
        scheduledFor: "2026-07-20T10:30",
        seoDescription: "Loaded SEO description.",
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

  it.each([
    ["summer DST", "2026-07-20T07:30:00.000Z", "2026-07-20T10:30"],
    ["winter standard time", "2026-01-20T08:30:00.000Z", "2026-01-20T10:30"],
  ])("round trips Sofia publication time during %s", (_label, utcValue, localValue) => {
    expect(sofiaUtcDateTimeToLocal(utcValue)).toBe(localValue);
    expect(sofiaLocalDateTimeToIso(localValue)).toBe(utcValue);
  });

  it("loads the single site settings row from Supabase", async () => {
    const client = new FakeSupabaseClient({
      admin_site_settings: [
        {
          audit_log_retention_days: 540,
          booking_buffer_minutes: 30,
          booking_hold_minutes: 5,
          booking_horizon_days: 60,
          booking_min_lead_minutes: 30,
          booking_slot_step_minutes: 30,
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
          public_booking_daily_limit: 8,
          public_booking_enabled: true,
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
      bookingBufferMinutes: 30,
      bookingHoldMinutes: 5,
      bookingHorizonDays: 60,
      bookingMinLeadMinutes: 30,
      bookingSlotStepMinutes: 30,
      businessName: "Supabase Magic Massage",
      cookiePrivacyMode: "Supabase privacy text.",
      currency: "EUR",
      dailySlotCapacity: 5,
      defaultLocale: "bg",
      defaultSeoTitle: "Supabase SEO",
      emailSender: "admin@magicmassage.bg",
      googleCalendarId: "natali@example.com",
      googleCalendarMode: "Односторонняя",
      publicBookingDailyLimit: 8,
      publicBookingEnabled: true,
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
      expect.objectContaining({
        filters: [],
        order: { ascending: true, column: "id" },
        range: { from: 0, to: 999 },
        table: "admin_clients",
      }),
      expect.objectContaining({
        filters: [{ column: "id", operator: "gt", value: "client-359873334411" }],
        order: { ascending: true, column: "id" },
        range: { from: 0, to: 999 },
        table: "admin_clients",
      }),
      expect.objectContaining({ order: { ascending: true, column: "starts_on" }, table: "admin_appointments" }),
      expect.objectContaining({ order: { ascending: true, column: "block_date" }, table: "admin_calendar_blocks" }),
      expect.objectContaining({ order: { ascending: true, column: "display_order" }, table: "admin_specialists" }),
      expect.objectContaining({ order: { ascending: false, column: "paid_on" }, table: "admin_certificates" }),
    ]);
  });

  it("sends no client contacts, ids, or notes to a specialist calendar", async () => {
    const client = new FakeSupabaseClient({
      admin_appointments: [{
        ...appointmentRows[0],
        public_contact_preference_snapshot: "phone",
        public_email_snapshot: "olena.k@example.com",
        public_note: "Call +359873334411",
        public_phone_snapshot: "+359873334411",
        public_reference: "MMN-PRIVATE-REFERENCE",
        post_visit_comment: "Private follow-up +359873334411",
        post_visit_commented_at: "2026-07-09T10:00:00.000Z",
        overlap_override_reason: "Private override reason",
        overlap_overridden_at: "2026-07-09T10:00:00.000Z",
        overlap_overridden_by: "11111111-1111-4111-8111-111111111111",
        specialist_id: "22222222-2222-4222-8222-222222222222",
      }],
      admin_clients: clientRows,
    });
    const repository = createAdminSupabaseRepository(client);

    const records = await repository.loadDomainRecords("22222222-2222-4222-8222-222222222222");

    expect(records.clients).toEqual([]);
    expect(records.certificates).toEqual([]);
    expect(records.appointments[0]).toEqual({
      bufferMinutes: 15,
      client: "Olena K.",
      date: "2026-07-08",
      durationMinutes: undefined,
      id: "demo-3",
      note: "",
      service: "Deep tissue massage",
      serviceSlug: undefined,
      specialistId: "22222222-2222-4222-8222-222222222222",
      specialistName: undefined,
      status: "Подтверждена",
      time: "15:00",
      version: 1,
    });
    expect(client.operations.some((operation) => operation.table === "admin_clients")).toBe(false);
    const appointmentSelect = client.operations.find((operation) => operation.table === "admin_appointments");
    expect(appointmentSelect?.columns).toBe([
      "id",
      "buffer_minutes",
      "client_name_snapshot",
      "duration_minutes",
      "service_slug",
      "service_name",
      "specialist_id",
      "starts_at",
      "starts_on",
      "status",
      "version",
    ].join(", "));
    expect(appointmentSelect?.columns).not.toMatch(/client_id|note|contact|email|phone|reference|overlap/);
  });

  it("loads every client when Supabase returns more than one page", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      ...clientRows[0],
      full_name: `Client ${String(index).padStart(4, "0")}`,
      id: `client-${String(index).padStart(4, "0")}`,
      phone: `+359 87 3${String(index).padStart(6, "0")}`,
      phone_normalized: `359873${String(index).padStart(6, "0")}`,
    }));
    const client = new FakeSupabaseClient({ admin_clients: rows }, {}, 500);
    const repository = createAdminSupabaseRepository(client);

    const clients = await repository.listClients();

    expect(clients).toHaveLength(1001);
    expect(new Set(clients.map((clientRecord) => clientRecord.id)).size).toBe(1001);
    expect(clients.at(0)?.id).toBe("client-0000");
    expect(clients.at(-1)?.id).toBe("client-1000");
    expect(client.operations).toEqual([
      expect.objectContaining({
        filters: [],
        order: { ascending: true, column: "id" },
        range: { from: 0, to: 999 },
        table: "admin_clients",
      }),
      expect.objectContaining({
        filters: [{ column: "id", operator: "gt", value: "client-0499" }],
        range: { from: 0, to: 999 },
        table: "admin_clients",
      }),
      expect.objectContaining({
        filters: [{ column: "id", operator: "gt", value: "client-0999" }],
        range: { from: 0, to: 999 },
        table: "admin_clients",
      }),
      expect.objectContaining({
        filters: [{ column: "id", operator: "gt", value: "client-1000" }],
        range: { from: 0, to: 999 },
        table: "admin_clients",
      }),
    ]);
  });

  it("advances keyset pagination when a row has an empty id", async () => {
    const rows = [
      { ...clientRows[0], id: "" },
      { ...clientRows[0], id: "client-after-empty", phone_normalized: "359873334412" },
    ];
    const client = new FakeSupabaseClient({ admin_clients: rows }, {}, 1);
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.listClients()).resolves.toHaveLength(2);
    expect(client.operations[1]).toMatchObject({
      filters: [{ column: "id", operator: "gt", value: "" }],
      table: "admin_clients",
    });
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
    }, repositoryAuditContext);

    expectAtomicRecordRpc(client, "client", {
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
    }, repositoryAuditContext);

    expect(client.operations[0]).toEqual({
      action: "rpc",
      functionName: "admin_save_appointment_with_audit",
      parameters: {
        p_action: "appointment.update",
        p_actor_user_id: repositoryAuditContext.actorUserId,
        p_audit_metadata: repositoryAuditContext.metadata,
        p_record: {
        buffer_minutes: 15,
        client_id: "client-359873334411",
        client_name_snapshot: "Olena K.",
        duration_minutes: 60,
        id: "appointment-1",
        internal_note: "Check neck and shoulders before session.",
        overlap_overridden_at: null,
        overlap_overridden_by: null,
        overlap_override: false,
        overlap_override_reason: "",
        post_visit_comment: "",
        post_visit_commented_at: null,
        service_name: "Deep tissue massage",
        starts_at: "15:00",
        starts_on: "2026-07-08",
        status: "confirmed",
        },
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
    }, repositoryAuditContext);

    expectAtomicRecordRpc(client, "certificate", {
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
    });
  });

  it("saves the service aggregate through one transactional RPC", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveService(serviceRecord, repositoryAuditContext);

    expect(client.operations[0]).toEqual({
      action: "select",
      columns: "id",
      filters: [{ column: "url", operator: "eq", value: "/media/services/aroma-massage.jpg" }],
      order: undefined,
      table: "admin_media_assets",
    });
    expect(client.operations[1]).toEqual({
      action: "rpc",
      functionName: "admin_save_service_aggregate",
      parameters: {
        p_actor_user_id: repositoryAuditContext.actorUserId,
        p_audit_metadata: repositoryAuditContext.metadata,
        p_placements: [],
        p_service: {
          category: "SPA",
          cover_image_url: "/media/services/aroma-massage.jpg",
          cover_media_id: null,
          display_order: 9,
          duration_label: "75 мин",
          locale_codes: ["ru", "bg"],
          name: "Арома массаж",
          seo_title: "Арома массаж в Бургасе",
          slug: "aroma-massage",
          status: "draft",
          summary: "SPA-услуга с ароматическими маслами.",
        },
        p_translations: [],
      },
    });
    expect(client.operations.filter((operation) => operation.action !== "select")).toHaveLength(1);
  });

  it("passes verified actor metadata into the atomic service RPC", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveService(serviceRecord, repositoryAuditContext);

    expect(client.operations[1]).toMatchObject({
      action: "rpc",
      parameters: {
        p_actor_user_id: "11111111-1111-4111-8111-111111111111",
        p_audit_metadata: { role: "administrator" },
        p_service: {
        category: "SPA",
        cover_image_url: "/media/services/aroma-massage.jpg",
        cover_media_id: null,
        display_order: 9,
        duration_label: "75 мин",
        locale_codes: ["ru", "bg"],
        name: "Арома массаж",
        seo_title: "Арома массаж в Бургасе",
        slug: "aroma-massage",
        status: "draft",
        summary: "SPA-услуга с ароматическими маслами.",
      },
      },
    });
  });

  it("refuses aggregate writes without verified actor context", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.saveService(serviceRecord)).rejects.toThrow("verified actor is required");
    expect(client.operations.some((operation) => operation.action === "rpc")).toBe(false);
  });

  it("rejects a published service before the RPC when its cover is not in the media library", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.saveService({ ...serviceRecord, status: "Опубликована" })).rejects.toThrow(
      "published cover must reference a media-library asset",
    );
    expect(client.operations.some((operation) => operation.action === "rpc")).toBe(false);
  });

  it("upserts price variants by id with EUR cents", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.savePrice(priceRecord, repositoryAuditContext);

    expectAtomicRecordRpc(client, "price", {
        currency: "EUR",
        display_order: 4,
        duration_minutes: 90,
        id: "price-aroma-massage-90",
        internal_note: "Длинный вариант для постоянных клиентов.",
        price_cents: 11000,
        service_slug: "aroma-massage",
        status: "active",
        updated_on: "2026-07-09",
    });
  });

  it("upserts media assets by id for admin media edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveMedia(mediaRecord, repositoryAuditContext);

    expectAtomicRecordRpc(client, "media", {
        alt_text: "Арома массаж в кабинете Magic Massage Natali",
        dimensions: "1600x1100",
        file_size_label: "410 KB",
        folder: "services",
        id: "media-aroma-cover",
        media_type: "photo",
        name: "Арома обложка",
        publication_consent_status: "unknown",
        status: "ready",
        uploaded_on: "2026-07-09",
        url: "/media/services/aroma-massage.jpg",
        usage_contexts: ["Услуга: Арома массаж", "Hero сайта"],
    });
  });

  it("upserts contact channels by id for admin contact edits", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveContactChannel(contactChannelRecord, repositoryAuditContext);

    expectAtomicRecordRpc(client, "contactChannel", {
        channel_type: "messenger",
        id: "contact-viber",
        internal_note: "Быстрая связь после подтверждения номера клиента.",
        name: "Viber",
        status: "active",
        usage_contexts: ["Контакты", "Быстрая связь"],
        value: "viber://chat?number=359887771122",
    });
  });

  it("upserts contact settings as the single site contact record", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveContactSettings(contactSettingsRecord, repositoryAuditContext);

    expectAtomicRecordRpc(client, "contactSettings", {
        address: "ул. Места 49, Бургас, Болгария",
        booking_url: "https://studio24.bg/magic-massage-natali",
        business_name: "Magic Massage Natali",
        email: "info@magicmassage.bg",
        id: "site",
        map_url: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas",
        phone: "+359 87 333 4411",
        seo_area: "Burgas, Bulgaria",
        working_hours: "Пн-Сб 10:00-19:00",
    });
  });

  it("saves the blog aggregate through one transactional RPC", async () => {
    const client = new FakeSupabaseClient({ admin_media_assets: [{ id: "media-blog-cover" }] });
    const repository = createAdminSupabaseRepository(client);

    await repository.saveBlogPost(blogPostRecord, repositoryAuditContext);

    expect(client.operations[0]).toMatchObject({
      action: "select",
      table: "admin_media_assets",
    });
    expect(client.operations[1]).toMatchObject({
      action: "rpc",
      functionName: "admin_save_blog_post_aggregate",
      parameters: {
        p_actor_user_id: repositoryAuditContext.actorUserId,
        p_audit_metadata: repositoryAuditContext.metadata,
        p_placement: {
          is_published: false,
          locale: "ru",
          media_asset_id: "media-blog-cover",
          page_key: "blog:blog-prepare-for-massage",
          placement_key: "blog:blog-prepare-for-massage:cover",
          publish_at: null,
          slot_key: "cover",
        },
        p_post: {
          author: "Natali",
          body: "Памятка помогает клиенту прийти вовремя и выбрать комфортную одежду.",
          cover_media_id: "media-blog-cover",
          id: "blog-prepare-for-massage",
          scheduled_for: null,
          status: "draft",
        },
      },
    });
    expect(client.operations.filter((operation) => operation.action !== "select")).toHaveLength(1);
  });

  it("stores unscheduled blog posts with a null publication date", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveBlogPost(
      { ...blogPostRecord, publishedAt: "", status: "Черновик" },
      repositoryAuditContext,
    );

    expect(client.operations[1]).toMatchObject({
      action: "rpc",
      parameters: {
        p_placement: null,
        p_post: {
          published_on: null,
          status: "draft",
        },
      },
    });
  });

  it("rejects scheduled blog publication before the RPC when its cover is not in the media library", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.saveBlogPost({
      ...blogPostRecord,
      scheduledFor: "2026-07-20T10:30",
      status: "Запланирована",
    })).rejects.toThrow("publication cover must reference a media-library asset");
    expect(client.operations.some((operation) => operation.action === "rpc")).toBe(false);
  });

  it("stores the exact scheduled Sofia time and delays the cover placement", async () => {
    const client = new FakeSupabaseClient({ admin_media_assets: [{ id: "media-blog-cover" }] });
    const repository = createAdminSupabaseRepository(client);

    await repository.saveBlogPost(
      {
        ...blogPostRecord,
        scheduledFor: "2026-07-20T10:30",
        status: "Запланирована",
      },
      repositoryAuditContext,
    );

    expect(client.operations[1]).toMatchObject({
      action: "rpc",
      parameters: {
        p_placement: {
          is_published: true,
          publish_at: "2026-07-20T07:30:00.000Z",
        },
        p_post: {
          scheduled_for: "2026-07-20T07:30:00.000Z",
          status: "scheduled",
        },
      },
    });
  });

  it("upserts site settings as the single owner-managed settings record", async () => {
    const client = new FakeSupabaseClient();
    const repository = createAdminSupabaseRepository(client);

    await repository.saveSettings(settingsRecord, repositoryAuditContext);

    expect(client.operations[0]).toEqual({
      action: "rpc",
      functionName: "admin_save_booking_settings_with_audit",
      parameters: {
        p_actor_user_id: repositoryAuditContext.actorUserId,
        p_settings: {
        audit_log_retention_days: 365,
        booking_buffer_minutes: 30,
        booking_hold_minutes: 5,
        booking_horizon_days: 60,
        booking_min_lead_minutes: 30,
        booking_slot_step_minutes: 30,
        business_name: "Magic Massage Natali",
        cookie_privacy_mode: "Stripe и Google Maps загружаются только по назначению.",
        currency: "EUR",
        daily_slot_capacity: 5,
        default_locale: "ru",
        default_seo_title: "Magic Massage Natali Burgas",
        email_sender: "info@magicmassage.bg",
        gift_certificates_enabled: true,
        google_calendar_id: "natali@example.com",
        google_calendar_mode: "one_way",
        id: "site",
        public_booking_daily_limit: 8,
        public_booking_enabled: true,
        reminder_template: "Напоминание о записи за день до сеанса.",
        roles_policy: "Бухгалтер: только Stripe-отчеты.",
        stripe_mode: "test",
        timezone: "Europe/Sofia",
        updated_on: "2026-07-09",
        working_days: "Пн-Сб",
        working_hours: "10:00-19:00",
        },
      },
    });
  });

  it("throws table-scoped errors when Supabase rejects a query", async () => {
    const client = new FakeSupabaseClient({}, { admin_clients: { message: "permission denied" } });
    const repository = createAdminSupabaseRepository(client);

    await expect(repository.listClients()).rejects.toThrow("admin_clients: permission denied");
  });
});
