import type { CalendarBlock } from "@/admin/domain";

export type CalendarBlockIntent = "block" | "walk-in";

export function createCalendarBlockMutationPayload(
  block: CalendarBlock,
  intent: CalendarBlockIntent,
  isEditing: boolean,
) {
  const payload = {
    blockDate: block.blockDate,
    endsAt: block.endsAt,
    intent,
    internalNote: block.internalNote,
    kind: block.kind,
    specialistId: block.specialistId,
    startsAt: block.startsAt,
  };

  return isEditing
    ? { ...payload, id: block.id, version: block.version }
    : payload;
}
