import { describe, expect, it } from "vitest";

import type { Appointment } from "@/admin/domain";

import { layoutDayAppointments } from "./TimeGrid";

function createAppointment(id: string, durationMinutes: number, time = "10:00"): Appointment {
  return {
    client: id,
    date: "2026-07-14",
    durationMinutes,
    id,
    note: "",
    service: "Test service",
    status: "Подтверждена",
    time,
  };
}

function layoutsById(appointments: Appointment[]) {
  return Object.fromEntries(
    layoutDayAppointments(appointments).map(({ appointment, layout }) => [appointment.id, layout]),
  );
}

describe("layoutDayAppointments", () => {
  it("assigns simultaneous appointments deterministic columns, left offsets, and widths", () => {
    const first = createAppointment("appointment-a", 60);
    const second = createAppointment("appointment-b", 45);
    const third = createAppointment("appointment-c", 30);
    const boundary = createAppointment("appointment-d", 30, "11:00");
    const shuffled = [third, boundary, first, second];
    const layouts = layoutsById(shuffled);

    expect(layoutDayAppointments(shuffled).map(({ appointment }) => appointment.id)).toEqual([
      "appointment-a",
      "appointment-b",
      "appointment-c",
      "appointment-d",
    ]);
    expect(layouts).toEqual({
      "appointment-a": { column: 0, columnCount: 3, leftPercentage: 0, widthPercentage: 33.333333 },
      "appointment-b": { column: 1, columnCount: 3, leftPercentage: 33.333333, widthPercentage: 33.333333 },
      "appointment-c": { column: 2, columnCount: 3, leftPercentage: 66.666667, widthPercentage: 33.333333 },
      "appointment-d": { column: 0, columnCount: 1, leftPercentage: 0, widthPercentage: 100 },
    });
    expect(layoutsById([...shuffled].reverse())).toEqual(layouts);
  });

  it("reuses a column when an overlapping appointment ends at the next start", () => {
    const longAppointment = createAppointment("appointment-a", 60);
    const earlyAppointment = createAppointment("appointment-b", 15, "10:15");
    const nextAppointment = createAppointment("appointment-c", 15, "10:30");
    const layouts = layoutsById([nextAppointment, earlyAppointment, longAppointment]);

    expect(layouts["appointment-a"]).toMatchObject({ column: 0, columnCount: 2 });
    expect(layouts["appointment-b"]).toMatchObject({ column: 1, columnCount: 2 });
    expect(layouts["appointment-c"]).toMatchObject({ column: 1, columnCount: 2 });
  });
});
