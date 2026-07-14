import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Appointment, ClientRecord } from "@/admin/domain";

import { CalendarWorkspace, type CalendarAppointmentSaveResult } from "./CalendarWorkspace";

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
    language: "ru",
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

const appointments: Appointment[] = [
  {
    client: "Анна Петрова",
    clientId: "client-anna",
    date: "2026-07-06",
    durationMinutes: 60,
    id: "appointment-anna",
    note: "",
    service: "Классический массаж",
    status: "Подтверждена",
    time: "10:00",
  },
  {
    client: "Мария Иванова",
    clientId: "client-maria",
    date: "2026-07-06",
    durationMinutes: 60,
    id: "appointment-maria",
    note: "",
    service: "Лимфодренажный массаж",
    status: "Подтверждена",
    time: "11:00",
  },
];

const siteSettings = {
  timezone: "Europe/Sofia",
  workingDays: "Пн-Сб",
  workingHours: "10:00-19:00",
};

function renderCalendar({
  calendarAppointments = appointments,
  onSaveAppointment = vi.fn(async () => ({ ok: true }) as CalendarAppointmentSaveResult),
  scheduleSettings = siteSettings,
}: {
  calendarAppointments?: Appointment[];
  onSaveAppointment?: (
    appointment: Appointment,
    action?: Parameters<typeof CalendarWorkspace>[0]["onSaveAppointment"] extends (
      appointment: Appointment,
      action?: infer T,
    ) => unknown
      ? T
      : never,
  ) => Promise<CalendarAppointmentSaveResult>;
  scheduleSettings?: typeof siteSettings;
} = {}) {
  render(
    <CalendarWorkspace
      appointments={calendarAppointments}
      bookingBufferMinutes={30}
      clients={clients}
      dailySlotCapacity={4}
      onCancelAppointment={vi.fn()}
      onCalendarDateChange={vi.fn()}
      onEditAppointment={vi.fn()}
      onSaveAppointment={onSaveAppointment}
      query=""
      role="owner"
      selectedCalendarDate="2026-07-06"
      siteSettings={scheduleSettings}
    />,
  );

  return { onSaveAppointment };
}

function createDataTransfer() {
  const data = new Map<string, string>();

  return {
    effectAllowed: "all",
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
  } as unknown as DataTransfer;
}

describe("CalendarWorkspace", () => {
  it("jumps to an exact date from the toolbar date picker", async () => {
    renderCalendar({ calendarAppointments: [] });

    fireEvent.change(screen.getByLabelText("Выбрать дату"), { target: { value: "2026-07-12" } });

    expect(screen.getByRole("heading", { name: "12 июля" })).toBeVisible();
  });

  it("renders a scrollable full-day grid with visible 30-minute rails", () => {
    const { container } = render(
      <CalendarWorkspace
        appointments={[appointments[0]]}
        bookingBufferMinutes={30}
        clients={clients}
        dailySlotCapacity={4}
        onCancelAppointment={vi.fn()}
        onCalendarDateChange={vi.fn()}
        onEditAppointment={vi.fn()}
        onSaveAppointment={vi.fn(async () => ({ ok: true as const }))}
        query=""
        role="owner"
        selectedCalendarDate="2026-07-06"
        siteSettings={siteSettings}
      />,
    );

    const grid = container.querySelector(".admin-day-time-grid");
    expect(grid).toHaveStyle({ maxHeight: "min(70vh, 860px)" });
    expect(within(grid as HTMLElement).getByText("00:00")).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText("00:30")).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText("23:30")).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText("24:00")).toBeInTheDocument();
  });

  it("clamps a late drop by the appointment duration", async () => {
    const { onSaveAppointment } = renderCalendar({ calendarAppointments: [appointments[0]] });
    const appointmentBlock = screen.getByText(appointments[0].client).closest(".admin-timed-appointment") as HTMLElement;
    const timeColumn = screen.getByRole("list");
    const dataTransfer = createDataTransfer();

    vi.spyOn(timeColumn, "getBoundingClientRect").mockReturnValue({
      bottom: 1728,
      height: 1728,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.dragStart(appointmentBlock, { dataTransfer });
    const dropEvent = createEvent.drop(timeColumn);
    Object.defineProperties(dropEvent, {
      clientY: { value: 1720 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(timeColumn, dropEvent);

    await waitFor(() =>
      expect(onSaveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ id: "appointment-anna", time: "23:00" }),
        "appointment.drag",
        expect.objectContaining({ id: "appointment-anna", time: "10:00" }),
      ),
    );
  });

  it("does not resize a 23:45 appointment past the end of the day", async () => {
    const user = userEvent.setup();
    const lateAppointment = {
      ...appointments[0],
      durationMinutes: 15,
      id: "appointment-end-of-day",
      time: "23:45",
    };
    const { onSaveAppointment } = renderCalendar({ calendarAppointments: [lateAppointment] });
    const appointmentBlock = screen
      .getByText(lateAppointment.client)
      .closest(".admin-timed-appointment") as HTMLElement;
    const increaseDurationButton = appointmentBlock.querySelector(
      ".admin-timed-appointment-resize button:last-child",
    ) as HTMLButtonElement;

    expect(appointmentBlock).toHaveStyle({ top: "1710px" });
    await user.click(increaseDurationButton);
    expect(onSaveAppointment).not.toHaveBeenCalled();
  });

  it("renders simultaneous appointments in separate deterministic columns", () => {
    const simultaneousAppointments = [
      { ...appointments[1], durationMinutes: 30, id: "overlap-c", time: "10:00" },
      { ...appointments[0], durationMinutes: 60, id: "overlap-a", time: "10:00" },
      { ...appointments[1], client: "Elena Smirnova", durationMinutes: 45, id: "overlap-b", time: "10:00" },
    ];

    renderCalendar({ calendarAppointments: simultaneousAppointments });

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);
    expect(listItems[0]).toHaveTextContent(appointments[0].client);
    expect(listItems[1]).toHaveTextContent("Elena Smirnova");
    expect(listItems[2]).toHaveTextContent(appointments[1].client);
    expect(listItems[0].style.left).toBe("calc(0% + 4px)");
    expect(listItems[0].style.width).toBe("calc(33.3333% - 8px)");
    expect(listItems[1].style.left).toBe("calc(33.3333% + 4px)");
    expect(listItems[2].style.left).toBe("calc(66.6667% + 4px)");
  });

  it("marks appointments outside the saved site working hours", () => {
    renderCalendar({
      calendarAppointments: [appointments[0]],
      scheduleSettings: { ...siteSettings, workingHours: "12:00-18:00" },
    });

    const appointmentBlock = screen.getByText(appointments[0].client).closest(".admin-timed-appointment");
    expect(appointmentBlock).toHaveClass("is-outside-hours");
    expect(appointmentBlock).toHaveTextContent("Вне рабочих часов");
  });

  it("marks appointments on a saved non-working day", () => {
    renderCalendar({
      calendarAppointments: [appointments[0]],
      scheduleSettings: { ...siteSettings, workingDays: "Вт-Сб" },
    });

    expect(screen.getByText(appointments[0].client).closest(".admin-timed-appointment")).toHaveClass(
      "is-outside-hours",
    );
  });

  it("requires an explicit authorized override before saving an overlapping resize", async () => {
    const user = userEvent.setup();
    const { onSaveAppointment } = renderCalendar();
    const annaBlock = screen.getByText("Анна Петрова").closest(".admin-timed-appointment");

    await user.click(within(annaBlock as HTMLElement).getByRole("button", { name: "Увеличить длительность на 15 минут" }));

    expect(onSaveAppointment).not.toHaveBeenCalled();
    const conflict = screen.getByRole("alert");
    expect(conflict).toHaveTextContent("Мария Иванова");
    await user.type(within(conflict).getByLabelText("Причина ручного пересечения"), "Согласовано владельцем");
    await user.click(within(conflict).getByRole("button", { name: "Сохранить с пересечением" }));

    await waitFor(() =>
      expect(onSaveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMinutes: 75,
          id: "appointment-anna",
          overlapOverride: true,
          overlapOverrideReason: "Согласовано владельцем",
        }),
        "appointment.resize",
        expect.objectContaining({ durationMinutes: 60, id: "appointment-anna" }),
      ),
    );
  });

  it("supports pointer resize snapping and exposes pending failure state", async () => {
    let resolveSave: ((result: CalendarAppointmentSaveResult) => void) | undefined;
    const onSaveAppointment = vi.fn(
      () =>
        new Promise<CalendarAppointmentSaveResult>((resolve) => {
          resolveSave = resolve;
        }),
    );
    renderCalendar({ calendarAppointments: [appointments[0]], onSaveAppointment });
    const annaBlock = screen.getByText("Анна Петрова").closest(".admin-timed-appointment") as HTMLElement;
    const grip = within(annaBlock).getByRole("button", {
      name: "Изменить длительность перетаскиванием вверх или вниз",
    });

    fireEvent.pointerDown(grip, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 118, pointerId: 1 });
    fireEvent.pointerUp(grip, { clientY: 118, pointerId: 1 });

    expect(onSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 75, id: "appointment-anna" }),
      "appointment.resize",
      expect.objectContaining({ durationMinutes: 60, id: "appointment-anna" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Сохраняем изменение записи");
    expect(annaBlock).toHaveAttribute("aria-busy", "true");

    resolveSave?.({ message: "Сервер отклонил изменение.", ok: false });

    expect(await screen.findByRole("alert")).toHaveTextContent("Сервер отклонил изменение.");
    await waitFor(() => expect(annaBlock).not.toHaveAttribute("aria-busy"));
  });
});
