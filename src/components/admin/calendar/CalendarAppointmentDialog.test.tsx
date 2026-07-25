import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Appointment, CalendarBlock, ClientRecord, SpecialistRecord } from "@/admin/domain";

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

const weeklySchedule = Array.from({ length: 7 }, (_, index) => ({
  endsAt: "19:00",
  isWorking: index < 6,
  startsAt: "10:00",
  weekday: index + 1,
}));

const specialists: SpecialistRecord[] = [
  {
    color: "#7c4d9d",
    displayName: "Натали",
    displayOrder: 1,
    id: "specialist-natali",
    publicBookingEnabled: true,
    scheduleVersion: 1,
    status: "active",
    weeklySchedule,
  },
  {
    color: "#2f7d6d",
    displayName: "Яна",
    displayOrder: 2,
    id: "specialist-yana",
    publicBookingEnabled: true,
    scheduleVersion: 1,
    status: "active",
    weeklySchedule,
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
  specialistId: "specialist-natali",
  specialistName: "Натали",
  status: "Подтверждена",
  time: "14:30",
};

const personalCalendarBlock: CalendarBlock = {
  blockDate: "2026-07-14",
  endsAt: "15:30",
  id: "block-lunch",
  internalNote: "Обед",
  kind: "personal",
  specialistId: "specialist-natali",
  specialistName: "Натали",
  startsAt: "15:00",
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
      specialists={specialists}
      {...overrides}
    />,
  );

  return { onClose, onSave };
}

describe("CalendarAppointmentDialog", () => {
  it("keeps the booked service immutable but allows actual duration changes", () => {
    renderAppointmentDialog({
      initialAppointment: {
        ...conflictingAppointment,
        origin: "public",
        publicReference: "MMN-20260714-0001",
      },
    });
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText("Услуга")).toBeDisabled();
    expect(within(dialog).getByLabelText("Длительность, минут")).toBeEnabled();
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Услуга зафиксирована клиентом при онлайн-записи. Фактическую длительность можно изменить",
    );
  });

  it("uses and preserves the public booking email snapshot while editing", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      initialAppointment: {
        ...conflictingAppointment,
        origin: "public",
        publicEmail: "booking-snapshot@example.com",
        publicReference: "MMN-20260714-0001",
      },
    });
    const dialog = screen.getByRole("dialog", { name: "Редактировать запись" });

    expect(within(dialog).getByText("Письмо будет отправлено на booking-snapshot@example.com.")).toBeVisible();
    expect(within(dialog).queryByText(/maria@example\.com/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "public",
        publicEmail: "booking-snapshot@example.com",
        publicReference: "MMN-20260714-0001",
      }),
      { notifyClient: true },
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

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ bufferMinutes: 15 }), { notifyClient: true });
  });

  it("searches existing clients and links the selected identity on save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog();
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    await user.type(within(dialog).getByLabelText("Клиент"), "maria@example");

    const suggestions = within(dialog).getByRole("listbox", { name: "Найденные клиенты" });
    await user.click(within(suggestions).getByRole("option", { name: /Мария Иванова/ }));
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ client: "Мария Иванова", clientId: "client-maria" }),
      { notifyClient: true },
    );
  });

  it("prefills the date, time, duration, and specialist from a selected calendar interval", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      prefillClient: clients[0],
      prefillDate: "2026-07-20",
      prefillDurationMinutes: 75,
      prefillSpecialistId: "specialist-yana",
      prefillTime: "14:15",
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByLabelText("Дата")).toHaveValue("2026-07-20");
    expect(within(dialog).getByLabelText("Время")).toHaveValue("14:15");
    expect(within(dialog).getByLabelText("Длительность, минут")).toHaveValue(75);
    expect(within(dialog).getByLabelText("Специалист")).toHaveValue("specialist-yana");

    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      date: "2026-07-20",
      durationMinutes: 75,
      specialistId: "specialist-yana",
      time: "14:15",
    }), { notifyClient: true });
  });

  it("preserves a normalized 23:59 selection duration when saving", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      prefillClient: clients[0],
      prefillDurationMinutes: 14,
      prefillTime: "23:45",
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByLabelText("Длительность, минут")).toHaveValue(14);
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 14, time: "23:45" }),
      { notifyClient: true },
    );
  });

  it("blocks an appointment that crosses personal time for the same specialist", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      calendarBlocks: [personalCalendarBlock],
      prefillClient: clients[0],
      prefillTime: "14:00",
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Время пересекается с блокировкой 15:00 - 15:30",
    );
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Выбранное время уже заблокировано");
  });

  it("requires a specialist when the interval came from the all-specialists view", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      prefillClient: clients[0],
      requireSpecialistSelection: true,
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByLabelText("Специалист")).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
  });

  it("defaults client email notification on and disables it when no email exists", () => {
    const withoutEmail = { ...clients[0], email: "" };
    const { unmount } = render(
      <CalendarAppointmentDialog
        appointments={[]}
        bookingBufferMinutes={30}
        clients={clients}
        onClose={vi.fn()}
        onSave={vi.fn(async () => ({ ok: true as const }))}
        prefillClient={clients[0]}
        prefillDate="2026-07-14"
        role="owner"
        siteSettings={siteSettings}
        specialists={specialists}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Отправить клиенту подтверждение записи" })).toBeChecked();
    unmount();

    render(
      <CalendarAppointmentDialog
        appointments={[]}
        bookingBufferMinutes={30}
        clients={[withoutEmail]}
        onClose={vi.fn()}
        onSave={vi.fn(async () => ({ ok: true as const }))}
        prefillClient={withoutEmail}
        prefillDate="2026-07-14"
        role="owner"
        siteSettings={siteSettings}
        specialists={specialists}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Отправить клиенту подтверждение записи" })).toBeDisabled();
    expect(screen.getByText(/У выбранного клиента нет email/)).toBeVisible();
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
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ clientId: "client-maria" }), { notifyClient: true });
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
      specialists: specialists.map((specialist) => specialist.id === "specialist-natali"
        ? {
            ...specialist,
            weeklySchedule: specialist.weeklySchedule.map((day) => ({
              ...day,
              endsAt: "18:00",
              startsAt: "12:00",
            })),
          }
        : specialist),
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    fireEvent.change(within(dialog).getByLabelText("Время"), { target: { value: "11:00" } });

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Время находится вне графика специалиста",
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
      "Выбран нерабочий день по графику специалиста. Сохранение разрешено.",
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

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Укажите клиента, специалиста, дату и время.");
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("identifies the conflicting appointment and blocks specialist overrides", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      appointments: [conflictingAppointment],
      prefillClient: clients[0],
      role: "specialist",
      currentSpecialistId: "specialist-natali",
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

  it("lets an owner assign another specialist without creating a cross-specialist conflict", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      appointments: [conflictingAppointment],
      prefillClient: clients[0],
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByRole("status")).toHaveTextContent("Запись пересекается с Мария Иванова");
    await user.selectOptions(within(dialog).getByLabelText("Специалист"), "specialist-yana");
    expect(within(dialog).queryByText(/Запись пересекается/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        specialistId: "specialist-yana",
        specialistName: "Яна",
      }),
      { notifyClient: true },
    );
  });

  it("fixes a specialist to their own calendar", async () => {
    const user = userEvent.setup();
    const { onSave } = renderAppointmentDialog({
      currentSpecialistId: "specialist-yana",
      prefillClient: clients[0],
      role: "specialist",
    });
    const dialog = screen.getByRole("dialog", { name: "Новая запись" });

    expect(within(dialog).getByLabelText("Специалист")).toHaveTextContent("Яна");
    expect(within(dialog).queryByRole("combobox", { name: "Специалист" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        specialistId: "specialist-yana",
        specialistName: "Яна",
      }),
      { notifyClient: false },
    );
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
        specialists={specialists}
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
        specialists={specialists}
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
        { notifyClient: true },
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
    expect(within(dialog).getByRole("button", { name: "Сохранение…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Отмена" })).toBeDisabled();
    expect(within(dialog).getByRole("form", { name: "Форма новой записи" })).toHaveAttribute("aria-busy", "true");

    fireEvent.submit(within(dialog).getByRole("form", { name: "Форма новой записи" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
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
        clientEmail="maria@example.com"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Отменить запись" });
    expect(within(dialog).getByText("Мария Иванова")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("на 14 июля");
    await user.click(within(dialog).getByRole("button", { name: "Оставить запись" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole("button", { name: "Отменить запись" }));
    expect(onConfirm).toHaveBeenCalledWith(conflictingAppointment, { notifyClient: true });
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
    await user.click(within(dialog).getByRole("button", { name: "Отменить запись" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Отмена не сохранена.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables client notification when the appointment has no email", () => {
    render(
      <CalendarAppointmentCancelDialog
        appointment={conflictingAppointment}
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => ({ ok: true as const }))}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Уведомить клиента об отмене" })).toBeDisabled();
    expect(screen.getByText("У клиента нет email. Отмена сохранится без письма.")).toBeVisible();
  });

  it("traps focus above the appointment drawer and restores the trigger", async () => {
    const user = userEvent.setup();

    function NestedCancellationHarness() {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <>
          <section aria-label="Детали записи" aria-modal="true" role="dialog">
            <button onClick={() => setIsOpen(true)} type="button">Открыть отмену</button>
          </section>
          {isOpen ? (
            <CalendarAppointmentCancelDialog
              appointment={conflictingAppointment}
              clientEmail="maria@example.com"
              onClose={() => setIsOpen(false)}
              onConfirm={vi.fn(async () => ({ ok: true as const }))}
            />
          ) : null}
        </>
      );
    }

    render(<NestedCancellationHarness />);
    const trigger = screen.getByRole("button", { name: "Открыть отмену" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Отменить запись" });
    const underlyingDialog = document.querySelector<HTMLElement>('[aria-label="Детали записи"]')!;
    expect(within(dialog).getByRole("heading", { name: "Отменить запись" })).toHaveFocus();
    expect(underlyingDialog).toHaveAttribute("aria-hidden", "true");
    expect(underlyingDialog).toHaveAttribute("inert");

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(within(dialog).getByRole("button", { name: "Оставить запись" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Оставить запись" }));

    expect(trigger).toHaveFocus();
    expect(underlyingDialog).not.toHaveAttribute("aria-hidden");
    expect(underlyingDialog).not.toHaveAttribute("inert");
  });
});
