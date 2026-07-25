import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminRecordDeleteDialog } from "./AdminRecordDeleteDialog";

const baseProps = {
  confirmLabel: "Удалить клиента",
  confirmationText: "Анна Петрова",
  description: "Профиль будет удалён без возможности восстановления.",
  kicker: "Клиенты",
  onClose: vi.fn(),
  onConfirm: vi.fn(async () => ({ ok: true as const })),
  subject: "Анна Петрова",
  summaryItems: ["+359 88 111 22 33", "0 записей"],
  title: "Удалить клиента?",
};

describe("AdminRecordDeleteDialog", () => {
  it("makes an underlying drawer inert while the destructive warning is open", () => {
    const drawer = document.createElement("div");
    drawer.className = "admin-drawer-backdrop";
    const trigger = document.createElement("button");
    drawer.appendChild(trigger);
    document.body.appendChild(drawer);
    trigger.focus();

    const { unmount } = render(<AdminRecordDeleteDialog {...baseProps} />);
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");

    unmount();
    expect(drawer).not.toHaveAttribute("aria-hidden");
    expect(drawer).not.toHaveAttribute("inert");
    expect(trigger).toHaveFocus();
    drawer.remove();
  });

  it("moves focus to a workspace fallback when the delete trigger no longer exists", () => {
    const trigger = document.createElement("button");
    const main = document.createElement("main");
    const fallback = document.createElement("button");
    main.appendChild(fallback);
    document.body.append(trigger, main);
    trigger.focus();

    const { unmount } = render(<AdminRecordDeleteDialog {...baseProps} />);
    trigger.remove();
    unmount();

    expect(fallback).toHaveFocus();
    main.remove();
  });

  it("focuses the safe action and requires the exact client name", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => ({ ok: true as const }));
    render(<AdminRecordDeleteDialog {...baseProps} onConfirm={onConfirm} />);

    const safeAction = screen.getByRole("button", { name: "Не удалять" });
    const deleteAction = screen.getByRole("button", { name: "Удалить клиента" });
    expect(safeAction).toHaveFocus();
    expect(deleteAction).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "Анна Петров");
    expect(deleteAction).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "а");
    expect(deleteAction).toBeEnabled();
    await user.click(deleteAction);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("explains why a linked client cannot be deleted", () => {
    render(
      <AdminRecordDeleteDialog
        {...baseProps}
        blockedReason="У клиента есть 2 записи. Сначала удалите их из календаря."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("У клиента есть 2 записи");
    expect(screen.queryByRole("button", { name: "Удалить клиента" })).not.toBeInTheDocument();
  });

  it("keeps the dialog open and exposes a retry after a server error", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn()
      .mockResolvedValueOnce({ message: "Сервер недоступен.", ok: false as const })
      .mockResolvedValueOnce({ ok: true as const });
    const onClose = vi.fn();
    render(<AdminRecordDeleteDialog {...baseProps} onClose={onClose} onConfirm={onConfirm} />);

    await user.type(screen.getByRole("textbox"), "Анна Петрова");
    await user.click(screen.getByRole("button", { name: "Удалить клиента" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Сервер недоступен");
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Удалить клиента" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
