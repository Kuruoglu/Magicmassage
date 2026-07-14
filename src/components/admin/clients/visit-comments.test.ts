import { describe, expect, it } from "vitest";

import type { Appointment } from "@/admin/domain";
import { isPostVisitCommentAvailable } from "./visit-comments";

const appointment: Appointment = {
  client: "Test Client",
  date: "2026-07-14",
  durationMinutes: 60,
  note: "",
  service: "Massage",
  status: "Подтверждена",
  time: "12:00",
};

describe("post-visit comment availability", () => {
  it("allows completed and no-show visits regardless of their date", () => {
    const beforeVisit = new Date("2026-07-14T06:00:00.000Z");
    expect(isPostVisitCommentAvailable({ ...appointment, status: "Завершена" }, beforeVisit)).toBe(true);
    expect(isPostVisitCommentAvailable({ ...appointment, status: "Не пришёл" }, beforeVisit)).toBe(true);
  });

  it("allows past appointments and keeps future appointments read-only", () => {
    const afternoonInSofia = new Date("2026-07-14T12:30:00.000Z");
    expect(isPostVisitCommentAvailable(appointment, afternoonInSofia)).toBe(true);
    expect(isPostVisitCommentAvailable({ ...appointment, time: "18:00" }, afternoonInSofia)).toBe(false);
    expect(isPostVisitCommentAvailable({ ...appointment, date: "2026-07-13" }, afternoonInSofia)).toBe(true);
  });
});
