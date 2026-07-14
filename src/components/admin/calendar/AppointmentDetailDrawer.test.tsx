import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Appointment } from "@/admin/domain";

import { AppointmentDetailDrawer } from "./AppointmentDetailDrawer";

const completedAppointment: Appointment = {
  client: "Анна Петрова",
  date: "2026-07-13",
  durationMinutes: 60,
  id: "appointment-anna",
  note: "Общая заметка записи",
  postVisitComment: "Первичный результат",
  service: "Классический массаж",
  status: "Завершена",
  time: "14:00",
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
});
