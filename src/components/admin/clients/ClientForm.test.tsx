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

  it("records explicit care-email consent for owners and administrators", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm({ initialClient: existingClient, role: "administrator" });
    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });
    const consent = within(dialog).getByRole("checkbox", {
      name: "Клиент явно согласился получать письмо после визита",
    });

    expect(consent).toBeEnabled();
    expect(consent).not.toBeChecked();
    await user.click(consent);
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        careEmailConsentAt: expect.any(String),
        careEmailConsentSource: "admin_recorded",
        careEmailExpectedConsentAt: null,
        careEmailExpectedConsentSource: null,
        careEmailExpectedWithdrawnAt: null,
        careEmailWithdrawnAt: undefined,
      }),
      existingClient.id,
    );
  });

  it("omits consent state when the administrator did not change it", async () => {
    const user = userEvent.setup();
    const consentedClient: ClientRecord = {
      ...existingClient,
      careEmailConsentAt: "2026-07-20T10:00:00.000Z",
      careEmailConsentSource: "public_booking",
    };
    const { onSave } = renderForm({
      clients: [consentedClient],
      initialClient: consentedClient,
    });
    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });

    await user.type(within(dialog).getByLabelText("Имя"), " обновлено");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    const savedClient = onSave.mock.calls[0][0] as ClientRecord;
    expect(savedClient).not.toHaveProperty("careEmailConsentAt");
    expect(savedClient).not.toHaveProperty("careEmailConsentSource");
    expect(savedClient).not.toHaveProperty("careEmailWithdrawnAt");
    expect(savedClient).not.toHaveProperty("careEmailExpectedConsentAt");
  });

  it("requires explicit renewed consent after the client email changes", async () => {
    const user = userEvent.setup();
    const consentedClient: ClientRecord = {
      ...existingClient,
      careEmailConsentAt: "2026-07-20T10:00:00.000Z",
      careEmailConsentSource: "public_booking",
    };
    const { onSave } = renderForm({
      clients: [consentedClient],
      initialClient: consentedClient,
    });
    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });
    const consent = within(dialog).getByRole("checkbox", {
      name: "Клиент явно согласился получать письмо после визита",
    });

    expect(consent).toBeChecked();
    await user.clear(within(dialog).getByLabelText("Email"));
    await user.type(within(dialog).getByLabelText("Email"), "new@example.com");
    expect(consent).not.toBeChecked();

    await user.click(consent);
    await user.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        careEmailConsentAt: expect.any(String),
        careEmailExpectedConsentAt: consentedClient.careEmailConsentAt,
        careEmailExpectedConsentSource: "public_booking",
        email: "new@example.com",
      }),
      consentedClient.id,
    );
  });

  it("restores unchanged consent when an email edit is reverted before save", async () => {
    const user = userEvent.setup();
    const consentedClient: ClientRecord = {
      ...existingClient,
      careEmailConsentAt: "2026-07-20T10:00:00.000Z",
      careEmailConsentSource: "public_booking",
    };
    const { onSave } = renderForm({
      clients: [consentedClient],
      initialClient: consentedClient,
    });
    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });
    const email = within(dialog).getByLabelText("Email");
    const consent = within(dialog).getByRole("checkbox", {
      name: "Клиент явно согласился получать письмо после визита",
    });

    await user.clear(email);
    await user.type(email, "temporary@example.com");
    expect(consent).not.toBeChecked();

    await user.clear(email);
    await user.type(email, existingClient.email);
    expect(consent).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    const savedClient = onSave.mock.calls[0][0] as ClientRecord;
    expect(savedClient.email).toBe(existingClient.email);
    expect(savedClient).not.toHaveProperty("careEmailConsentAt");
    expect(savedClient).not.toHaveProperty("careEmailConsentSource");
    expect(savedClient).not.toHaveProperty("careEmailWithdrawnAt");
    expect(savedClient).not.toHaveProperty("careEmailExpectedConsentAt");
  });

  it("does not carry explicit consent to a later email address", async () => {
    const user = userEvent.setup();
    const consentedClient: ClientRecord = {
      ...existingClient,
      careEmailConsentAt: "2026-07-20T10:00:00.000Z",
      careEmailConsentSource: "public_booking",
    };
    const { onSave } = renderForm({
      clients: [consentedClient],
      initialClient: consentedClient,
    });
    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });
    const email = within(dialog).getByLabelText("Email");
    const consent = within(dialog).getByRole("checkbox", {
      name: "Клиент явно согласился получать письмо после визита",
    });

    await user.clear(email);
    await user.type(email, "consented@example.com");
    await user.click(consent);
    expect(consent).toBeChecked();

    await user.clear(email);
    await user.type(email, "unconfirmed@example.com");
    expect(consent).not.toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    const savedClient = onSave.mock.calls[0][0] as ClientRecord;
    expect(savedClient).toEqual(expect.objectContaining({
      careEmailConsentAt: consentedClient.careEmailConsentAt,
      careEmailConsentSource: consentedClient.careEmailConsentSource,
      careEmailExpectedConsentAt: consentedClient.careEmailConsentAt,
      careEmailExpectedConsentSource: consentedClient.careEmailConsentSource,
      careEmailWithdrawnAt: expect.any(String),
      email: "unconfirmed@example.com",
    }));
  });

  it("drops new consent when an unconsented client's email changes again", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm({ initialClient: existingClient, role: "administrator" });
    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });
    const email = within(dialog).getByLabelText("Email");
    const consent = within(dialog).getByRole("checkbox", {
      name: "Клиент явно согласился получать письмо после визита",
    });

    await user.click(consent);
    await user.clear(email);
    await user.type(email, "unconfirmed@example.com");
    expect(consent).not.toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    const savedClient = onSave.mock.calls[0][0] as ClientRecord;
    expect(savedClient.email).toBe("unconfirmed@example.com");
    expect(savedClient).not.toHaveProperty("careEmailConsentAt");
    expect(savedClient).not.toHaveProperty("careEmailWithdrawnAt");
  });

  it("does not expose the consent control to non-operational roles", () => {
    renderForm({ initialClient: existingClient, role: "editor" });

    expect(screen.queryByRole("checkbox", {
      name: "Клиент явно согласился получать письмо после визита",
    })).not.toBeInTheDocument();
  });
});
