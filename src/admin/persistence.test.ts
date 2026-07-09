import { describe, expect, it } from "vitest";

import type { Appointment, ClientRecord } from "./domain";
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

function buildRepository(overrides: Partial<Pick<AdminRepository, "saveAppointment" | "saveClient">> = {}) {
  return {
    saveAppointment: async () => undefined,
    saveClient: async () => undefined,
    ...overrides,
  } satisfies Pick<AdminRepository, "saveAppointment" | "saveClient">;
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
    expect(isAdminPersistInput({ record: null, type: "client" })).toBe(false);
    expect(isAdminPersistInput({ record: clientRecord, type: "certificate" })).toBe(false);
  });
});
