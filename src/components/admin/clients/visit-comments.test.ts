import { describe, expect, it } from "vitest";

import type { Appointment } from "@/admin/domain";
import {
  isPostVisitCommentAvailable,
  needsPostVisitComment,
} from "./visit-comments";

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

  it("allows comments after the visit ends, not while it is in progress", () => {
    const beforeVisitInSofia = new Date("2026-07-14T08:59:00.000Z");
    const duringVisitInSofia = new Date("2026-07-14T09:30:00.000Z");
    const afterVisitInSofia = new Date("2026-07-14T10:00:00.000Z");

    expect(isPostVisitCommentAvailable(appointment, beforeVisitInSofia)).toBe(false);
    expect(isPostVisitCommentAvailable(appointment, duringVisitInSofia)).toBe(false);
    expect(isPostVisitCommentAvailable(appointment, afterVisitInSofia)).toBe(true);
    expect(isPostVisitCommentAvailable({ ...appointment, date: "2026-07-13" }, duringVisitInSofia)).toBe(true);
  });

  it("requires comments only for visits that could have happened", () => {
    const afterVisitInSofia = new Date("2026-07-14T10:00:00.000Z");

    expect(needsPostVisitComment(appointment, afterVisitInSofia)).toBe(true);
    expect(needsPostVisitComment({ ...appointment, status: "Ожидает" }, afterVisitInSofia)).toBe(true);
    expect(needsPostVisitComment({ ...appointment, postVisitComment: "Заполнено" }, afterVisitInSofia)).toBe(false);
    expect(needsPostVisitComment({ ...appointment, status: "Новая заявка" }, afterVisitInSofia)).toBe(false);
    expect(needsPostVisitComment({ ...appointment, status: "Отменена" }, afterVisitInSofia)).toBe(false);
    expect(needsPostVisitComment({ ...appointment, status: "Не пришёл" }, afterVisitInSofia)).toBe(false);
  });
});
