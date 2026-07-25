import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Appointment, ClientRecord } from "@/admin/domain";

import { AppointmentDetailDrawer } from "./AppointmentDetailDrawer";

const completedAppointment: Appointment = {
  client: "Анна Петрова",
  date: "2026-07-13",
  durationMinutes: 60,
  id: "appointment-anna",
  note: "Общая заметка записи",
  postVisitComment: "Первичный результат",
  service: "Классический массаж",
  specialistId: "specialist-natali",
  specialistName: "Натали",
  status: "Завершена",
  time: "14:00",
};

const restrictedClient: ClientRecord = {
  contactRestricted: true,
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
};

function renderDrawer(overrides: Partial<Parameters<typeof AppointmentDetailDrawer>[0]> = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onSaveAppointment =
    overrides.onSaveAppointment ?? vi.fn(async () => ({ ok: true as const }));

  render(
    <AppointmentDetailDrawer
      appointment={completedAppointment}
      onCancelAppointment={vi.fn()}
      onClose={onClose}
      onEditAppointment={vi.fn()}
      onSaveAppointment={onSaveAppointment}
      role="owner"
      {...overrides}
    />,
  );

  return { onClose, onSaveAppointment };
}

describe("AppointmentDetailDrawer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves a visit-specific comment without replacing the appointment note", async () => {
    const user = userEvent.setup();
    const { onSaveAppointment } = renderDrawer();
    const dialog = screen.getByRole("dialog", { name: "Детали выбранной записи" });
    const comment = within(dialog).getByLabelText("Комментарий после визита");

    await user.clear(comment);
    await user.type(comment, "Клиент отметил улучшение.");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить комментарий" }));

    await waitFor(() =>
      expect(onSaveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          note: "Общая заметка записи",
          postVisitComment: "Клиент отметил улучшение.",
        }),
        "appointment.post_visit_comment",
      ),
    );
    expect(within(dialog).getByRole("status")).toHaveTextContent("Комментарий сохранен");
  });

  it("guards backdrop closing while the comment is unsaved", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderDrawer();

    await user.type(screen.getByLabelText("Комментарий после визита"), " Дополнение");
    fireEvent.click(document.querySelector(".admin-drawer-backdrop")!);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("does not expose the editor for a future appointment", () => {
    renderDrawer({
      appointment: {
        ...completedAppointment,
        date: "2099-07-13",
        status: "Подтверждена",
      },
    });

    expect(screen.queryByLabelText("Комментарий после визита")).not.toBeInTheDocument();
    expect(screen.getByText(/станет доступен после завершения/)).toBeInTheDocument();
  });

  it("never renders contact or appointment mutation controls for a specialist", () => {
    renderDrawer({
      appointment: {
        ...completedAppointment,
        clientId: restrictedClient.id,
        publicEmail: restrictedClient.email,
        publicPhone: restrictedClient.phone,
      },
      appointmentClient: restrictedClient,
      role: "specialist",
    });
    const dialog = screen.getByRole("dialog", { name: "Детали выбранной записи" });

    expect(within(dialog).queryByText(restrictedClient.phone)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(restrictedClient.email)).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Телефон клиента")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Email клиента")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Показать контакты" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Открыть клиента" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Все сертификаты клиента")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Редактировать" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Отменить запись" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Удалить запись" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Комментарий после визита")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Email-уведомления")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("form", { name: /Исправление email/ })).not.toBeInTheDocument();
  });

  it("separates cancellation from permanent deletion for an owner", async () => {
    const user = userEvent.setup();
    const onCancelAppointment = vi.fn();
    const onDeleteAppointment = vi.fn();
    renderDrawer({ onCancelAppointment, onDeleteAppointment });
    const dialog = screen.getByRole("dialog", { name: "Детали выбранной записи" });

    await user.click(within(dialog).getByRole("button", { name: "Отменить запись" }));
    expect(onCancelAppointment).toHaveBeenCalledWith(completedAppointment);

    expect(within(dialog).getByRole("heading", { name: "Опасная зона" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Удалить запись" }));
    expect(onDeleteAppointment).toHaveBeenCalledWith(completedAppointment);
  });

  it("shows the public booking snapshot before the CRM profile contact", () => {
    renderDrawer({
      appointment: {
        ...completedAppointment,
        id: undefined,
        origin: "public",
        publicEmail: "snapshot@example.com",
        publicPhone: "+359899000111",
      },
      appointmentClient: {
        ...restrictedClient,
        email: "profile@example.com",
        phone: "+359899000222",
      },
    });
    const dialog = screen.getByRole("dialog", { name: "Детали выбранной записи" });

    expect(within(dialog).getByText("Email online-записи")).toBeVisible();
    expect(within(dialog).getByText("snapshot@example.com")).toBeVisible();
    expect(within(dialog).getByText("+359899000111")).toBeVisible();
    expect(within(dialog).queryByText("profile@example.com")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("+359899000222")).not.toBeInTheDocument();
  });

  it("does not relabel the CRM profile email as an online-booking snapshot when the snapshot is empty", () => {
    renderDrawer({
      appointment: {
        ...completedAppointment,
        id: undefined,
        origin: "public",
        publicEmail: "",
      },
      appointmentClient: {
        ...restrictedClient,
        email: "profile@example.com",
      },
    });
    const dialog = screen.getByRole("dialog", { name: "Детали выбранной записи" });

    expect(within(dialog).queryByText("Email online-записи")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("profile@example.com")).not.toBeInTheDocument();
  });

  it("shows the CRM profile contact first for an admin-origin appointment", () => {
    renderDrawer({
      appointment: {
        ...completedAppointment,
        id: undefined,
        origin: "admin",
        publicEmail: "stale-snapshot@example.com",
        publicPhone: "+359899000111",
      },
      appointmentClient: {
        ...restrictedClient,
        email: "profile@example.com",
        phone: "+359899000222",
      },
      role: "administrator",
    });
    const dialog = screen.getByRole("dialog", { name: "Детали выбранной записи" });

    expect(within(dialog).getByText("Email клиента")).toBeVisible();
    expect(within(dialog).getByText("profile@example.com")).toBeVisible();
    expect(within(dialog).getByText("+359899000222")).toBeVisible();
    expect(within(dialog).queryByText("stale-snapshot@example.com")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("+359899000111")).not.toBeInTheDocument();
  });

  it.each(["owner", "administrator"] as const)(
    "lets an %s correct a suppressed public appointment email and updates the data owner",
    async (role) => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          notifications: [{
            canClearSuppression: true,
            canRetry: false,
            eventType: "booking_confirmed",
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            recipientMasked: "w***@example.com",
            status: "suppressed",
            updatedAt: "2026-07-19T10:00:00.000Z",
          }],
        }), { headers: { "Content-Type": "application/json" }, status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [] }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }));
      vi.stubGlobal("fetch", fetchMock);
      const onPublicEmailCorrected = vi.fn();
      const user = userEvent.setup();

      renderDrawer({
        appointment: {
          ...completedAppointment,
          origin: "public",
          publicEmail: "wrong@example.com",
        },
        onPublicEmailCorrected,
        role,
      });

      const field = await screen.findByLabelText("Новый email для online-записи");
      await user.type(field, "corrected@example.com");
      await user.click(screen.getByRole("button", { name: "Сохранить адрес и отправить снова" }));

      await waitFor(() => expect(onPublicEmailCorrected).toHaveBeenCalledWith(
        "appointment-anna",
        "corrected@example.com",
      ));
      expect(screen.getByText("corrected@example.com")).toBeVisible();
    },
  );
});
