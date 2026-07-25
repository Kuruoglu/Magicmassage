import { describe, expect, it } from "vitest";

import { certificateRows, clientRows, financeRows, upcomingAppointments } from "./demo-data";
import {
  buildAdminDatabaseSeed,
  buildClientIdFromPhone,
  createAdminDemoRecords,
  findClientByIdentity,
  getAppointmentNotificationEmail,
} from "./domain";

const demoRecords = () =>
  createAdminDemoRecords({
    appointmentRows: upcomingAppointments,
    certificateRows,
    clientRows,
    financeRows,
  });

describe("admin domain records", () => {
  it("normalizes demo clients, appointments and certificates with stable foreign keys", () => {
    const records = demoRecords();

    const olena = findClientByIdentity(records.clients, "Olena K.");

    expect(olena?.id).toBe("client-359873334411");
    expect(records.appointments.find((appointment) => appointment.client === "Olena K.")).toMatchObject({
      clientId: "client-359873334411",
      id: "demo-3",
    });
    expect(records.certificates.find((certificate) => certificate.code === "MMN-2407-1023")).toMatchObject({
      clientId: "client-359873334411",
      expiresAt: "2027-01-03",
      paymentDate: "2026-07-03",
      stripeId: "pi_3QMMN1023",
    });
  });

  it("exports postgres-ready rows with client_id links instead of name-only joins", () => {
    const seed = buildAdminDatabaseSeed(demoRecords());

    expect(seed.clients.find((client) => client.id === "client-359873334411")).toMatchObject({
      email: "olena.k@example.com",
      full_name: "Olena K.",
      id: "client-359873334411",
      locale: "ua",
      phone_normalized: "359873334411",
    });
    expect(seed.appointments.find((appointment) => appointment.id === "demo-3")).toMatchObject({
      client_id: "client-359873334411",
      service_name: "Deep tissue massage",
      starts_at: "15:00",
      starts_on: "2026-07-08",
    });
    expect(seed.appointments.find((appointment) => appointment.id === "demo-3")).not.toHaveProperty("client");
    expect(seed.certificates.find((certificate) => certificate.code === "MMN-2407-1023")).toMatchObject({
      amount_cents: 25000,
      client_id: "client-359873334411",
      client_name_snapshot: "Olena K.",
      currency: "EUR",
      stripe_payment_intent_id: "pi_3QMMN1023",
    });
    expect(seed.certificates.find((certificate) => certificate.code === "MMN-2407-1023")).not.toHaveProperty("amount_label");
  });

  it("keeps same-name clients separate when records already have client ids", () => {
    const records = demoRecords();
    const existingOlenaId = "client-359873334411";
    const secondOlenaId = buildClientIdFromPhone("+359 88 777 1122");
    const secondOlena = {
      ...records.clients.find((client) => client.id === existingOlenaId)!,
      email: "olena.second@example.com",
      id: secondOlenaId,
      phone: "+359 88 777 1122",
      visits: 0,
    };
    const manualCertificate = {
      ...records.certificates.find((certificate) => certificate.code === "MMN-2407-1023")!,
      amount: "95 €",
      clientId: secondOlenaId,
      code: "MMN-2407-2000",
    };

    const seed = buildAdminDatabaseSeed({
      ...records,
      certificates: [...records.certificates, manualCertificate],
      clients: [...records.clients, secondOlena],
    });

    expect(seed.certificates.find((certificate) => certificate.code === "MMN-2407-1023")?.client_id).toBe(existingOlenaId);
    expect(seed.certificates.find((certificate) => certificate.code === "MMN-2407-2000")?.client_id).toBe(secondOlenaId);
  });

  it("uses the immutable public snapshot for public appointment notifications", () => {
    const records = demoRecords();
    const appointment = records.appointments[0];

    expect(
      getAppointmentNotificationEmail(records.clients, {
        ...appointment,
        origin: "public",
        publicEmail: "booking-snapshot@example.com",
      }),
    ).toBe("booking-snapshot@example.com");
    expect(
      getAppointmentNotificationEmail(records.clients, {
        ...appointment,
        origin: "admin",
        publicEmail: "stale-snapshot@example.com",
      }),
    ).toBe(findClientByIdentity(records.clients, appointment.clientId)?.email);
  });
});
