import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Appointment, ClientRecord } from "@/admin/domain";

import {
  CalendarAppointmentCancelDialog,
  CalendarAppointmentDialog,
  type CalendarAppointmentDialogProps,
  type CalendarAppointmentSaveResult,
} from "./index";

const clients: ClientRecord[] = [
  {
    email: "anna@example.com",
    history: [],
    id: "client-anna",
    language: "ru",
    name: "Анна Петрова",
    next: "",
    note: "",
    phone: "+359881112233",
    preferredContact: "Телефон",
    status: "Активный клиент",
    tags: [],
    telegram: "",
    totalSpend: "0 €",
    visits: 0,
  },
  {
    email: "maria@example.com",
    history: [],
    id: "client-maria",
    language: "bg",
    name: "Мария Иванова",
    next: "",
    note: "",
    phone: "+359882223344",
    preferredContact: "Телефон",
    status: "Активный клиент",
    tags: [],
    telegram: "",
    totalSpend: "0 €",
    visits: 0,
  },
];

const conflictingAppointment: Appointment = {
  client: "Мария Иванова",
  clientId: "client-maria",
  date: "2026-07-14",
  durationMinutes: 60,
  id: "appointment-maria",
  note: "",
  service: "Лимфодренажный массаж",
  status: "Подтверждена",
  time: "14:30",
};

const siteSettings = {
  timezone: "Europe/Sofia",
  workingDays: "Пн-Сб",
  workingHours: "10:00-19:00",
};

function renderAppointmentDialog(overrides: Partial<CalendarAppointmentDialogProps> = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onSave = overrides.onSave ?? vi.fn(async () => ({ ok: true }) as CalendarAppointmentSaveResult);

  render(
    <CalendarAppointmentDialog
      appointments={[]}
      bookingBufferMinutes={30}
      clients={clients}
      onClose={onClose}
      onSave={onSave}
      prefillDate="2026-07-14"
      role="owner"
      siteSettings={siteSettings}
      {...overrides}
    />,
  );

  return { onClose, onSave };
}

describe("CalendarAppointmentDialog", () => {
  it("keeps the booked service and duration immutable for public appointments", () => {
    renderAppointmentDialog({
      initialAppointment: {
        ...conflictingAppointment,
        origin: "public",
        publicReference: "MMN-20260714-0001",
      },
    });
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText("Услуга")).toBeDisabled();
    expect(within(dialog).getByLabelText("Длительность, минут")).toBeDisabled();
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Услуга и длительность зафиксированы клиентом при онлайн-записи",
    );
  });

  it("preserves an existing appointment buffer snapshot when settings change", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      bookingBufferMinutes: 30,
      initialAppointment: { ...conflictingAppointment, bufferMinutes: 15 },
    });
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ bufferMinutes: 15 }));
  });

  it("searches existing clients and links the selected identity on save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog();
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    await user.type(within(dialog).getByLabelText("Клиент"), "maria@example");

    const suggestions = within(dialog).getByRole("listbox", { name: "Найденные клиенты" });
    await user.click(within(suggestions).getByRole("option", { name: /Мария Иванова/ }));
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ client: "Мария Иванова", clientId: "client-maria" }));
  });

  it("supports keyboard selection through an accessible client combobox", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog();
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    const clientInput = within(dialog).getByRole("combobox", { name: "Клиент" });

    await user.type(clientInput, "maria@example");

    expect(clientInput).toHaveAttribute("aria-expanded", "true");
    expect(clientInput).toHaveAttribute("aria-autocomplete", "list");
    expect(within(dialog).getByRole("option", { name: /Мария Иванова/ })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");
    expect(clientInput).toHaveValue("Мария Иванова");
    expect(clientInput).toHaveAttribute("aria-expanded", "false");

    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ clientId: "client-maria" }));
  });

  it("guards backdrop and Escape closing when the appointment has unsaved changes", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderAppointmentDialog();
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    await user.type(within(dialog).getByRole("combobox", { name: "Клиент" }), "Анна");
    fireEvent.click(document.querySelector(".admin-drawer-backdrop")!);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it("warns when the selected time is outside working hours without blocking save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      prefillClient: clients[0],
      siteSettings: { ...siteSettings, workingHours: "12:00-18:00" },
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    fireEvent.change(within(dialog).getByLabelText("Время"), { target: { value: "11:00" } });

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Время находится вне рабочих часов согласно настройкам сайта",
    );
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("warns on a saved non-working day without blocking save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      prefillClient: clients[0],
      prefillDate: "2026-07-19",
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Выбран нерабочий день согласно настройкам сайта. Сохранение разрешено.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("uses the saved timezone for the default appointment date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T01:00:00.000Z"));

    try {
      renderAppointmentDialog({
        prefillDate: undefined,
        siteSettings: { ...siteSettings, timezone: "Pacific/Honolulu" },
      });

      expect(screen.getByRole("dialog", { name: "Новая запись" }).querySelector('input[type="date"]')).toHaveValue(
        "2026-07-13",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the dialog open with a validation error when a required date is cleared", async () => {
    const user = userEvent.setup();
    const { onClose, onSave } = renderAppointmentDialog({
      appointments: [conflictingAppointment],
      prefillClient: clients[0],
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    fireEvent.change(within(dialog).getByLabelText("Дата"), { target: { value: "" } });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Укажите клиента, дату и время.");
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("identifies the conflicting appointment and blocks specialist overrides", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      appointments: [conflictingAppointment],
      prefillClient: clients[0],
      role: "specialist",
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByRole("status")).toHaveTextContent("Запись пересекается с Мария Иванова в 14:30");
    expect(within(dialog).queryByLabelText("Причина ручного пересечения")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Для пересечения записей требуется роль владельца или администратора.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("allows back-to-back appointments and ignores completed appointments for conflicts", () => {
    const { rerender } = render(
      <CalendarAppointmentDialog
        appointments={[conflictingAppointment]}
        bookingBufferMinutes={30}
        clients={clients}
        onClose={vi.fn()}
        onSave={vi.fn(async () => ({ ok: true as const }))}
        prefillClient={clients[0]}
        prefillDate="2026-07-14"
        role="owner"
        siteSettings={siteSettings}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    fireEvent.change(within(dialog).getByLabelText("Время"), { target: { value: "15:30" } });
    expect(within(dialog).queryByText(/Запись пересекается/)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Время"), { target: { value: "15:00" } });
    expect(within(dialog).getByRole("status")).toHaveTextContent("Запись пересекается с Мария Иванова");

    rerender(
      <CalendarAppointmentDialog
        appointments={[{ ...conflictingAppointment, status: "Завершена" }]}
        bookingBufferMinutes={30}
        clients={clients}
        onClose={vi.fn()}
        onSave={vi.fn(async () => ({ ok: true as const }))}
        prefillClient={clients[0]}
        prefillDate="2026-07-14"
        role="owner"
        siteSettings={siteSettings}
      />,
    );

    expect(within(screen.getByRole("dialog", { name: "Новая запись" })).queryByText(/Запись пересекается/)).not.toBeInTheDocument();
  });

  it("requires an owner override reason and keeps post-visit data open after a failed save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ message: "Сервер отклонил запись.", ok: false as const }));
    const { onClose } = renderAppointmentDialog({
      appointments: [conflictingAppointment],
      onSave,
      prefillClient: clients[0],
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Укажите причину ручного пересечения записей.");
    expect(onSave).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Причина ручного пересечения"), "Согласовано владельцем");
    await user.type(within(dialog).getByLabelText("Комментарий после визита"), "Клиент отметил улучшение.");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          overlapOverride: true,
          overlapOverrideReason: "Согласовано владельцем",
          postVisitComment: "Клиент отметил улучшение.",
          postVisitCommentedAt: expect.any(String),
        }),
      ),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Сервер отклонил запись.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Новая запись" })).toBeInTheDocument();
  });

  it("waits for the async save result before closing after success", async () => {
    const user = userEvent.setup();
    let resolveSave: ((result: CalendarAppointmentSaveResult) => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<CalendarAppointmentSaveResult>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const { onClose } = renderAppointmentDialog({ onSave, prefillClient: clients[0] });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => resolveSave?.({ ok: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarAppointmentCancelDialog", () => {
  it("renders the appointment identity and delegates close and confirmation", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn(async () => ({ ok: true as const }));

    render(
      <CalendarAppointmentCancelDialog
        appointment={conflictingAppointment}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Отменить запись" });
    expect(within(dialog).getByText("Мария Иванова")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("на 14 июля");
    await user.click(within(dialog).getByRole("button", { name: "Оставить запись" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole("button", { name: "Подтвердить отмену" }));
    expect(onConfirm).toHaveBeenCalledWith(conflictingAppointment);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });

  it("keeps the cancellation dialog open when persistence fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <CalendarAppointmentCancelDialog
        appointment={conflictingAppointment}
        onClose={onClose}
        onConfirm={vi.fn(async () => ({ message: "Отмена не сохранена.", ok: false as const }))}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Отменить запись" });
    await user.click(within(dialog).getByRole("button", { name: "Подтвердить отмену" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Отмена не сохранена.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
