import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SpecialistRecord } from "@/admin/domain";

import { SpecialistScheduleDialog } from "./SpecialistScheduleDialog";

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
    isWorking: index < 6,
    startsAt: "10:00",
    weekday: index + 1,
  })),
};

describe("SpecialistScheduleDialog", () => {
  it("saves a half-hour weekly schedule for the selected specialist", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    render(
      <SpecialistScheduleDialog
        onClose={vi.fn()}
        onSave={onSave}
        specialist={specialist}
      />,
    );

    fireEvent.change(screen.getByLabelText("Начало: Пятница"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить график" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      specialist.id,
      expect.arrayContaining([
        expect.objectContaining({ endsAt: "19:00", isWorking: true, startsAt: "09:00", weekday: 5 }),
      ]),
    ));
  });

  it("allows closing the complete week", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    render(
      <SpecialistScheduleDialog
        onClose={vi.fn()}
        onSave={onSave}
        specialist={{
          ...specialist,
          weeklySchedule: specialist.weeklySchedule.map((day) => ({ ...day, isWorking: false })),
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить график" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      specialist.id,
      expect.arrayContaining([
        expect.objectContaining({ isWorking: false, weekday: 1 }),
        expect.objectContaining({ isWorking: false, weekday: 7 }),
      ]),
    ));
  });
});
