// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { persistAdminRecord } from "@/admin/persistence";

import { POST } from "./route";

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

const settingsPayload = {
  record: {
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
  },
  type: "settings",
} as const;

vi.mock("@/admin/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/admin/persistence")>();

  return {
    ...actual,
    persistAdminRecord: vi.fn(async () => ({ mode: "supabase", ok: true })),
  };
});

describe("admin records persistence API route", () => {
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
      message: "admin_clients: permission denied",
      mode: "supabase",
      ok: false,
    });
  });
});
