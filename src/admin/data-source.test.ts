import { describe, expect, it } from "vitest";

import type { FinanceRow } from "./config";
import type { AdminDomainRecords } from "./domain";
import type { AdminRepository, AdminSupabaseClient } from "./repository";
import { loadAdminShellData } from "./data-source";

const emptyRecords: AdminDomainRecords = {
  appointments: [],
  certificates: [],
  clients: [],
};

function createRepositoryStub(overrides: Partial<AdminRepository>): AdminRepository {
  return {
    listAppointments: async () => [],
    listCertificates: async () => [],
    listClients: async () => [],
    listStripeSales: async () => [],
    loadDomainRecords: async () => emptyRecords,
    logFinanceExport: async () => {},
    saveAppointment: async () => {},
    saveCertificate: async () => {},
    saveClient: async () => {},
    savePrice: async () => {},
    saveService: async () => {},
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
    const repository = createRepositoryStub({
      listStripeSales: async (period) => {
        expect(period).toEqual({ from: "2026-07-01", to: "2026-07-31" });
        return financeRows;
      },
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
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      },
      now: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(data.source).toBe("supabase");
    expect(data.records.clients[0]?.name).toBe("Supabase Client");
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
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      },
    });

    expect(data.source).toBe("demo");
    expect(data.loadError).toBe("admin_clients: permission denied");
    expect(data.records.clients.length).toBeGreaterThan(0);
  });
});
