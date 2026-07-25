import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarTimeSelectionDialog } from "./CalendarTimeSelectionDialog";

const selection = {
  date: "2026-07-20",
  durationMinutes: 60,
  endsAt: "15:00",
  startsAt: "14:00",
};

describe("CalendarTimeSelectionDialog", () => {
  it("offers both domain actions and preserves the selected interval", async () => {
    const user = userEvent.setup();
    const onChooseAppointment = vi.fn();
    const onChooseBlock = vi.fn();

    render(
      <CalendarTimeSelectionDialog
        onChooseAppointment={onChooseAppointment}
        onChooseBlock={onChooseBlock}
        onClose={vi.fn()}
        selection={selection}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Что создать?" })).toHaveTextContent("14:00 - 15:00");
    expect(document.body).not.toHaveClass("admin-drawer-open");
    await user.click(screen.getByRole("button", { name: /Личное время/ }));
    expect(onChooseBlock).toHaveBeenCalledWith(selection);

    await user.click(screen.getByRole("button", { name: /Записать клиента/ }));
    expect(onChooseAppointment).toHaveBeenCalledWith(selection);
  });

  it("focuses the non-modal sheet, closes on Escape, and restores prior focus", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const view = render(
      <CalendarTimeSelectionDialog
        onChooseAppointment={vi.fn()}
        onChooseBlock={vi.fn()}
        onClose={onClose}
        selection={selection}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Что создать?" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
