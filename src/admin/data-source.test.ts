import { describe, expect, it, vi } from "vitest";
import { cloneBusinessHoursSchedule } from "@/lib/business-hours";

import type { FinanceRow } from "./config";
import type {
  AdminDomainRecords,
  AdminUserRecord,
  BlogPostRecord,
  ContactChannelRecord,
  ContactSettingsRecord,
  MediaRecord,
  PriceRecord,
  ServiceRecord,
  SettingsRecord,
} from "./domain";
import type { AdminRepository, AdminSupabaseClient } from "./repository";
import { loadAdminShellData } from "./data-source";

const emptyRecords: AdminDomainRecords = {
  appointments: [],
  certificates: [],
  clients: [],
};

function createRepositoryStub(overrides: Partial<AdminRepository>): AdminRepository {
  return {
    deleteAppointment: async () => {},
    deleteClient: async () => {},
    listAppointments: async () => [],
    listAdminUsers: async () => [],
    listCalendarBlocks: async () => [],
    listCertificates: async () => [],
    listClients: async () => [],
    listBlogPosts: async () => [],
    listContactChannels: async () => [],
    listMedia: async () => [],
    listPrices: async () => [],
    listServices: async () => [],
    listSpecialists: async () => [],
    listStripeSales: async () => [],
    loadContactSettings: async () => undefined,
    loadDomainRecords: async () => emptyRecords,
    loadSettings: async () => undefined,
    logFinanceExport: async () => {},
    saveAppointment: async () => {},
    saveBlogPost: async () => {},
    saveBlogVisibility: async () => {},
    saveCertificate: async () => {},
    saveClient: async (client) => client,
    saveContactChannel: async () => {},
    saveContactSettings: async () => {},
    saveMedia: async () => {},
    savePrice: async () => {},
    saveService: async () => {},
    saveSettings: async () => {},
    ...overrides,
  };
}

describe("admin data source", () => {
  it("uses demo data when Supabase env is not configured", async () => {
    const data = await loadAdminShellData({ env: {} });

    expect(data.source).toBe("demo");
    expect(data.records.clients.length).toBeGreaterThan(0);
    expect(data.financeRows.length).toBeGreaterThan(0);
    expect(data.loadError).toBeUndefined();
  });

  it("loads records and current-month Stripe sales from Supabase when env is configured", async () => {
    const fakeClient = { from: () => ({}) } as unknown as AdminSupabaseClient;
    const financeRows: FinanceRow[] = [
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
    ];
    const blogPosts: BlogPostRecord[] = [
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
        translationKey: "blog-supabase",
        updatedAt: "2026-07-09",
      },
    ];
    const services: ServiceRecord[] = [
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
    ];
    const prices: PriceRecord[] = [
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
    ];
    const media: MediaRecord[] = [
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
    ];
    const contactChannels: ContactChannelRecord[] = [
      {
        id: "contact-supabase-viber",
        name: "Supabase Viber",
        note: "Loaded contact note.",
        status: "Активен",
        type: "Мессенджер",
        usage: ["Contacts", "Fast replies"],
        value: "viber://chat?number=359880001122",
      },
    ];
    const contactSettings: ContactSettingsRecord = {
      address: "Supabase Street 1, Burgas",
      bookingUrl: "https://studio24.bg/supabase",
      businessName: "Supabase Magic Massage",
      email: "supabase@example.com",
      mapUrl: "https://maps.google.com/?q=supabase",
      phone: "+359 88 000 1122",
      seoArea: "Burgas",
      workingHours: "Пн-Сб 10:00-19:00",
      workingSchedule: cloneBusinessHoursSchedule(),
    };
    const settings: SettingsRecord = {
      auditLogRetentionDays: 540,
      bookingBufferMinutes: 30,
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
    };
    const adminUsers: AdminUserRecord[] = [
      {
        accessNote: "Профиль Supabase Auth управляется владельцем.",
        email: "accountant@example.com",
        history: ["2026-07-08 09:15: последний успешный вход"],
        id: "00000000-0000-0000-0000-000000000002",
        lastLogin: "2026-07-08 09:15",
        name: "Supabase Accountant",
        role: "accountant",
        status: "Активен",
        twoFactor: false,
      },
    ];
    const repository = createRepositoryStub({
      listAdminUsers: async () => adminUsers,
      listBlogPosts: async () => blogPosts,
      listContactChannels: async () => contactChannels,
      listMedia: async () => media,
      listPrices: async () => prices,
      listServices: async () => services,
      listStripeSales: async (period) => {
        expect(period).toEqual({ from: "2026-07-01", to: "2026-07-31" });
        return financeRows;
      },
      loadContactSettings: async () => contactSettings,
      loadSettings: async () => settings,
      loadDomainRecords: async () => ({
        appointments: [
          {
            client: "Supabase Client",
            clientId: "client-supabase",
            date: "2026-07-09",
            id: "appointment-supabase",
            note: "Loaded from Supabase",
            service: "Deep tissue massage",
            status: "Подтверждена",
            time: "11:00",
          },
        ],
        certificates: [],
        clients: [
          {
            email: "supabase@example.com",
            history: [],
            id: "client-supabase",
            language: "en",
            name: "Supabase Client",
            next: "2026-07-09 11:00",
            note: "Loaded from Supabase",
            phone: "+359 88 000 0000",
            preferredContact: "Email",
            status: "Активный клиент",
            tags: ["EN"],
            telegram: "",
            totalSpend: "250 €",
            visits: 1,
          },
        ],
      }),
    });

    const data = await loadAdminShellData({
      createClient: () => fakeClient,
      createRepository: (client) => {
        expect(client).toBe(fakeClient);
        return repository;
      },
      env: {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
        RESEND_FROM_EMAIL: "Magic Massage Natali <hello@mail.magicmassage.bg>",
      },
      now: new Date("2026-07-09T12:00:00.000Z"),
      role: "administrator",
      specialistId: "specialist-natali",
    });

    expect(data.source).toBe("supabase");
    expect(data.currentSpecialistId).toBe("specialist-natali");
    expect(data.adminUsers?.[0]?.name).toBe("Supabase Accountant");
    expect(data.records.clients[0]?.name).toBe("Supabase Client");
    expect(data.blogPosts?.[0]?.title).toBe("Supabase Blog");
    expect(data.contactChannels?.[0]?.name).toBe("Supabase Viber");
    expect(data.contactSettings?.businessName).toBe("Supabase Magic Massage");
    expect(data.media?.[0]?.name).toBe("Supabase Studio Photo");
    expect(data.prices?.[0]?.id).toBe("price-supabase-massage-75");
    expect(data.services?.[0]?.name).toBe("Supabase Massage");
    expect(data.settings?.businessName).toBe("Supabase Magic Massage");
    expect(data.settings?.verifiedEmailSender).toBe(
      "Magic Massage Natali <hello@mail.magicmassage.bg>",
    );
    expect(data.financeRows).toBe(financeRows);
  });

  it("falls back to demo data when Supabase loading fails", async () => {
    const data = await loadAdminShellData({
      createClient: () => ({ from: () => ({}) }) as unknown as AdminSupabaseClient,
      createRepository: () =>
        createRepositoryStub({
          loadDomainRecords: async () => {
            throw new Error("admin_clients: permission denied");
          },
        }),
      env: {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      },
    });

    expect(data.source).toBe("demo");
    expect(data.loadError).toBe("admin_clients: permission denied");
    expect(data.records.clients.length).toBeGreaterThan(0);
  });

  it("does not silently return demo admin data in production", async () => {
    await expect(
      loadAdminShellData({
        env: {
          NODE_ENV: "production",
        },
      }),
    ).rejects.toThrow("Admin demo data is disabled in production.");
  });

  it("allows explicit demo fallback in production only when flagged", async () => {
    const data = await loadAdminShellData({
      env: {
        ADMIN_DEMO_FALLBACK_ENABLED: "true",
        NODE_ENV: "production",
      },
    });

    expect(data.source).toBe("demo");
    expect(data.records.clients.length).toBeGreaterThan(0);
  });

  it("limits accountant initial data to finance rows", async () => {
    const fakeClient = { from: () => ({}) } as unknown as AdminSupabaseClient;
    const financeRows: FinanceRow[] = [
      {
        buyer: "Tax Buyer",
        certificateCode: "MMN-TAX-1",
        date: "2026-07-03",
        gross: 250,
        id: "pi_tax_1",
        refund: 0,
        stripeFee: 8.6,
      },
    ];
    const listStripeSales = vi.fn(async () => financeRows);
    const repository = createRepositoryStub({
      listAdminUsers: vi.fn(async () => {
        throw new Error("accountant must not load users");
      }),
      listStripeSales,
      loadDomainRecords: vi.fn(async () => {
        throw new Error("accountant must not load clients");
      }),
      loadSettings: vi.fn(async () => {
        throw new Error("accountant must not load settings");
      }),
    });

    const data = await loadAdminShellData({
      createClient: () => fakeClient,
      createRepository: () => repository,
      env: {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
        NODE_ENV: "production",
      },
      now: new Date("2026-07-09T12:00:00.000Z"),
      role: "accountant",
    });

    expect(data).toEqual({
      financeRows,
      records: {
        appointments: [],
        calendarBlocks: [],
        certificates: [],
        clients: [],
      },
      source: "supabase",
    });
    expect(listStripeSales).toHaveBeenCalledWith({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("loads only the linked specialist calendar scope", async () => {
    const fakeClient = { from: () => ({}) } as unknown as AdminSupabaseClient;
    const specialistId = "22222222-2222-4222-8222-222222222222";
    const loadDomainRecords = vi.fn(async () => emptyRecords);
    const repository = createRepositoryStub({ loadDomainRecords });

    const data = await loadAdminShellData({
      createClient: () => fakeClient,
      createRepository: () => repository,
      env: { NODE_ENV: "production" },
      role: "specialist",
      specialistId,
    });

    expect(loadDomainRecords).toHaveBeenCalledWith(specialistId);
    expect(data).toMatchObject({
      currentSpecialistId: specialistId,
      financeRows: [],
      records: emptyRecords,
      source: "supabase",
    });
  });
});
