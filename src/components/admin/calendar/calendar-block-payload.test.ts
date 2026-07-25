import { describe, expect, it } from "vitest";

import type { CalendarBlock } from "@/admin/domain";

import { createCalendarBlockMutationPayload } from "./calendar-block-payload";

const block: CalendarBlock = {
  blockDate: "2026-07-20",
  endsAt: "15:00",
  id: "00000000-0000-4000-8000-000000000001",
  internalNote: "Обед",
  kind: "personal",
  specialistId: "00000000-0000-4000-8000-000000000002",
  specialistName: "Натали",
  startsAt: "14:00",
  version: 3,
};

describe("createCalendarBlockMutationPayload", () => {
  it("sends only the strict create API contract", () => {
    expect(createCalendarBlockMutationPayload(block, "block", false)).toEqual({
      blockDate: "2026-07-20",
      endsAt: "15:00",
      intent: "block",
      internalNote: "Обед",
      kind: "personal",
      specialistId: "00000000-0000-4000-8000-000000000002",
      startsAt: "14:00",
    });
    expect(createCalendarBlockMutationPayload(block, "block", false)).not.toHaveProperty("specialistName");
  });

  it("adds optimistic identity fields only for an edit", () => {
    expect(createCalendarBlockMutationPayload(block, "block", true)).toMatchObject({
      id: block.id,
      version: 3,
    });
  });
});
