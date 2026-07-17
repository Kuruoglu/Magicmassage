import { describe, expect, it } from "vitest";

import type { SpecialistRecord } from "@/admin/domain";

import {
  classifyAppointmentAgainstSchedule,
  createCalendarWorkingSchedule,
  createSpecialistWorkingSchedule,
  getCalendarIsoDate,
  hasScheduleEnvelope,
} from "./schedule";

const settings = {
  timezone: "Europe/Sofia",
  workingDays: "Пн-Сб",
  workingHours: "12:00-18:00",
};

describe("calendar working schedule", () => {
  it("accepts a fully closed compatibility envelope", () => {
    expect(hasScheduleEnvelope({ workingDays: "", workingHours: "10:00-19:00" })).toBe(true);
    expect(hasScheduleEnvelope({ workingDays: "" })).toBe(false);
  });

  it("classifies saved working days and hours", () => {
    const schedule = createCalendarWorkingSchedule(settings);

    expect(
      classifyAppointmentAgainstSchedule(
        { date: "2026-07-13", duration: 60, start: "12:00" },
        schedule,
      ),
    ).toEqual({
      outsideDailyWorkingHours: false,
      outsideWorkingDay: false,
      outsideWorkingHours: false,
    });
    expect(
      classifyAppointmentAgainstSchedule(
        { date: "2026-07-13", duration: 60, start: "11:00" },
        schedule,
      ).outsideWorkingHours,
    ).toBe(true);
    expect(
      classifyAppointmentAgainstSchedule(
        { date: "2026-07-19", duration: 60, start: "12:00" },
        schedule,
      ),
    ).toEqual({
      outsideDailyWorkingHours: false,
      outsideWorkingDay: true,
      outsideWorkingHours: true,
    });
  });

  it("uses the saved timezone when deriving the current calendar date", () => {
    const schedule = createCalendarWorkingSchedule({ ...settings, timezone: "Pacific/Honolulu" });

    expect(getCalendarIsoDate(schedule, new Date("2026-07-14T01:00:00.000Z"))).toBe("2026-07-13");
  });

  it("uses the selected specialist weekday instead of global text hours", () => {
    const specialist: SpecialistRecord = {
      color: "#7c4da1",
      displayName: "Natali",
      displayOrder: 1,
      id: "00000000-0000-4000-8000-000000000001",
      publicBookingEnabled: true,
      scheduleVersion: 1,
      status: "active",
      weeklySchedule: Array.from({ length: 7 }, (_, index) => ({
        endsAt: "19:00",
        isWorking: index < 5,
        startsAt: index === 4 ? "09:00" : "10:00",
        weekday: index + 1,
      })),
    };
    const schedule = createSpecialistWorkingSchedule(specialist, "Europe/Sofia");

    expect(classifyAppointmentAgainstSchedule(
      { date: "2026-07-17", duration: 60, start: "09:00" },
      schedule,
    ).outsideWorkingHours).toBe(false);
    expect(classifyAppointmentAgainstSchedule(
      { date: "2026-07-18", duration: 60, start: "10:00" },
      schedule,
    ).outsideWorkingHours).toBe(true);
  });
});
