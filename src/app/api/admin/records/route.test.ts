// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { persistAdminRecord } from "@/admin/persistence";
import { runWithAdminRepositoryAuditContext } from "@/admin/repository";
import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/admin/repository")>();

  return {
    ...actual,
    runWithAdminRepositoryAuditContext: vi.fn(
      (_context: unknown, operation: () => unknown) => operation(),
    ),
  };
});

const supabaseAdminRouteMock = vi.hoisted(() => ({
  authorizationResult: null as unknown,
  client: null as unknown,
}));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(async () => supabaseAdminRouteMock.authorizationResult),
    createSupabaseAdminClient: vi.fn(() => supabaseAdminRouteMock.client),
  };
});

const clientPayload = {
  record: {
    email: "irina@example.com",
    history: [],
    id: "client-1",
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
  },
  type: "client",
} as const;

const certificatePayload = {
  record: {
    amount: "95 €",
    buyer: "Irina Test",
    clientId: "client-1",
    clientName: "Irina Test",
    code: "MMN-2407-1024",
    expiresAt: "2027-01-07",
    history: ["2026-07-07: Created from admin certificates."],
    note: "Created from admin certificates.",
    paymentDate: "2026-07-07",
    recipient: "Self",
    status: "Оплачено",
    stripeId: "manual",
  },
  type: "certificate",
} as const;

const servicePayload = {
  audit: { action: "service.visibility" },
  record: {
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
  },
  type: "service",
} as const;

const pricePayload = {
  record: {
    durationMinutes: 90,
    id: "price-aroma-massage-90",
    note: "Длинный вариант для постоянных клиентов.",
    order: 4,
    priceEur: 110,
    serviceSlug: "aroma-massage",
    status: "Активна",
    updatedAt: "2026-07-09",
  },
  type: "price",
} as const;

const mediaPayload = {
  audit: { action: "media.asset" },
  record: {
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
  },
  type: "media",
} as const;

const contactChannelPayload = {
  record: {
    id: "contact-viber",
    name: "Viber",
    note: "Быстрая связь после подтверждения номера клиента.",
    status: "Активен",
    type: "Мессенджер",
    usage: ["Контакты", "Быстрая связь"],
    value: "viber://chat?number=359887771122",
  },
  type: "contactChannel",
} as const;

const contactSettingsPayload = {
  record: {
    address: "ул. Места 49, Бургас, Болгария",
    bookingUrl: "https://studio24.bg/magic-massage-natali",
    businessName: "Magic Massage Natali",
    email: "info@magicmassage.bg",
    mapUrl: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas",
    phone: "+359 87 333 4411",
    seoArea: "Burgas, Bulgaria",
    workingHours: "Пн-Сб 10:00-19:00",
  },
  type: "contactSettings",
} as const;

const blogPostPayload = {
  audit: { action: "blog.publication" },
  record: {
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
  },
  type: "blogPost",
} as const;

const overlappingAppointmentPayload = {
  audit: {
    action: "appointment.drag",
    outsideWorkingHours: false,
    overlapOverride: true,
  },
  record: {
    client: "Irina Test",
    clientId: "client-1",
    date: "2026-07-20",
    durationMinutes: 60,
    id: "appointment-overlap",
    note: "",
    overlapOverride: true,
    overlapOverrideReason: "Согласовано с обоими клиентами",
    service: "Deep tissue massage",
    status: "Подтверждена",
    time: "14:00",
  },
  type: "appointment",
} as const;

const settingsPayload = {
  audit: { action: "site.gift_certificates" },
  record: {
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
  },
  type: "settings",
} as const;

type AppointmentRouteClientOptions = {
  blockRows?: Record<string, unknown>[];
  currentRows?: Record<string, unknown>[];
  scheduleRows?: Record<string, unknown>[];
  specialistSchedule?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
};

function createAppointmentRouteClient({
  blockRows = [],
  currentRows = [],
  scheduleRows = [],
  specialistSchedule = [{
    weekly_schedule: Array.from({ length: 7 }, (_, index) => ({
      endsAt: "19:00",
      isWorking: index < 6,
      startsAt: "10:00",
      weekday: index + 1,
    })),
  }],
  settings = {
    booking_buffer_minutes: 30,
    timezone: "Europe/Sofia",
    working_days: "\u041f\u043d-\u0421\u0431",
    working_hours: "10:00-19:00",
  },
}: AppointmentRouteClientOptions = {}) {
  const insert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === "admin_appointments") {
      return {
        select: vi.fn(() => {
          let rows: Record<string, unknown>[] | undefined;
          const query = {
            eq: vi.fn((column: string, value: unknown) => {
              rows ??= column === "id" ? currentRows : scheduleRows;
              if (column === "specialist_id") {
                rows = rows.filter((row) => row.specialist_id === value);
              }

              return query;
            }),
            then: (
              resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown,
              reject: (reason: unknown) => unknown,
            ) => Promise.resolve({ data: rows ?? [], error: null }).then(resolve, reject),
          };

          return query;
        }),
      };
    }

    if (table === "admin_site_settings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [settings], error: null })),
        })),
      };
    }

    if (table === "admin_calendar_blocks") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: blockRows, error: null })),
        })),
      };
    }

    if (table === "admin_specialists") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: specialistSchedule, error: null })),
        })),
      };
    }

    return { insert };
  });

  return { client: { from }, from, insert };
}

function createPublishedServicePayload() {
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

  return {
    ...servicePayload,
    record: {
      ...servicePayload.record,
      locales: ["bg", "ru", "ua", "en"],
      status: "\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430",
      translations,
    },
  };
}

vi.mock("@/admin/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/admin/persistence")>();

  return {
    ...actual,
    persistAdminRecord: vi.fn(async () => ({ mode: "supabase", ok: true })),
  };
});

describe("admin records persistence API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseAdminRouteMock.authorizationResult = {
      mode: "supabase",
      ok: true,
      role: "administrator",
      userId: "11111111-1111-4111-8111-111111111111",
    };
    supabaseAdminRouteMock.client = null;
  });

  it("persists valid admin record payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(clientPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(clientPayload);
  });

  it("rejects invalid admin record payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify({ record: null, type: "client" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid admin record payload." });
  });

  it("persists valid certificate payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(certificatePayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(certificatePayload);
  });

  it("persists valid service payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(servicePayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(servicePayload);
  });

  it("requires a publication-ready photo cover for published content", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    supabaseAdminRouteMock.client = {
      from: vi.fn((table: string) => {
        if (table === "admin_media_assets") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{
                  alt_text: "Treatment protocol",
                  media_type: "document",
                  publication_consent_status: "not_required",
                  status: "ready",
                }],
                error: null,
              })),
            })),
          };
        }

        return { insert };
      }),
    };

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(createPublishedServicePayload()),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Published content requires a ready, consented photo from the media library with alt text.",
    });
    expect(persistAdminRecord).not.toHaveBeenCalled();
  });

  it("persists published content when its media-library cover is publication-ready", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    supabaseAdminRouteMock.client = {
      from: vi.fn((table: string) => {
        if (table === "admin_media_assets") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{
                  alt_text: "Aroma massage room",
                  media_type: "photo",
                  publication_consent_status: "granted",
                  status: "ready",
                }],
                error: null,
              })),
            })),
          };
        }

        return { insert };
      }),
    };
    const payload = createPublishedServicePayload();

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith(payload);
  });

  it("persists valid price payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(pricePayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(pricePayload);
  });

  it("persists valid media payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(mediaPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(mediaPayload);
  });

  it("persists valid contact channel payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(contactChannelPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(contactChannelPayload);
  });

  it("persists valid contact settings payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(contactSettingsPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(contactSettingsPayload);
  });

  it("persists valid blog post payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(blogPostPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(blogPostPayload);
  });

  it("persists valid settings payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(settingsPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(settingsPayload);
    const suffixes = [
      "",
      "/about",
      "/blog",
      "/booking",
      "/contacts",
      "/cookies",
      "/gift-certificates",
      "/privacy",
      "/services",
      "/terms",
    ];

    for (const locale of ["bg", "ru", "ua", "en"]) {
      for (const suffix of suffixes) {
        expect(revalidatePath).toHaveBeenCalledWith(`/${locale}${suffix}`);
      }
    }

    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/blog/[slug]", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/services/[serviceSlug]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(revalidatePath).toHaveBeenCalledTimes(43);
  });

  it("does not revalidate public pages when settings persistence fails", async () => {
    vi.mocked(persistAdminRecord).mockResolvedValueOnce({
      message: "admin_site_settings: permission denied",
      mode: "supabase",
      ok: false,
    });

    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(settingsPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns server errors for Supabase write failures", async () => {
    vi.mocked(persistAdminRecord).mockResolvedValueOnce({
      message: "admin_clients: permission denied",
      mode: "supabase",
      ok: false,
    });

    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(clientPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "Не удалось сохранить изменения. Повторите попытку.",
      mode: "supabase",
      ok: false,
    });
  });

  it("uses the documented operation-only specialist and owner-only settings matrix", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    supabaseAdminRouteMock.client = { from: vi.fn(() => ({ insert })) };

    await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(clientPayload),
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
    );
    expect(authorizeSupabaseAdminAccess).toHaveBeenLastCalledWith(expect.anything(), "token", {
      allowedRoles: ["owner", "administrator"],
    });

    await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(settingsPayload),
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
    );
    expect(authorizeSupabaseAdminAccess).toHaveBeenLastCalledWith(expect.anything(), "token", {
      allowedRoles: ["owner"],
    });
  });

  it("delegates authenticated mutations to the repository transaction without a second audit write", async () => {
    const from = vi.fn();
    supabaseAdminRouteMock.client = { from };

    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(clientPayload),
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
    expect(persistAdminRecord).toHaveBeenCalledWith(clientPayload);
  });

  it("returns failure when the atomic record-and-audit transaction fails", async () => {
    supabaseAdminRouteMock.client = { from: vi.fn() };
    vi.mocked(persistAdminRecord).mockResolvedValueOnce({
      message: "Unable to persist admin record.",
      mode: "supabase",
      ok: false,
    });

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(clientPayload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "Не удалось сохранить изменения. Повторите попытку.",
      mode: "supabase",
      ok: false,
    });
  });

  it("derives the domain audit action from the record type", async () => {
    supabaseAdminRouteMock.client = { from: vi.fn() };

    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(mediaPayload),
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(runWithAdminRepositoryAuditContext).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "media.asset",
        metadata: { role: "administrator" },
      }),
      expect.any(Function),
    );
  });

  it("requires an explicit overlap audit context", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify({
          ...overlappingAppointmentPayload,
          audit: { ...overlappingAppointmentPayload.audit, overlapOverride: false },
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(persistAdminRecord).not.toHaveBeenCalled();
  });

  it("allows only owner and administrator roles to authorize overlaps and records the actor", async () => {
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        id: "appointment-overlap",
        post_visit_comment: "",
        specialist_id: "22222222-2222-4222-8222-222222222222",
        starts_at: "14:00:00",
        starts_on: "2026-07-20",
        status: "confirmed",
      }],
      scheduleRows: [{
        buffer_minutes: 30,
        duration_minutes: 60,
        id: "appointment-existing",
        specialist_id: "22222222-2222-4222-8222-222222222222",
        starts_at: "14:30:00",
        status: "confirmed",
      }],
    });
    supabaseAdminRouteMock.client = client;
    supabaseAdminRouteMock.authorizationResult = {
      mode: "supabase",
      ok: true,
      role: "specialist",
      specialistId: "22222222-2222-4222-8222-222222222222",
      userId: "22222222-2222-4222-8222-222222222222",
    };

    const deniedResponse = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(overlappingAppointmentPayload),
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
    );
    expect(deniedResponse.status).toBe(403);
    expect(persistAdminRecord).not.toHaveBeenCalled();

    supabaseAdminRouteMock.authorizationResult = {
      mode: "supabase",
      ok: true,
      role: "administrator",
      userId: "11111111-1111-4111-8111-111111111111",
    };
    const allowedResponse = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(overlappingAppointmentPayload),
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
    );

    expect(allowedResponse.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith({
      ...overlappingAppointmentPayload,
      audit: {
        ...overlappingAppointmentPayload.audit,
        action: "appointment.update",
      },
      record: {
        ...overlappingAppointmentPayload.record,
        bufferMinutes: 30,
        overlapOverriddenBy: "11111111-1111-4111-8111-111111111111",
      },
    });
    expect(runWithAdminRepositoryAuditContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "appointment.update",
        metadata: {
          outsideWorkingHours: false,
          overlapOverride: true,
          role: "administrator",
        },
      }),
      expect.any(Function),
    );
  });

  it("allows a manual appointment to end exactly when the next appointment begins", async () => {
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.drag", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        overlapOverride: false,
        overlapOverrideReason: "",
        time: "09:30",
      },
    };
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        id: payload.record.id,
        post_visit_comment: "",
        starts_at: "09:00:00",
        starts_on: payload.record.date,
        status: "confirmed",
      }],
      scheduleRows: [{
        buffer_minutes: 30,
        duration_minutes: 60,
        id: "appointment-next",
        starts_at: "10:30:00",
        status: "confirmed",
      }],
      specialistSchedule: [{
        weekly_schedule: Array.from({ length: 7 }, (_, index) => ({
          endsAt: "20:00",
          isWorking: index < 6,
          startsAt: "08:00",
          weekday: index + 1,
        })),
      }],
      settings: {
        booking_buffer_minutes: 30,
        timezone: "Europe/Sofia",
        working_days: "Пн-Сб",
        working_hours: "08:00-20:00",
      },
    });
    supabaseAdminRouteMock.client = client;

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith({
      ...payload,
      record: { ...payload.record, bufferMinutes: 30 },
    });
  });

  it("does not treat another specialist's appointment or block as an HTTP preflight conflict", async () => {
    const specialistId = "11111111-1111-4111-8111-111111111111";
    const otherSpecialistId = "22222222-2222-4222-8222-222222222222";
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.create", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        id: "appointment-parallel-specialist",
        overlapOverride: false,
        overlapOverrideReason: "",
        specialistId,
      },
    };
    const { client } = createAppointmentRouteClient({
      blockRows: [{
        ends_at: "15:30:00",
        specialist_id: otherSpecialistId,
        starts_at: "14:30:00",
      }],
      scheduleRows: [{
        duration_minutes: 60,
        id: "appointment-other-specialist",
        specialist_id: otherSpecialistId,
        starts_at: "14:00:00",
        status: "confirmed",
      }],
    });
    supabaseAdminRouteMock.client = client;

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith(expect.objectContaining({
      record: expect.objectContaining({ specialistId }),
    }));
  });

  it("rejects specialist appointment creation even when the authorization mock ignores allowedRoles", async () => {
    const authorizedSpecialistId = "22222222-2222-4222-8222-222222222222";
    const requestedSpecialistId = "11111111-1111-4111-8111-111111111111";
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.create", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        id: "appointment-forced-specialist",
        overlapOverride: false,
        overlapOverrideReason: "",
        specialistId: requestedSpecialistId,
      },
    };
    const { client } = createAppointmentRouteClient({
      scheduleRows: [{
        duration_minutes: 60,
        id: "appointment-requested-calendar",
        specialist_id: requestedSpecialistId,
        starts_at: "14:00:00",
        status: "confirmed",
      }],
    });
    supabaseAdminRouteMock.client = client;
    supabaseAdminRouteMock.authorizationResult = {
      mode: "supabase",
      ok: true,
      role: "specialist",
      specialistId: authorizedSpecialistId,
      userId: "33333333-3333-4333-8333-333333333333",
    };

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(403);
    expect(persistAdminRecord).not.toHaveBeenCalled();
  });

  it("rejects specialist appointment updates before reading another specialist's appointment", async () => {
    const authorizedSpecialistId = "22222222-2222-4222-8222-222222222222";
    const otherSpecialistId = "11111111-1111-4111-8111-111111111111";
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.update", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        id: "appointment-foreign-specialist",
        overlapOverride: false,
        overlapOverrideReason: "",
        specialistId: otherSpecialistId,
      },
    };
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        duration_minutes: 120,
        id: payload.record.id,
        post_visit_comment: "Private post-visit note",
        specialist_id: otherSpecialistId,
        starts_at: "08:00:00",
        starts_on: payload.record.date,
        status: "cancelled",
      }],
    });
    supabaseAdminRouteMock.client = client;
    supabaseAdminRouteMock.authorizationResult = {
      mode: "supabase",
      ok: true,
      role: "specialist",
      specialistId: authorizedSpecialistId,
      userId: "33333333-3333-4333-8333-333333333333",
    };

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(403);
    expect(persistAdminRecord).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("classifies the selected specialist schedule and stores the server-side booking buffer", async () => {
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.update", outsideWorkingHours: true, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        overlapOverride: false,
        overlapOverrideReason: "",
        time: "09:00",
      },
    };
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        id: payload.record.id,
        post_visit_comment: "",
        starts_at: "09:00:00",
        starts_on: payload.record.date,
        status: "confirmed",
      }],
      settings: {
        booking_buffer_minutes: 45,
        timezone: "Europe/Sofia",
        working_days: "\u041f\u043d-\u0421\u0431",
        working_hours: "08:00-17:00",
      },
    });
    supabaseAdminRouteMock.client = client;

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith({
      ...payload,
      audit: { ...payload.audit, outsideWorkingHours: true },
      record: { ...payload.record, bufferMinutes: 45 },
    });
  });

  it("classifies Sunday as outside the saved weekly schedule", async () => {
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.update", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        date: "2026-07-19",
        overlapOverride: false,
        overlapOverrideReason: "",
        time: "12:00",
      },
    };
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        id: payload.record.id,
        post_visit_comment: "",
        starts_at: "12:00:00",
        starts_on: payload.record.date,
        status: "confirmed",
      }],
      settings: {
        booking_buffer_minutes: 30,
        timezone: "Europe/Sofia",
        working_days: "\u041f\u043d-\u0421\u0431",
        working_hours: "08:00-20:00",
      },
    });
    supabaseAdminRouteMock.client = client;

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith(expect.objectContaining({
      audit: expect.objectContaining({ outsideWorkingHours: true }),
    }));
  });

  it("allows the owner to change duration while preserving a public booking buffer", async () => {
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.update", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        bufferMinutes: 30,
        durationMinutes: 60,
        overlapOverride: false,
        overlapOverrideReason: "",
      },
    };
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        buffer_minutes: 15,
        duration_minutes: 90,
        id: payload.record.id,
        origin: "public",
        post_visit_comment: "",
        starts_at: "14:00:00",
        starts_on: payload.record.date,
        status: "confirmed",
      }],
    });
    supabaseAdminRouteMock.client = client;

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith(expect.objectContaining({
      audit: expect.objectContaining({ action: "appointment.resize" }),
      record: expect.objectContaining({
        bufferMinutes: 15,
        durationMinutes: 60,
      }),
    }));
  });

  it("preserves the current public duration when an unrelated update omits it", async () => {
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.update", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        durationMinutes: undefined,
        overlapOverride: false,
        overlapOverrideReason: "",
      },
    };
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        buffer_minutes: 15,
        duration_minutes: 90,
        id: payload.record.id,
        origin: "public",
        post_visit_comment: "",
        starts_at: payload.record.time,
        starts_on: payload.record.date,
        status: "confirmed",
      }],
    });
    supabaseAdminRouteMock.client = client;

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(persistAdminRecord).toHaveBeenCalledWith(expect.objectContaining({
      audit: expect.objectContaining({ action: "appointment.update" }),
      record: expect.objectContaining({
        bufferMinutes: 15,
        durationMinutes: 90,
      }),
    }));
  });

  it("rejects an active appointment that overlaps blocked personal time", async () => {
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.create", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        id: "appointment-blocked",
        overlapOverride: false,
        overlapOverrideReason: "",
      },
    };
    const { client } = createAppointmentRouteClient({
      blockRows: [{ ends_at: "15:30:00", starts_at: "14:30:00" }],
    });
    supabaseAdminRouteMock.client = client;

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Appointment conflicts with blocked personal time.",
    });
    expect(persistAdminRecord).not.toHaveBeenCalled();
  });

  it("maps a transactional calendar-block race to a conflict response", async () => {
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.create", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        id: "appointment-race",
        overlapOverride: false,
        overlapOverrideReason: "",
      },
    };
    const { client } = createAppointmentRouteClient();
    supabaseAdminRouteMock.client = client;
    vi.mocked(persistAdminRecord).mockResolvedValueOnce({
      message: "Unable to persist admin record.",
      mode: "supabase",
      ok: false,
      reason: "appointment_calendar_block_conflict",
    });

    const response = await POST(new Request("https://example.com/api/admin/records", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer token" },
      method: "POST",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Appointment conflicts with blocked personal time.",
    });
  });

  it("rejects a changed post-visit comment for a future non-completed DB appointment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T10:00:00Z"));
    const payload = {
      ...overlappingAppointmentPayload,
      audit: { action: "appointment.post_visit_comment", outsideWorkingHours: false, overlapOverride: false },
      record: {
        ...overlappingAppointmentPayload.record,
        overlapOverride: false,
        overlapOverrideReason: "",
        postVisitComment: "Too early",
        postVisitCommentedAt: "2026-07-14T10:00:00Z",
      },
    };
    const { client } = createAppointmentRouteClient({
      currentRows: [{
        id: payload.record.id,
        post_visit_comment: "Previous comment",
        starts_at: "14:00:00",
        starts_on: "2026-07-20",
        status: "confirmed",
      }],
    });
    supabaseAdminRouteMock.client = client;

    try {
      const response = await POST(new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(payload),
        headers: { authorization: "Bearer token" },
        method: "POST",
      }));

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "Post-visit comments cannot be changed before a future appointment is completed.",
      });
      expect(persistAdminRecord).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires an authorized admin when the Supabase secret client is configured", async () => {
    supabaseAdminRouteMock.client = { from: vi.fn() };
    supabaseAdminRouteMock.authorizationResult = {
      message: "Unauthorized",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };

    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(clientPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(persistAdminRecord).not.toHaveBeenCalled();
  });
});
