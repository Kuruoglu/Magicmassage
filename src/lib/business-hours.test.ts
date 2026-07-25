import { describe, expect, it } from "vitest";

import {
  buildRuntimeMapUrls,
  cloneBusinessHoursSchedule,
  isBusinessHoursSchedule,
  localizeBusinessHoursSchedule,
  toPhoneHref,
} from "./business-hours";

describe("business hours helpers", () => {
  it("validates a complete seven-day schedule with at least one open day", () => {
    const schedule = cloneBusinessHoursSchedule();

    expect(isBusinessHoursSchedule(schedule)).toBe(true);
    expect(isBusinessHoursSchedule(schedule.slice(0, 6))).toBe(false);
    expect(isBusinessHoursSchedule(schedule.map((day) => ({ ...day, weekday: 1 })))).toBe(false);
    expect(isBusinessHoursSchedule(schedule.map((day) => ({ ...day, isOpen: false })))).toBe(false);
    expect(isBusinessHoursSchedule(schedule.map((day) => (
      day.weekday === 1 ? { ...day, closesAt: day.opensAt } : day
    )))).toBe(false);
  });

  it("localizes working days and closed days", () => {
    const localized = localizeBusinessHoursSchedule("en", cloneBusinessHoursSchedule());

    expect(localized[0]).toEqual({ day: "Monday", time: "10:00 - 19:00" });
    expect(localized[6]).toEqual({ day: "Sunday", time: "closed" });
  });

  it("normalizes phone and map URLs for runtime links", () => {
    expect(toPhoneHref("+359 89 677 8308")).toBe("+359896778308");
    expect(buildRuntimeMapUrls("ул. Места 49, Бургас")).toEqual({
      directions: "https://www.google.com/maps/dir/?api=1&destination=%D1%83%D0%BB.%20%D0%9C%D0%B5%D1%81%D1%82%D0%B0%2049%2C%20%D0%91%D1%83%D1%80%D0%B3%D0%B0%D1%81",
      embed: "https://www.google.com/maps?q=%D1%83%D0%BB.%20%D0%9C%D0%B5%D1%81%D1%82%D0%B0%2049%2C%20%D0%91%D1%83%D1%80%D0%B3%D0%B0%D1%81&output=embed",
    });
  });
});
