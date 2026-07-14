import { describe, expect, it } from "vitest";

import {
  CALENDAR_SNAP_MINUTES,
  MIN_APPOINTMENT_DURATION_MINUTES,
  clampDuration,
  durationToHeight,
  minutesToTime,
  positionToTime,
  snapMinutes,
  timeToMinutes,
  timeToPosition,
} from "./index";

describe("calendar time and geometry utilities", () => {
  it("converts between strict HH:mm values and minutes", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("10:45")).toBe(645);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(645)).toBe("10:45");
    expect(minutesToTime(1440)).toBe("24:00");
  });

  it("rejects malformed or out-of-range time values", () => {
    expect(() => timeToMinutes("9:00")).toThrow(RangeError);
    expect(() => timeToMinutes("24:01")).toThrow(RangeError);
    expect(() => timeToMinutes("12:60")).toThrow(RangeError);
    expect(() => minutesToTime(-1)).toThrow(RangeError);
    expect(() => minutesToTime(1.5)).toThrow(RangeError);
    expect(() => minutesToTime(1441)).toThrow(RangeError);
  });

  it("snaps to the nearest 15-minute interval", () => {
    expect(CALENDAR_SNAP_MINUTES).toBe(15);
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(22.5)).toBe(30);
    expect(snapMinutes(67)).toBe(60);
    expect(() => snapMinutes(Number.NaN)).toThrow(RangeError);
  });

  it("maps calendar times to vertical positions and back", () => {
    expect(timeToPosition("10:30", "09:00", 60)).toBe(90);
    expect(timeToPosition("08:30", "09:00", 80)).toBe(-40);
    expect(positionToTime(90, "09:00", 60)).toBe("10:30");
    expect(positionToTime(45, "09:00", 90)).toBe("09:30");
    expect(() => timeToPosition("10:00", "09:00", 0)).toThrow(RangeError);
    expect(() => positionToTime(Number.POSITIVE_INFINITY, "09:00", 60)).toThrow(RangeError);
  });

  it("calculates duration height and clamps durations to the 15-minute minimum", () => {
    expect(MIN_APPOINTMENT_DURATION_MINUTES).toBe(15);
    expect(durationToHeight(90, 80)).toBe(120);
    expect(durationToHeight(0, 80)).toBe(0);
    expect(() => durationToHeight(-1, 80)).toThrow(RangeError);
    expect(clampDuration(-30)).toBe(15);
    expect(clampDuration(0)).toBe(15);
    expect(clampDuration(14)).toBe(15);
    expect(clampDuration(15)).toBe(15);
    expect(clampDuration(75)).toBe(75);
  });
});
