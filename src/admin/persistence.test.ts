import { describe, expect, it } from "vitest";

import type {
  Appointment,
  BlogPostRecord,
  CertificateRecord,
  ClientRecord,
  ContactChannelRecord,
  ContactSettingsRecord,
  MediaRecord,
  PriceRecord,
  ServiceRecord,
  SettingsRecord,
} from "./domain";
import { isAdminPersistInput, persistAdminRecord } from "./persistence";
import type { AdminRepository, AdminSupabaseClient } from "./repository";

const clientRecord: ClientRecord = {
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
};

const appointmentRecord: Appointment = {
  client: "Irina Test",
  clientId: "client-359887771122",
  date: "2026-07-08",
  id: "appointment-1",
  note: "Created from admin calendar.",
  service: "Deep tissue massage",
  status: "Подтверждена",
  time: "15:00",
};

const certificateRecord: CertificateRecord = {
  amount: "95 €",
  buyer: "Irina Test",
  clientId: "client-359887771122",
  clientName: "Irina Test",
  code: "MMN-2407-1024",
  expiresAt: "2027-01-07",
  history: ["2026-07-07: Created from admin certificates."],
  note: "Created from admin certificates.",
  paymentDate: "2026-07-07",
  recipient: "Self",
  status: "Оплачено",
  stripeId: "manual",
};

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

type PersistRepositoryMethods = Pick<
  AdminRepository,
  | "saveAppointment"
  | "saveBlogPost"
  | "saveCertificate"
  | "saveClient"
  | "saveContactChannel"
  | "saveContactSettings"
  | "saveMedia"
  | "savePrice"
  | "saveService"
  | "saveSettings"
>;

function buildRepository(
  overrides: Partial<PersistRepositoryMethods> = {},
) {
  return {
    saveAppointment: async () => undefined,
    saveBlogPost: async () => undefined,
    saveCertificate: async () => undefined,
    saveClient: async () => undefined,
    saveContactChannel: async () => undefined,
    saveContactSettings: async () => undefined,
    saveMedia: async () => undefined,
    savePrice: async () => undefined,
    saveService: async () => undefined,
    saveSettings: async () => undefined,
    ...overrides,
  } satisfies PersistRepositoryMethods;
}

describe("admin persistence", () => {
  it("rejects admin payloads with unexpected keys", () => {
    expect(
      isAdminPersistInput({
        record: {
          ...clientRecord,
          unexpected: "do not persist",
        },
        type: "client",
      }),
    ).toBe(false);
  });

  it("rejects invalid client email, contact URLs and phone formats", () => {
    expect(
      isAdminPersistInput({
        record: {
          ...clientRecord,
          email: "not-an-email",
        },
        type: "client",
      }),
    ).toBe(false);
    expect(
      isAdminPersistInput({
        record: {
          ...clientRecord,
          phone: "short",
        },
        type: "client",
      }),
    ).toBe(false);
    expect(
      isAdminPersistInput({
        record: {
          ...contactSettingsRecord,
          bookingUrl: "javascript:alert(1)",
        },
        type: "contactSettings",
      }),
    ).toBe(false);
  });

  it("accepts a new client without an optional email address", () => {
    expect(
      isAdminPersistInput({
        record: {
          ...clientRecord,
          email: "",
        },
        type: "client",
      }),
    ).toBe(true);
  });

  it("keeps writes in demo mode when Supabase is not configured", async () => {
    const result = await persistAdminRecord(
      { record: clientRecord, type: "client" },
      {
        createClient: () => null,
      },
    );

    expect(result).toEqual({
      message: "Supabase is not configured.",
      mode: "demo",
      ok: false,
    });
  });

  it("persists client records through the repository", async () => {
    const savedClients: ClientRecord[] = [];

    const result = await persistAdminRecord(
      { record: clientRecord, type: "client" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveClient: async (client) => {
              savedClients.push(client);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedClients).toEqual([clientRecord]);
  });

  it("persists appointment records through the repository", async () => {
    const savedAppointments: Appointment[] = [];

    const result = await persistAdminRecord(
      { record: appointmentRecord, type: "appointment" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveAppointment: async (appointment) => {
              savedAppointments.push(appointment);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedAppointments).toEqual([appointmentRecord]);
  });

  it("persists certificate records through the repository", async () => {
    const savedCertificates: CertificateRecord[] = [];

    const result = await persistAdminRecord(
      { record: certificateRecord, type: "certificate" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveCertificate: async (certificate) => {
              savedCertificates.push(certificate);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedCertificates).toEqual([certificateRecord]);
  });

  it("persists massage service records through the repository", async () => {
    const savedServices: typeof serviceRecord[] = [];

    const result = await persistAdminRecord(
      { record: serviceRecord, type: "service" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveService: async (service: typeof serviceRecord) => {
              savedServices.push(service);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedServices).toEqual([serviceRecord]);
  });

  it("persists price records through the repository", async () => {
    const savedPrices: typeof priceRecord[] = [];

    const result = await persistAdminRecord(
      { record: priceRecord, type: "price" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            savePrice: async (price: typeof priceRecord) => {
              savedPrices.push(price);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedPrices).toEqual([priceRecord]);
  });

  it("persists media records through the repository", async () => {
    const savedMedia: MediaRecord[] = [];

    const result = await persistAdminRecord(
      { record: mediaRecord, type: "media" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveMedia: async (media) => {
              savedMedia.push(media);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedMedia).toEqual([mediaRecord]);
  });

  it("persists contact channels through the repository", async () => {
    const savedChannels: ContactChannelRecord[] = [];

    const result = await persistAdminRecord(
      { record: contactChannelRecord, type: "contactChannel" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveContactChannel: async (channel) => {
              savedChannels.push(channel);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedChannels).toEqual([contactChannelRecord]);
  });

  it("persists contact settings through the repository", async () => {
    const savedSettings: ContactSettingsRecord[] = [];

    const result = await persistAdminRecord(
      { record: contactSettingsRecord, type: "contactSettings" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveContactSettings: async (settings) => {
              savedSettings.push(settings);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedSettings).toEqual([contactSettingsRecord]);
  });

  it("persists blog posts through the repository", async () => {
    const savedPosts: BlogPostRecord[] = [];

    const result = await persistAdminRecord(
      { record: blogPostRecord, type: "blogPost" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveBlogPost: async (post) => {
              savedPosts.push(post);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedPosts).toEqual([blogPostRecord]);
  });

  it("persists site settings through the repository", async () => {
    const savedSettings: SettingsRecord[] = [];

    const result = await persistAdminRecord(
      { record: settingsRecord, type: "settings" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveSettings: async (settings) => {
              savedSettings.push(settings);
            },
          }),
      },
    );

    expect(result).toEqual({ mode: "supabase", ok: true });
    expect(savedSettings).toEqual([settingsRecord]);
  });

  it("returns a Supabase write error without throwing through the API boundary", async () => {
    const result = await persistAdminRecord(
      { record: appointmentRecord, type: "appointment" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveAppointment: async () => {
              throw new Error("admin_appointments: permission denied");
            },
          }),
      },
    );

    expect(result).toEqual({
      message: "Unable to persist admin record.",
      mode: "supabase",
      ok: false,
    });
  });

  it("preserves known appointment conflict reasons across the persistence boundary", async () => {
    const result = await persistAdminRecord(
      { record: appointmentRecord, type: "appointment" },
      {
        createClient: () => ({}) as AdminSupabaseClient,
        createRepository: () =>
          buildRepository({
            saveAppointment: async () => {
              throw new Error(
                "admin_save_appointment_with_audit: appointment_calendar_block_conflict",
              );
            },
          }),
      },
    );

    expect(result).toEqual({
      message: "Unable to persist admin record.",
      mode: "supabase",
      ok: false,
      reason: "appointment_calendar_block_conflict",
    });
  });

  it("validates API persistence payloads by type and record shape", () => {
    expect(isAdminPersistInput({ record: clientRecord, type: "client" })).toBe(true);
    expect(isAdminPersistInput({ audit: { action: "appointment.update" }, record: appointmentRecord, type: "appointment" })).toBe(true);
    expect(isAdminPersistInput({ record: certificateRecord, type: "certificate" })).toBe(true);
    expect(isAdminPersistInput({ audit: { action: "service.visibility" }, record: serviceRecord, type: "service" })).toBe(true);
    expect(isAdminPersistInput({ record: priceRecord, type: "price" })).toBe(true);
    expect(isAdminPersistInput({ audit: { action: "media.asset" }, record: mediaRecord, type: "media" })).toBe(true);
    expect(isAdminPersistInput({ record: contactChannelRecord, type: "contactChannel" })).toBe(true);
    expect(isAdminPersistInput({ record: contactSettingsRecord, type: "contactSettings" })).toBe(true);
    expect(isAdminPersistInput({ audit: { action: "blog.publication" }, record: blogPostRecord, type: "blogPost" })).toBe(true);
    expect(isAdminPersistInput({ audit: { action: "site.gift_certificates" }, record: settingsRecord, type: "settings" })).toBe(true);
    expect(isAdminPersistInput({ record: null, type: "client" })).toBe(false);
    expect(isAdminPersistInput({ record: clientRecord, type: "certificate" })).toBe(false);
    expect(isAdminPersistInput({ record: serviceRecord, type: "price" })).toBe(false);
    expect(isAdminPersistInput({ record: mediaRecord, type: "contactSettings" })).toBe(false);
    expect(isAdminPersistInput({ record: blogPostRecord, type: "settings" })).toBe(false);
    expect(isAdminPersistInput({ record: settingsRecord, type: "blogPost" })).toBe(false);
    expect(
      isAdminPersistInput({
        audit: { action: "appointment.drag", outsideWorkingHours: true, overlapOverride: false },
        record: appointmentRecord,
        type: "appointment",
      }),
    ).toBe(true);
    expect(
      isAdminPersistInput({ audit: { action: "blog.publication" }, record: serviceRecord, type: "service" }),
    ).toBe(false);
    expect(isAdminPersistInput({ record: clientRecord, type: "client", unexpected: true })).toBe(false);
  });

  it("rejects invalid appointment enums, dates, times, durations, and buffers", () => {
    const input = { audit: { action: "appointment.update" }, record: appointmentRecord, type: "appointment" };

    expect(isAdminPersistInput({
      ...input,
      record: { ...appointmentRecord, specialistId: "11111111-1111-4111-8111-111111111111" },
    })).toBe(true);
    expect(isAdminPersistInput({ ...input, record: { ...appointmentRecord, date: "2026-02-30" } })).toBe(false);
    expect(isAdminPersistInput({ ...input, record: { ...appointmentRecord, time: "25:00" } })).toBe(false);
    expect(isAdminPersistInput({ ...input, record: { ...appointmentRecord, durationMinutes: 0 } })).toBe(false);
    expect(isAdminPersistInput({ ...input, record: { ...appointmentRecord, bufferMinutes: -1 } })).toBe(false);
    expect(isAdminPersistInput({ ...input, record: { ...appointmentRecord, postVisitCommentedAt: "not-a-date" } })).toBe(false);
    expect(isAdminPersistInput({ ...input, record: { ...appointmentRecord, status: "unknown" } })).toBe(false);
    expect(isAdminPersistInput({ ...input, record: { ...appointmentRecord, specialistId: 123 } })).toBe(false);
    expect(isAdminPersistInput({ record: { ...priceRecord, durationMinutes: 60.5 }, type: "price" })).toBe(false);
  });

  it("requires complete localized content and SEO fields before publishing a service", () => {
    const translations = Object.fromEntries(["bg", "ru", "ua", "en"].map((locale) => [locale, {
      body: `${locale} full description`,
      canonicalUrl: `/${locale}/services/aroma-massage`,
      locale,
      ogDescription: `${locale} social description`,
      ogImageMediaId: "",
      ogTitle: `${locale} social title`,
      robotsDirectives: "index,follow",
      seoDescription: `${locale} SEO description`,
      seoTitle: `${locale} SEO title`,
      shortDescription: `${locale} short description`,
      status: "published",
      title: `${locale} title`,
    }]));
    const published = {
      ...serviceRecord,
      locales: ["bg", "ru", "ua", "en"],
      status: "\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430",
      translations,
    };

    expect(isAdminPersistInput({ audit: { action: "service.visibility" }, record: published, type: "service" })).toBe(true);
    expect(isAdminPersistInput({
      audit: { action: "service.visibility" },
      record: {
        ...published,
        translations: { ...translations, ru: { ...translations.ru, seoDescription: "" } },
      },
      type: "service",
    })).toBe(false);
    expect(isAdminPersistInput({
      audit: { action: "service.visibility" },
      record: { ...published, status: "unknown" },
      type: "service",
    })).toBe(false);
  });

  it("requires semantic content, SEO, dates, and known status before publishing a blog post", () => {
    const published = {
      ...blogPostRecord,
      coverAlt: "Massage preparation guide cover",
      locales: ["ru"],
      seoDescription: "Preparation advice for a massage visit.",
      status: "\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430",
    };

    expect(isAdminPersistInput({ audit: { action: "blog.publication" }, record: published, type: "blogPost" })).toBe(true);
    expect(isAdminPersistInput({
      audit: { action: "blog.publication" },
      record: { ...published, body: "<p> </p>" },
      type: "blogPost",
    })).toBe(false);
    expect(isAdminPersistInput({
      audit: { action: "blog.publication" },
      record: { ...published, seoDescription: "" },
      type: "blogPost",
    })).toBe(false);
    expect(isAdminPersistInput({
      audit: { action: "blog.publication" },
      record: { ...published, status: "unknown" },
      type: "blogPost",
    })).toBe(false);
    expect(isAdminPersistInput({
      audit: { action: "blog.publication" },
      record: {
        ...published,
        scheduledFor: "",
        status: "\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0430",
      },
      type: "blogPost",
    })).toBe(false);
  });
});
