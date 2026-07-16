import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
    expect(within(dialog).queryByRole("button", { name: "Отменить" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Комментарий после визита")).not.toBeInTheDocument();
  });
});
