import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Appointment, CalendarBlock } from "@/admin/domain";

import { CalendarBlockDialog } from "./CalendarBlockDialog";

const weeklySchedule = Array.from({ length: 7 }, (_, index) => ({
  endsAt: "19:00",
  isWorking: index < 6,
  startsAt: "10:00",
  weekday: index + 1,
}));

const specialists = [
  {
    color: "#7c4d9d",
    displayName: "Натали",
    displayOrder: 1,
    id: "specialist-natali",
    publicBookingEnabled: true,
    scheduleVersion: 1,
    status: "active" as const,
    weeklySchedule,
  },
  {
    color: "#2f7d6d",
    displayName: "Яна",
    displayOrder: 2,
    id: "specialist-yana",
    publicBookingEnabled: true,
    scheduleVersion: 1,
    status: "active" as const,
    weeklySchedule,
  },
];

const existingAppointment: Appointment = {
  bufferMinutes: 30,
  client: "Мария Иванова",
  date: "2026-07-20",
  durationMinutes: 60,
  id: "appointment-maria",
  note: "",
  service: "Классический массаж",
  specialistId: "specialist-natali",
  specialistName: "Натали",
  status: "Подтверждена",
  time: "14:00",
};

const existingBlock: CalendarBlock = {
  blockDate: "2026-07-20",
  endsAt: "15:30",
  id: "existing-block",
  internalNote: "Перерыв",
  kind: "personal",
  specialistId: "specialist-natali",
  specialistName: "Натали",
  startsAt: "15:00",
};

describe("CalendarBlockDialog", () => {
  it("contains keyboard focus, closes on Escape, and restores focus to its trigger", async () => {
    const user = userEvent.setup();

    function DialogHarness() {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <>
          <button onClick={() => setIsOpen(true)} type="button">
            Open block dialog
          </button>
          {isOpen ? (
            <CalendarBlockDialog
              initialDate="2026-07-20"
              onClose={() => setIsOpen(false)}
              onSave={vi.fn(async () => ({ ok: true as const }))}
            />
          ) : null}
        </>
      );
    }

    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open block dialog" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    const firstControl = within(dialog).getByRole("button", { name: /Закрыть/i });
    const lastControl = within(dialog).getByRole("button", { name: /Отмена/i });
    expect(firstControl).toHaveFocus();

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(lastControl).toHaveFocus();
    await user.tab();
    expect(firstControl).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("saves a full-day personal block without creating an appointment", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Заблокировать время" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Весь день" }));
    await user.click(within(dialog).getByRole("button", { name: "Другая" }));
    await user.type(within(dialog).getByLabelText("Другая причина"), "Личный день");
    await user.click(within(dialog).getByRole("button", { name: "Заблокировать" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      blockDate: "2026-07-20",
      endsAt: "23:59",
      internalNote: "Личный день",
      kind: "personal",
      startsAt: "00:00",
    }));
  });

  it("stores a quick personal reason in the existing internal note field", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        initialDate="2026-07-20"
        initialEndsAt="15:00"
        initialStartsAt="14:00"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Обед" }));
    await user.click(screen.getByRole("button", { name: "Заблокировать" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      endsAt: "15:00",
      internalNote: "Обед",
      kind: "personal",
      startsAt: "14:00",
    }));
  });

  it("does not create a personal block across an existing appointment", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        appointments={[existingAppointment]}
        initialDate="2026-07-20"
        initialEndsAt="15:15"
        initialStartsAt="15:00"
        onClose={vi.fn()}
        onSave={onSave}
        specialists={specialists}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Обед" }));
    await user.click(screen.getByRole("button", { name: "Заблокировать" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("пересекается с записью Мария Иванова в 14:00");
  });

  it("does not overlap another personal-time block", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        calendarBlocks={[existingBlock]}
        initialDate="2026-07-20"
        initialEndsAt="16:00"
        initialStartsAt="14:45"
        onClose={vi.fn()}
        onSave={onSave}
        specialists={specialists}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Личные дела" }));
    await user.click(screen.getByRole("button", { name: "Заблокировать" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("уже заблокирован с 15:00 до 15:30");
  });

  it("requires an explicit specialist for a selected interval in the all-specialists view", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        initialDate="2026-07-20"
        initialEndsAt="15:00"
        initialStartsAt="14:00"
        onClose={vi.fn()}
        onSave={onSave}
        requireSpecialistSelection
        role="owner"
        specialists={specialists}
      />,
    );

    expect(screen.getByLabelText("Специалист")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Заблокировать" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Специалист"), "specialist-yana");
    await user.click(screen.getByRole("button", { name: "Заблокировать" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ specialistId: "specialist-yana" }));
  });

  it("keeps the dialog open when the server reports an appointment conflict", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({
      message: "Это время пересекается с записью клиента.",
      ok: false as const,
    }));

    render(
      <CalendarBlockDialog
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Заблокировать" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("пересекается с записью клиента");
    expect(screen.getByRole("dialog", { name: "Заблокировать время" })).toBeInTheDocument();
  });

  it("assigns owner-created blocked time to the selected specialist", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onSave={onSave}
        role="owner"
        specialists={specialists}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Специалист"), "specialist-yana");
    await user.click(screen.getByRole("button", { name: "Заблокировать" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        specialistId: "specialist-yana",
        specialistName: "Яна",
      }),
    );
  });

  it("keeps specialist-created blocked time in their own calendar", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        currentSpecialistId="specialist-yana"
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onSave={onSave}
        role="specialist"
        specialists={specialists}
      />,
    );

    expect(screen.getByLabelText("Специалист")).toHaveTextContent("Яна");
    expect(screen.queryByRole("combobox", { name: "Специалист" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Заблокировать" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ specialistId: "specialist-yana" }));
  });

  it("creates a contact-free current-client block in the specialist calendar", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarBlockDialog
        currentSpecialistId="specialist-yana"
        initialDate="2026-07-20"
        initialEndsAt="14:00"
        initialStartsAt="13:00"
        intent="walk-in"
        onClose={vi.fn()}
        onSave={onSave}
        role="specialist"
        specialists={specialists}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Занять время клиентом" });
    expect(within(dialog).queryByText("Тип")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: "Весь день" })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Начало")).toHaveValue("13:00");
    expect(within(dialog).getByLabelText("Конец")).toHaveValue("14:00");
    await user.click(within(dialog).getByRole("button", { name: "Занять время" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      internalNote: "Клиент сейчас",
      kind: "other",
      specialistId: "specialist-yana",
      startsAt: "13:00",
      endsAt: "14:00",
    }));
  });

  it("ignores every close action while a block is being saved", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let finishSave: ((result: { message: string; ok: false }) => void) | undefined;
    const onSave = vi.fn(() => new Promise<{ message: string; ok: false }>((resolve) => {
      finishSave = resolve;
    }));

    render(
      <CalendarBlockDialog
        initialDate="2026-07-20"
        onClose={onClose}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Заблокировать" }));
    expect(screen.getByRole("button", { name: "Закрыть" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finishSave?.({ message: "Конфликт", ok: false }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Конфликт");
  });
});
