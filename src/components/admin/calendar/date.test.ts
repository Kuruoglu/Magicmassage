import { describe, expect, it } from "vitest";

import {
  CALENDAR_TIME_ZONE,
  addDays,
  generateMonthGrid,
  getIsoDateInTimeZone,
  getPeriodRange,
  getPeriodRangeForInstant,
  getSofiaIsoDate,
  isIsoDate,
  isoDateToUtcDate,
  navigatePeriod,
  startOfWeek,
} from "./index";

describe("calendar ISO date utilities", () => {
  it("uses the Europe/Sofia calendar date near UTC midnight in winter and summer", () => {
    expect(CALENDAR_TIME_ZONE).toBe("Europe/Sofia");
    expect(getSofiaIsoDate(new Date("2026-01-14T22:30:00.000Z"))).toBe("2026-01-15");
    expect(getSofiaIsoDate(new Date("2026-07-14T21:30:00.000Z"))).toBe("2026-07-15");
    expect(getIsoDateInTimeZone(new Date("2026-07-14T21:30:00.000Z"), "UTC")).toBe("2026-07-14");
  });

  it("validates real ISO calendar dates and parses them at UTC midnight", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2023-02-29")).toBe(false);
    expect(isIsoDate("2026-7-04")).toBe(false);
    expect(isIsoDate("2026-04-31")).toBe(false);
    expect(isoDateToUtcDate("2026-07-14").toISOString()).toBe("2026-07-14T00:00:00.000Z");
    expect(() => isoDateToUtcDate("2026-02-30")).toThrow(RangeError);
    expect(() => getSofiaIsoDate(new Date(Number.NaN))).toThrow(RangeError);
  });

  it("adds days without depending on the machine timezone or DST boundaries", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(() => addDays("2026-01-01", 1.5)).toThrow(RangeError);
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-07-13")).toBe("2026-07-13");
    expect(startOfWeek("2026-07-19")).toBe("2026-07-13");
    expect(startOfWeek("2026-07-12")).toBe("2026-07-06");
  });

  it("builds a fixed six-week Monday-first month grid", () => {
    const february = generateMonthGrid("2024-02-15");

    expect(february).toHaveLength(42);
    expect(february.slice(0, 4)).toEqual(["2024-01-29", "2024-01-30", "2024-01-31", "2024-02-01"]);
    expect(february).toContain("2024-02-29");
    expect(february.at(-1)).toBe("2024-03-10");
  });

  it("returns inclusive day, Monday-first week, and month display periods", () => {
    expect(getPeriodRange("2026-07-14", "day")).toEqual({ end: "2026-07-14", start: "2026-07-14" });
    expect(getPeriodRange("2026-07-14", "week")).toEqual({ end: "2026-07-19", start: "2026-07-13" });
    expect(getPeriodRange("2024-02-14", "month")).toEqual({ end: "2024-02-29", start: "2024-02-01" });
    expect(getPeriodRangeForInstant(new Date("2026-07-31T21:30:00.000Z"), "month")).toEqual({
      end: "2026-08-31",
      start: "2026-08-01",
    });
  });

  it("navigates periods and clamps month-end dates", () => {
    expect(navigatePeriod("2026-07-14", "day", "next")).toBe("2026-07-15");
    expect(navigatePeriod("2026-07-14", "week", "previous")).toBe("2026-07-07");
    expect(navigatePeriod("2024-01-31", "month", 1)).toBe("2024-02-29");
    expect(navigatePeriod("2026-03-31", "month", -1)).toBe("2026-02-28");
    expect(navigatePeriod("2026-12-31", "month", "next")).toBe("2027-01-31");
  });
});
