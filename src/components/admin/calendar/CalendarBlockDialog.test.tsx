import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CalendarBlockDialog } from "./CalendarBlockDialog";

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
    await user.type(within(dialog).getByLabelText("Внутренняя заметка"), "Личный день");
    await user.click(within(dialog).getByRole("button", { name: "Заблокировать" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      blockDate: "2026-07-20",
      endsAt: "23:59",
      internalNote: "Личный день",
      kind: "personal",
      startsAt: "00:00",
    }));
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
