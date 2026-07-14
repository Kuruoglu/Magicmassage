import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ClientRecord } from "@/admin/domain";

import { ClientForm } from "./ClientForm";

const existingClient: ClientRecord = {
  email: "anna@example.com",
  history: [],
  id: "client-anna",
  language: "ru",
  name: "Анна Петрова",
  next: "Не назначен",
  note: "",
  phone: "+359 88 111 22 33",
  preferredContact: "Телефон",
  status: "Активный клиент",
  tags: [],
  telegram: "",
  totalSpend: "0 €",
  visits: 1,
};

function renderForm(overrides: Partial<Parameters<typeof ClientForm>[0]> = {}) {
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(
    <ClientForm
      clients={[existingClient]}
      onClose={onClose}
      onSave={onSave}
      role="owner"
      {...overrides}
    />,
  );
  return { onClose, onSave };
}

describe("ClientForm", () => {
  it("keeps the note collapsed until requested and renders status as a shared form control", async () => {
    const user = userEvent.setup();
    renderForm();
    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });

    expect(within(dialog).queryByLabelText("Заметка клиента")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Статус").tagName).toBe("SELECT");

    await user.click(within(dialog).getByRole("button", { name: "Добавить заметку" }));
    expect(within(dialog).getByLabelText("Заметка клиента")).toHaveFocus();
  });

  it("detects a normalized duplicate phone and protects a dirty form from backdrop closing", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose, onSave } = renderForm();
    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });

    await user.type(within(dialog).getByLabelText("Имя"), "Другая Анна");
    await user.type(within(dialog).getByLabelText("Телефон"), "359881112233");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Клиент с таким телефоном уже есть");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector(".admin-drawer-backdrop")!);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
