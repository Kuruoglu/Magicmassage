import { describe, expect, it } from "vitest";

import {
  classifyAppointmentAgainstSchedule,
  createCalendarWorkingSchedule,
  getCalendarIsoDate,
} from "./schedule";

const settings = {
  timezone: "Europe/Sofia",
  workingDays: "Пн-Сб",
  workingHours: "12:00-18:00",
};

describe("calendar working schedule", () => {
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
});
