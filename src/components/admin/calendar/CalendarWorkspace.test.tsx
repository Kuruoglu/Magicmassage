import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminRoleId } from "@/admin/config";
import type { Appointment, CalendarBlock, ClientRecord } from "@/admin/domain";

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

const timedCalendarBlock: CalendarBlock = {
  blockDate: "2026-07-06",
  endsAt: "13:00",
  id: "calendar-block-timed",
  internalNote: "Личная встреча",
  kind: "personal",
  startsAt: "12:00",
};

const fullDayCalendarBlock: CalendarBlock = {
  blockDate: "2026-07-06",
  endsAt: "23:59",
  id: "calendar-block-full-day",
  internalNote: "Выходной",
  kind: "unavailable",
  startsAt: "00:00",
};

function renderCalendar({
  calendarAppointments = appointments,
  calendarBlocks = [],
  canManageBlocks = true,
  onCreateCalendarBlock = vi.fn(),
  onDeleteCalendarBlock = vi.fn(),
  onEditCalendarBlock = vi.fn(),
  onSaveAppointment = vi.fn(async () => ({ ok: true }) as CalendarAppointmentSaveResult),
  query = "",
  role = "owner",
  scheduleSettings = siteSettings,
}: {
  calendarAppointments?: Appointment[];
  calendarBlocks?: CalendarBlock[];
  canManageBlocks?: boolean;
  onCreateCalendarBlock?: (date: string) => void;
  onDeleteCalendarBlock?: (block: CalendarBlock) => void;
  onEditCalendarBlock?: (block: CalendarBlock) => void;
  onSaveAppointment?: (
    appointment: Appointment,
    action?: Parameters<typeof CalendarWorkspace>[0]["onSaveAppointment"] extends (
      appointment: Appointment,
      action?: infer T,
    ) => unknown
      ? T
      : never,
  ) => Promise<CalendarAppointmentSaveResult>;
  role?: AdminRoleId;
  query?: string;
  scheduleSettings?: typeof siteSettings;
} = {}) {
  render(
    <CalendarWorkspace
      appointments={calendarAppointments}
      bookingBufferMinutes={30}
      calendarBlocks={calendarBlocks}
      canManageBlocks={canManageBlocks}
      clients={clients}
      dailySlotCapacity={4}
      onCancelAppointment={vi.fn()}
      onCreateCalendarBlock={onCreateCalendarBlock}
      onDeleteCalendarBlock={onDeleteCalendarBlock}
      onCalendarDateChange={vi.fn()}
      onEditAppointment={vi.fn()}
      onEditCalendarBlock={onEditCalendarBlock}
      onSaveAppointment={onSaveAppointment}
      query={query}
      role={role}
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
    setDragImage: vi.fn(),
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
        canManageBlocks
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

  it("keeps the grabbed point aligned and previews the exact drop time", async () => {
    const sourceAppointment: Appointment = {
      ...appointments[0],
      durationMinutes: 60,
      time: "09:00",
    };
    const nextAppointment: Appointment = {
      ...appointments[1],
      durationMinutes: 60,
      time: "10:30",
    };
    const { onSaveAppointment } = renderCalendar({
      calendarAppointments: [sourceAppointment, nextAppointment],
      scheduleSettings: { ...siteSettings, workingHours: "08:00-19:00" },
    });
    const sourceBlock = screen
      .getByText(sourceAppointment.client)
      .closest(".admin-timed-appointment") as HTMLElement;
    const timeColumn = screen.getByRole("list");
    const dataTransfer = createDataTransfer();

    vi.spyOn(sourceBlock, "getBoundingClientRect").mockReturnValue({
      bottom: 172,
      height: 72,
      left: 0,
      right: 400,
      top: 100,
      width: 400,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    vi.spyOn(timeColumn, "getBoundingClientRect").mockReturnValue({
      bottom: 1928,
      height: 1728,
      left: 0,
      right: 800,
      top: 200,
      width: 800,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });

    const dragStartEvent = createEvent.dragStart(sourceBlock);
    Object.defineProperties(dragStartEvent, {
      clientY: { value: 136 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(sourceBlock, dragStartEvent);
    const dragOverEvent = createEvent.dragOver(timeColumn);
    Object.defineProperties(dragOverEvent, {
      clientY: { value: 920 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(timeColumn, dragOverEvent);

    const preview = document.querySelector<HTMLElement>(".admin-timed-appointment.is-drag-preview");
    expect(sourceBlock).toHaveClass("is-dragging");
    expect(preview).toHaveTextContent("09:30");
    expect(preview).toHaveTextContent(sourceAppointment.client);
    expect(screen.getByLabelText("Время переноса записи")).toHaveTextContent(
      "Перенос записи Анна Петрова: 6 июля, 09:30",
    );
    expect(dataTransfer.setDragImage).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Изменение пересекается с другой записью" })).not.toBeInTheDocument();

    const dropEvent = createEvent.drop(timeColumn);
    Object.defineProperties(dropEvent, {
      clientY: { value: 920 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(timeColumn, dropEvent);

    await waitFor(() =>
      expect(onSaveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ id: sourceAppointment.id, time: "09:30" }),
        "appointment.drag",
        expect.objectContaining({ id: sourceAppointment.id, time: "09:00" }),
      ),
    );
    expect(sourceBlock).not.toHaveClass("is-dragging");
    expect(document.querySelector(".admin-timed-appointment.is-drag-preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Изменение пересекается с другой записью" })).not.toBeInTheDocument();
  });

  it("does not resize a 23:45 appointment past the end of the day", async () => {
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
    const resizeHandle = within(appointmentBlock).getByRole("slider", {
      name: "Изменить длительность записи",
    });

    expect(appointmentBlock).toHaveStyle({ top: "1710px" });
    fireEvent.keyDown(resizeHandle, { key: "ArrowUp" });
    expect(onSaveAppointment).not.toHaveBeenCalled();
  });

  it("does not shorten an appointment near midnight from a tap on the resize edge", () => {
    const crossingMidnightAppointment = {
      ...appointments[0],
      durationMinutes: 60,
      id: "appointment-crossing-midnight",
      time: "23:30",
    };
    const { onSaveAppointment } = renderCalendar({
      calendarAppointments: [crossingMidnightAppointment],
    });
    const appointmentBlock = screen
      .getByText(crossingMidnightAppointment.client)
      .closest(".admin-timed-appointment") as HTMLElement;
    const resizeHandle = within(appointmentBlock).getByRole("slider", {
      name: "Изменить длительность записи",
    });

    expect(resizeHandle).toHaveAttribute("aria-valuemax", "60");
    fireEvent.pointerDown(resizeHandle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(resizeHandle, { clientY: 100, pointerId: 1 });

    expect(onSaveAppointment).not.toHaveBeenCalled();
    expect(appointmentBlock).toHaveStyle({ height: "72px" });
  });

  it("renders simultaneous appointments in separate deterministic columns", () => {
    const simultaneousAppointments = [
      { ...appointments[1], durationMinutes: 30, id: "overlap-c", time: "10:00" },
      { ...appointments[0], durationMinutes: 60, id: "overlap-a", time: "10:00" },
      { ...appointments[1], client: "Elena Smirnova", durationMinutes: 45, id: "overlap-b", time: "10:00" },
    ];

    renderCalendar({ calendarAppointments: simultaneousAppointments });

    const listItems = Array.from(document.querySelectorAll<HTMLElement>(".admin-timed-appointment"));
    expect(listItems).toHaveLength(3);
    expect(listItems[0]).toHaveTextContent(appointments[0].client);
    expect(listItems[1]).toHaveTextContent("Elena Smirnova");
    expect(listItems[2]).toHaveTextContent(appointments[1].client);
    expect(listItems[0].style.left).toBe("calc(0% + 4px)");
    expect(listItems[0].style.width).toBe("calc(33.3333% - 8px)");
    expect(listItems[1].style.left).toBe("calc(33.3333% + 4px)");
    expect(listItems[2].style.left).toBe("calc(66.6667% + 4px)");
  });

  it.each<AdminRoleId>(["owner", "administrator", "specialist"])(
    "shows calendar-block management controls for %s",
    async (role) => {
      const user = userEvent.setup();
      const onCreateCalendarBlock = vi.fn();
      const onDeleteCalendarBlock = vi.fn();
      const onEditCalendarBlock = vi.fn();
      renderCalendar({
        calendarBlocks: [timedCalendarBlock],
        canManageBlocks: true,
        onCreateCalendarBlock,
        onDeleteCalendarBlock,
        onEditCalendarBlock,
        role,
      });

      await user.click(screen.getByRole("button", { name: "Заблокировать время" }));
      await user.click(screen.getByRole("button", { name: "Изменить" }));
      await user.click(screen.getByRole("button", { name: "Удалить" }));

      expect(onCreateCalendarBlock).toHaveBeenCalledWith("2026-07-06");
      expect(onEditCalendarBlock).toHaveBeenCalledWith(timedCalendarBlock);
      expect(onDeleteCalendarBlock).toHaveBeenCalledWith(timedCalendarBlock);
    },
  );

  it("keeps calendar-block management controls hidden for a read-only viewer", () => {
    renderCalendar({
      calendarBlocks: [timedCalendarBlock],
      canManageBlocks: false,
      role: "viewer",
    });

    expect(screen.queryByRole("button", { name: "Заблокировать время" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Изменить" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Недоступное время")).toHaveTextContent("Личная встреча");
  });

  it("shows full-day closure and timed restrictions accurately in month availability", async () => {
    const user = userEvent.setup();
    renderCalendar({
      calendarBlocks: [
        fullDayCalendarBlock,
        { ...timedCalendarBlock, blockDate: "2026-07-07", id: "calendar-block-next-day" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Месяц" }));

    const fullDayButton = screen.getByRole("button", { name: /^6 июля,/ });
    const timedDayButton = screen.getByRole("button", { name: /^7 июля,/ });
    expect(fullDayButton).toHaveAccessibleName(/Недоступно весь день/);
    expect(fullDayButton).not.toHaveAccessibleName(/свободн/i);
    expect(timedDayButton).toHaveAccessibleName(/Ограничено: 1 блокировка, 4 по дневному лимиту/);
  });

  it("renders timed blocks inside both day and week schedule columns", async () => {
    const user = userEvent.setup();
    renderCalendar({ calendarBlocks: [timedCalendarBlock] });

    const dayBlock = await screen.findByRole("button", { name: /Недоступное время: 12:00 - 13:00/ });
    expect(dayBlock.parentElement).toHaveClass("admin-calendar-time-column");
    expect(dayBlock).toHaveStyle({ height: "70px", top: "864px" });

    await user.click(screen.getByRole("button", { name: "Неделя" }));

    await waitFor(() => {
      const weekBlock = screen.getByRole("button", { name: /Недоступное время: 12:00 - 13:00/ });
      expect(weekBlock.parentElement).toHaveClass("admin-calendar-time-column");
      expect(weekBlock).toHaveStyle({ height: "70px", top: "864px" });
    });
  });

  it("keeps capacity totals based on all appointments while search filters the display", () => {
    renderCalendar({ query: "Анна" });

    expect(screen.getByText("2 свободных слота")).toBeInTheDocument();
    expect(screen.getByText("Анна Петрова")).toBeInTheDocument();
    expect(screen.queryByText("Мария Иванова")).not.toBeInTheDocument();
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

    fireEvent.keyDown(
      within(annaBlock as HTMLElement).getByRole("slider", { name: "Изменить длительность записи" }),
      { key: "ArrowUp" },
    );

    expect(onSaveAppointment).not.toHaveBeenCalled();
    const conflict = screen.getByRole("region", { name: "Изменение пересекается с другой записью" });
    expect(conflict).toHaveClass("admin-calendar-conflict");
    expect(within(conflict).getByRole("alert")).toHaveTextContent("Мария Иванова");
    const reasonField = within(conflict).getByRole("textbox");
    expect(reasonField).toHaveClass("admin-calendar-conflict-reason-input");
    expect(reasonField.closest("label")).toHaveClass("admin-calendar-conflict-reason");
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

  it("detects an overlap with an appointment hidden by search", async () => {
    const { onSaveAppointment } = renderCalendar({ query: "Анна" });
    const annaBlock = screen.getByText("Анна Петрова").closest(".admin-timed-appointment") as HTMLElement;

    expect(screen.queryByText("Мария Иванова")).not.toBeInTheDocument();
    fireEvent.keyDown(
      within(annaBlock).getByRole("slider", { name: "Изменить длительность записи" }),
      { key: "ArrowUp" },
    );

    expect(onSaveAppointment).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Изменение пересекается с другой записью" })).toHaveTextContent(
      "Мария Иванова",
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
    const grip = within(annaBlock).getByRole("slider", {
      name: "Изменить длительность записи",
    });

    expect(grip).toHaveAttribute("aria-valuenow", "60");
    expect(within(annaBlock).queryByRole("button", { name: /длительность на 15 минут/i })).not.toBeInTheDocument();
    const timeGrid = annaBlock.closest(".admin-day-time-grid") as HTMLElement;

    fireEvent.pointerDown(grip, { clientY: 100, pointerId: 1 });
    expect(grip).toHaveFocus();
    expect(timeGrid).toHaveClass("is-resizing");
    expect(document.body).toHaveClass("admin-calendar-resize-active");
    expect(annaBlock).toHaveAttribute("draggable", "false");

    const blockedDragStart = createEvent.dragStart(annaBlock, { dataTransfer: createDataTransfer() });
    fireEvent(annaBlock, blockedDragStart);
    expect(blockedDragStart.defaultPrevented).toBe(true);

    fireEvent.pointerMove(grip, { clientY: 118, pointerId: 1 });
    expect(grip).toHaveAttribute("aria-valuenow", "75");
    expect(grip).toHaveAttribute("aria-valuetext", "75 минут");
    fireEvent.pointerUp(grip, { clientY: 118, pointerId: 1 });

    expect(timeGrid).not.toHaveClass("is-resizing");
    expect(document.body).not.toHaveClass("admin-calendar-resize-active");

    const suppressedDragStart = createEvent.dragStart(annaBlock, { dataTransfer: createDataTransfer() });
    fireEvent(annaBlock, suppressedDragStart);
    expect(suppressedDragStart.defaultPrevented).toBe(true);

    expect(onSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 75, id: "appointment-anna" }),
      "appointment.resize",
      expect.objectContaining({ durationMinutes: 60, id: "appointment-anna" }),
    );
    expect(onSaveAppointment).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Сохраняем изменение записи");
    expect(annaBlock).toHaveAttribute("aria-busy", "true");

    resolveSave?.({ message: "Сервер отклонил изменение.", ok: false });

    expect(await screen.findByRole("alert")).toHaveTextContent("Сервер отклонил изменение.");
    await waitFor(() => expect(annaBlock).not.toHaveAttribute("aria-busy"));
  });

  it("cancels the resize preview when pointer capture is lost", () => {
    const { onSaveAppointment } = renderCalendar({ calendarAppointments: [appointments[0]] });
    const annaBlock = screen.getByText("Анна Петрова").closest(".admin-timed-appointment") as HTMLElement;
    const grip = within(annaBlock).getByRole("slider", {
      name: "Изменить длительность записи",
    });

    fireEvent.pointerDown(grip, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 118, pointerId: 1 });
    expect(annaBlock).toHaveStyle({ height: "90px" });

    fireEvent.lostPointerCapture(grip, { pointerId: 1 });

    expect(annaBlock).toHaveStyle({ height: "72px" });
    expect(onSaveAppointment).not.toHaveBeenCalled();
  });

  it("keeps each appointment pending until its own save completes", async () => {
    const resolvers: Array<(result: CalendarAppointmentSaveResult) => void> = [];
    const onSaveAppointment = vi.fn(
      () =>
        new Promise<CalendarAppointmentSaveResult>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    renderCalendar({ onSaveAppointment });
    const annaBlock = screen.getByText("Анна Петрова").closest(".admin-timed-appointment") as HTMLElement;
    const mariaBlock = screen.getByText("Мария Иванова").closest(".admin-timed-appointment") as HTMLElement;

    fireEvent.keyDown(within(annaBlock).getByRole("slider"), { key: "ArrowDown" });
    fireEvent.keyDown(within(mariaBlock).getByRole("slider"), { key: "ArrowDown" });

    expect(onSaveAppointment).toHaveBeenCalledTimes(2);
    expect(annaBlock).toHaveAttribute("aria-busy", "true");
    expect(mariaBlock).toHaveAttribute("aria-busy", "true");

    resolvers[0]?.({ ok: true });
    await waitFor(() => expect(annaBlock).not.toHaveAttribute("aria-busy"));
    expect(mariaBlock).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Сохраняем изменение записи");

    resolvers[1]?.({ ok: true });
    await waitFor(() => expect(mariaBlock).not.toHaveAttribute("aria-busy"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
