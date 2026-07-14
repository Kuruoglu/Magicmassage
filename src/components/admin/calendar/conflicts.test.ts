import { describe, expect, it } from "vitest";

import {
  appointmentsOverlap,
  classifyAppointment,
  hasAppointmentOverlap,
  isOutsideWorkingHours,
  type CalendarAppointmentTime,
} from "./index";

const appointment = (overrides: Partial<CalendarAppointmentTime> = {}): CalendarAppointmentTime => ({
  date: "2026-07-14",
  duration: 60,
  start: "10:00",
  ...overrides,
});

describe("calendar scheduling classification", () => {
  it("detects half-open appointment overlaps on the same date", () => {
    expect(appointmentsOverlap(appointment(), appointment({ start: "10:30" }))).toBe(true);
    expect(appointmentsOverlap(appointment(), appointment({ duration: 15, start: "09:45" }))).toBe(false);
    expect(appointmentsOverlap(appointment(), appointment({ start: "11:00" }))).toBe(false);
    expect(appointmentsOverlap(appointment(), appointment({ date: "2026-07-15", start: "10:30" }))).toBe(false);
  });

  it("includes each appointment buffer in schedule conflicts", () => {
    expect(
      appointmentsOverlap(
        appointment({ bufferMinutes: 30 }),
        appointment({ duration: 60, start: "11:15" }),
      ),
    ).toBe(true);
    expect(
      appointmentsOverlap(
        appointment({ bufferMinutes: 30 }),
        appointment({ duration: 60, start: "11:30" }),
      ),
    ).toBe(false);
  });

  it("uses the minimum duration when evaluating short appointments", () => {
    expect(appointmentsOverlap(appointment({ duration: 0 }), appointment({ start: "10:10" }))).toBe(true);
    expect(appointmentsOverlap(appointment({ duration: 0 }), appointment({ start: "10:15" }))).toBe(false);
  });

  it("finds an overlap in an appointment collection", () => {
    const existing = [appointment({ start: "09:00" }), appointment({ start: "12:00" })];

    expect(hasAppointmentOverlap(appointment({ start: "12:30" }), existing)).toBe(true);
    expect(hasAppointmentOverlap(appointment({ start: "10:30" }), existing)).toBe(false);
  });

  it("classifies appointments outside working hours without treating boundaries as outside", () => {
    const workingHours = { end: "19:00", start: "10:00" };

    expect(isOutsideWorkingHours(appointment({ duration: 30, start: "09:45" }), workingHours)).toBe(true);
    expect(isOutsideWorkingHours(appointment({ duration: 30, start: "18:45" }), workingHours)).toBe(true);
    expect(isOutsideWorkingHours(appointment({ duration: 60, start: "10:00" }), workingHours)).toBe(false);
    expect(isOutsideWorkingHours(appointment({ duration: 60, start: "18:00" }), workingHours)).toBe(false);
    expect(() => isOutsideWorkingHours(appointment(), { end: "10:00", start: "19:00" })).toThrow(RangeError);
  });

  it("reports overlap and outside-working-hours as independent classifications", () => {
    const candidate = appointment({ duration: 30, start: "09:45" });
    const existing = [appointment({ duration: 30, start: "09:30" })];

    expect(classifyAppointment(candidate, existing, { end: "19:00", start: "10:00" })).toEqual({
      outsideWorkingHours: true,
      overlap: true,
    });
    expect(classifyAppointment(appointment({ start: "13:00" }), existing, { end: "19:00", start: "10:00" })).toEqual({
      outsideWorkingHours: false,
      overlap: false,
    });
  });

  it("rejects invalid appointment date and time values", () => {
    expect(() => appointmentsOverlap(appointment({ date: "2026-02-30" }), appointment())).toThrow(RangeError);
    expect(() => appointmentsOverlap(appointment({ start: "9:00" }), appointment())).toThrow(RangeError);
  });
});
