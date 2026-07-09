import { describe, expect, it } from "vitest";

import type { Appointment, CertificateRecord, ClientRecord, PriceRecord, ServiceRecord } from "./domain";
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

function buildRepository(
  overrides: Partial<Pick<AdminRepository, "saveAppointment" | "saveCertificate" | "saveClient" | "savePrice" | "saveService">> = {},
) {
  return {
    saveAppointment: async () => undefined,
    saveCertificate: async () => undefined,
    saveClient: async () => undefined,
    savePrice: async () => undefined,
    saveService: async () => undefined,
    ...overrides,
  } satisfies Pick<AdminRepository, "saveAppointment" | "saveCertificate" | "saveClient" | "savePrice" | "saveService">;
}

describe("admin persistence", () => {
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
      message: "admin_appointments: permission denied",
      mode: "supabase",
      ok: false,
    });
  });

  it("validates API persistence payloads by type and record shape", () => {
    expect(isAdminPersistInput({ record: clientRecord, type: "client" })).toBe(true);
    expect(isAdminPersistInput({ record: appointmentRecord, type: "appointment" })).toBe(true);
    expect(isAdminPersistInput({ record: certificateRecord, type: "certificate" })).toBe(true);
    expect(isAdminPersistInput({ record: serviceRecord, type: "service" })).toBe(true);
    expect(isAdminPersistInput({ record: priceRecord, type: "price" })).toBe(true);
    expect(isAdminPersistInput({ record: null, type: "client" })).toBe(false);
    expect(isAdminPersistInput({ record: clientRecord, type: "certificate" })).toBe(false);
    expect(isAdminPersistInput({ record: serviceRecord, type: "price" })).toBe(false);
  });
});
