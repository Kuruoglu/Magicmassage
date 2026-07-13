import { describe, expect, it } from "vitest";

import type { Appointment } from "@/admin/domain";
import {
  adminSectionHref,
  appointmentKey,
  calendarAppointmentHref,
  clientProfileHref,
  phoneHref,
} from "./links";

describe("admin link helpers", () => {
  it("builds role-aware admin links with encoded values", () => {
    expect(adminSectionHref("clients", "owner")).toBe("/admin?section=clients&role=owner");
    expect(clientProfileHref("+359 89 677 8309", "specialist")).toBe(
      "/admin?section=clients&role=specialist&client=%2B359%2089%20677%208309",
    );
  });

  it("builds calendar appointment links from stable keys", () => {
    const appointment: Appointment = {
      client: "Anna",
      date: "2026-07-12",
      note: "",
      service: "Massage",
      status: "Новая заявка",
      time: "10:00",
    };

    expect(appointmentKey(appointment)).toBe("2026-07-12-10:00-Anna");
    expect(calendarAppointmentHref(appointment, "administrator")).toContain(
      "appointment=2026-07-12-10%3A00-Anna",
    );
  });

  it("normalizes public phone links", () => {
    expect(phoneHref("+359 89 677 8309")).toBe("tel:+359896778309");
  });
});
