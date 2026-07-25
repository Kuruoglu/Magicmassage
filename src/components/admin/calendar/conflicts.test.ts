import { describe, expect, it } from "vitest";

import type { CalendarBlock } from "@/admin/domain";

import {
  appointmentOverlapsCalendarBlock,
  appointmentsOverlap,
  calendarBlocksOverlap,
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

const block = (overrides: Partial<CalendarBlock> = {}): CalendarBlock => ({
  blockDate: "2026-07-14",
  endsAt: "11:30",
  id: "block-1",
  internalNote: "Обед",
  kind: "personal",
  specialistId: "specialist-natali",
  startsAt: "11:00",
  ...overrides,
});

describe("calendar scheduling classification", () => {
  it("detects half-open appointment overlaps on the same date", () => {
    expect(appointmentsOverlap(appointment(), appointment({ start: "10:30" }))).toBe(true);
    expect(appointmentsOverlap(appointment(), appointment({ duration: 15, start: "09:45" }))).toBe(false);
    expect(appointmentsOverlap(appointment(), appointment({ start: "11:00" }))).toBe(false);
    expect(appointmentsOverlap(appointment(), appointment({ date: "2026-07-15", start: "10:30" }))).toBe(false);
  });

  it("does not treat simultaneous appointments for different specialists as a conflict", () => {
    expect(
      appointmentsOverlap(
        appointment({ specialistId: "specialist-natali" }),
        appointment({ specialistId: "specialist-yana" }),
      ),
    ).toBe(false);
    expect(
      appointmentsOverlap(
        appointment({ specialistId: "specialist-natali" }),
        appointment({ specialistId: "specialist-natali" }),
      ),
    ).toBe(true);
  });

  it("allows admin appointments to meet at their real duration boundary", () => {
    expect(
      appointmentsOverlap(
        appointment(),
        appointment({ duration: 60, start: "11:00" }),
      ),
    ).toBe(false);
    expect(
      appointmentsOverlap(
        appointment(),
        appointment({ duration: 60, start: "10:45" }),
      ),
    ).toBe(true);
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

  it("includes the appointment buffer when checking a calendar block", () => {
    const bufferedAppointment = {
      ...appointment({ specialistId: "specialist-natali" }),
      buffer: 30,
    };

    expect(appointmentOverlapsCalendarBlock(bufferedAppointment, block())).toBe(true);
    expect(appointmentOverlapsCalendarBlock(bufferedAppointment, block({ startsAt: "11:30", endsAt: "12:00" }))).toBe(false);
  });

  it("scopes appointment-block conflicts to the same date and specialist", () => {
    const bufferedAppointment = {
      ...appointment({ specialistId: "specialist-natali" }),
      buffer: 30,
    };

    expect(appointmentOverlapsCalendarBlock(bufferedAppointment, block({ blockDate: "2026-07-15" }))).toBe(false);
    expect(appointmentOverlapsCalendarBlock(bufferedAppointment, block({ specialistId: "specialist-yana" }))).toBe(false);
  });

  it("uses half-open, specialist-aware intervals for block-to-block conflicts", () => {
    expect(calendarBlocksOverlap(block(), block({ id: "block-2", startsAt: "11:15", endsAt: "12:00" }))).toBe(true);
    expect(calendarBlocksOverlap(block(), block({ id: "block-2", startsAt: "11:30", endsAt: "12:00" }))).toBe(false);
    expect(calendarBlocksOverlap(block(), block({ blockDate: "2026-07-15", id: "block-2" }))).toBe(false);
    expect(calendarBlocksOverlap(block(), block({ id: "block-2", specialistId: "specialist-yana" }))).toBe(false);
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
