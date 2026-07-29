import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminRoleId } from "@/admin/config";
import type { Appointment, CalendarBlock, ClientRecord, SpecialistRecord } from "@/admin/domain";

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

const appointments: Appointment[] = [
  {
    client: "Анна Петрова",
    clientId: "client-anna",
    date: "2026-07-06",
    durationMinutes: 60,
    id: "appointment-anna",
    note: "",
    service: "Классический массаж",
    specialistId: "specialist-natali",
    specialistName: "Натали",
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
    specialistId: "specialist-natali",
    specialistName: "Натали",
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
  specialistId: "specialist-natali",
  specialistName: "Натали",
  startsAt: "12:00",
};

const fullDayCalendarBlock: CalendarBlock = {
  blockDate: "2026-07-06",
  endsAt: "23:59",
  id: "calendar-block-full-day",
  internalNote: "Выходной",
  kind: "unavailable",
  specialistId: "specialist-natali",
  specialistName: "Натали",
  startsAt: "00:00",
};

function renderCalendar({
  calendarAppointments = appointments,
  calendarBlocks = [],
  canManageBlocks = true,
  onCreateCalendarBlock = vi.fn(),
  onDeleteCalendarBlock = vi.fn(),
  onEditCalendarBlock = vi.fn(),
  onCreateWalkIn = vi.fn(),
  onSaveAppointment = vi.fn(async () => ({ ok: true }) as CalendarAppointmentSaveResult),
  onSaveSpecialistSchedule,
  onSelectTimeRange = vi.fn(),
  query = "",
  role = "owner",
  scheduleSettings = siteSettings,
  specialistRecords = [specialists[0]],
  currentSpecialistId,
}: {
  calendarAppointments?: Appointment[];
  calendarBlocks?: CalendarBlock[];
  canManageBlocks?: boolean;
  onCreateCalendarBlock?: (date: string) => void;
  onDeleteCalendarBlock?: (block: CalendarBlock) => void;
  onEditCalendarBlock?: (block: CalendarBlock) => void;
  onCreateWalkIn?: () => void;
  onSaveAppointment?: Parameters<typeof CalendarWorkspace>[0]["onSaveAppointment"];
  onSaveSpecialistSchedule?: Parameters<typeof CalendarWorkspace>[0]["onSaveSpecialistSchedule"];
  onSelectTimeRange?: Parameters<typeof CalendarWorkspace>[0]["onSelectTimeRange"];
  role?: AdminRoleId;
  query?: string;
  scheduleSettings?: typeof siteSettings;
  specialistRecords?: SpecialistRecord[];
  currentSpecialistId?: string;
} = {}) {
  const view = render(
    <CalendarWorkspace
      appointments={calendarAppointments}
      bookingBufferMinutes={30}
      calendarBlocks={calendarBlocks}
      canManageBlocks={canManageBlocks}
      clients={clients}
      currentSpecialistId={currentSpecialistId}
      dailySlotCapacity={4}
      onCancelAppointment={vi.fn()}
      onCreateCalendarBlock={onCreateCalendarBlock}
      onCreateWalkIn={onCreateWalkIn}
      onDeleteCalendarBlock={onDeleteCalendarBlock}
      onCalendarDateChange={vi.fn()}
      onEditAppointment={vi.fn()}
      onEditCalendarBlock={onEditCalendarBlock}
      onSaveAppointment={onSaveAppointment}
      onSaveSpecialistSchedule={onSaveSpecialistSchedule}
      onSelectTimeRange={onSelectTimeRange}
      query={query}
      role={role}
      selectedCalendarDate="2026-07-06"
      siteSettings={scheduleSettings}
      specialists={specialistRecords}
    />,
  );

  return { ...view, onSaveAppointment, onSelectTimeRange };
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

async function confirmCalendarChange({ notifyClient = true } = {}) {
  const user = userEvent.setup();
  const change = screen.getByRole("region", { name: /(?:Подтвердите изменение|Изменение пересекается)/ });
  const notify = within(change).getByRole("checkbox", {
    name: "Уведомить клиента об изменении",
  }) as HTMLInputElement;

  if (!notifyClient && notify.checked) await user.click(notify);
  await user.click(within(change).getByRole("button", { name: /^Сохранить/ }));
}

describe("CalendarWorkspace", () => {
  it("renders the day calendar without instruction and summary blocks", () => {
    renderCalendar();

    expect(screen.queryByText(/На телефоне коснитесь свободного времени/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Сводка дня/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Расписание 6 июля")).toBeInTheDocument();
  });

  it("lets an owner filter the calendar by specialist", async () => {
    const user = userEvent.setup();
    const yanaAppointment: Appointment = {
      ...appointments[1],
      id: "appointment-yana",
      specialistId: "specialist-yana",
      specialistName: "Яна",
    };
    renderCalendar({
      calendarAppointments: [appointments[0], yanaAppointment],
      specialistRecords: specialists,
    });

    expect(screen.getByLabelText("Показать календарь специалиста")).toHaveClass(
      "admin-calendar-control",
      "admin-calendar-specialist-select",
    );
    expect(screen.getByText("Анна Петрова")).toBeVisible();
    expect(screen.getByText("Мария Иванова")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Показать календарь специалиста"), "specialist-yana");

    expect(screen.queryByText("Анна Петрова")).not.toBeInTheDocument();
    expect(screen.getByText("Мария Иванова")).toBeVisible();
    expect(screen.getAllByText("Яна")).toHaveLength(2);
  });

  it("opens an administrator on their linked specialist calendar and still allows all calendars", async () => {
    const user = userEvent.setup();
    const yanaAppointment: Appointment = {
      ...appointments[1],
      id: "appointment-yana",
      specialistId: "specialist-yana",
      specialistName: "Яна",
    };
    renderCalendar({
      calendarAppointments: [appointments[0], yanaAppointment],
      currentSpecialistId: "specialist-natali",
      role: "administrator",
      specialistRecords: specialists,
    });

    const specialistFilter = screen.getByLabelText("Показать календарь специалиста");
    expect(specialistFilter).toHaveValue("specialist-natali");
    expect(screen.getByText(clients[0].name)).toBeVisible();
    expect(screen.queryByText(clients[1].name)).not.toBeInTheDocument();

    await user.selectOptions(specialistFilter, "all");

    expect(specialistFilter).toHaveValue("all");
    expect(screen.getByText(clients[0].name)).toBeVisible();
    expect(screen.getByText(clients[1].name)).toBeVisible();
  });

  it("fixes a specialist to their own calendar", () => {
    const yanaAppointment: Appointment = {
      ...appointments[1],
      id: "appointment-yana",
      specialistId: "specialist-yana",
      specialistName: "Яна",
    };
    renderCalendar({
      calendarAppointments: [appointments[0], yanaAppointment],
      currentSpecialistId: "specialist-yana",
      role: "specialist",
      specialistRecords: specialists,
    });

    expect(screen.getByLabelText("Текущий календарь специалиста")).toHaveTextContent("Мой календарьЯна");
    expect(screen.queryByLabelText("Показать календарь специалиста")).not.toBeInTheDocument();
    expect(screen.queryByText("Анна Петрова")).not.toBeInTheDocument();
    expect(screen.getByText("Мария Иванова")).toBeVisible();
  });

  it("does not fall back to another active calendar when a specialist link is inactive", () => {
    renderCalendar({
      calendarAppointments: [appointments[0]],
      currentSpecialistId: "specialist-inactive",
      role: "specialist",
      specialistRecords: specialists,
    });

    expect(screen.getByLabelText("Текущий календарь специалиста")).toHaveTextContent(
      "Мой календарьНазначенный специалист",
    );
    expect(screen.queryByText(clients[0].name)).not.toBeInTheDocument();
  });

  it("keeps appointments read-only while exposing the contact-free current-client action", async () => {
    const user = userEvent.setup();
    const onCreateWalkIn = vi.fn();
    renderCalendar({
      calendarAppointments: [appointments[0]],
      canManageBlocks: false,
      currentSpecialistId: "specialist-natali",
      onCreateWalkIn,
      role: "specialist",
      specialistRecords: specialists,
    });

    const block = screen.getByText("Анна Петрова").closest(".admin-timed-appointment") as HTMLElement;
    expect(block).toHaveAttribute("draggable", "false");
    expect(block.querySelector(".admin-timed-appointment-resize")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Заблокировать время" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Клиент сейчас" }));
    expect(onCreateWalkIn).toHaveBeenCalledTimes(1);
  });

  it("jumps to an exact date from the toolbar date picker", async () => {
    renderCalendar({ calendarAppointments: [] });

    expect(screen.getByLabelText("Выбрать дату")).toHaveClass("admin-calendar-control", "admin-calendar-date-input");
    fireEvent.change(screen.getByLabelText("Выбрать дату"), { target: { value: "2026-07-12" } });

    expect(screen.getByRole("heading", { name: "12 июля" })).toBeVisible();
  });

  it("opens on today's Europe/Sofia date when no date was requested", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T22:30:00.000Z"));

    try {
      const { unmount } = render(
        <CalendarWorkspace
          appointments={appointments}
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
          siteSettings={siteSettings}
        />,
      );

      expect(screen.getByLabelText("Выбрать дату")).toHaveValue("2026-07-19");
      expect(screen.getByRole("heading", { name: "19 июля" })).toBeVisible();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides cancelled appointments from calendar grids but keeps them in the list history", async () => {
    const user = userEvent.setup();
    const cancelledAppointment: Appointment = {
      ...appointments[0],
      status: "Отменена",
    };
    renderCalendar({ calendarAppointments: [cancelledAppointment] });

    expect(screen.queryByRole("button", { name: /Анна Петрова/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Неделя" }));
    expect(screen.queryByRole("button", { name: /Анна Петрова/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByRole("button", { name: /^6 июля, 0 записей/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Список" }));
    const listItem = screen.getByRole("button", { name: /Анна Петрова/ });
    expect(within(listItem).getByText("Отменена")).toBeInTheDocument();
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

  it("forwards a selected grid interval with the active specialist", () => {
    const onSelectTimeRange = vi.fn();
    const { container } = renderCalendar({ onSelectTimeRange, specialistRecords: specialists });
    const specialistSelect = container.querySelector("select.admin-calendar-specialist-select") as HTMLSelectElement;
    fireEvent.change(specialistSelect, { target: { value: "specialist-natali" } });

    const timeColumn = container.querySelector(".admin-calendar-time-column") as HTMLElement;
    vi.spyOn(timeColumn, "getBoundingClientRect").mockReturnValue({
      bottom: 1728,
      height: 1728,
      left: 0,
      right: 300,
      toJSON: () => ({}),
      top: 0,
      width: 300,
      x: 0,
      y: 0,
    });
    fireEvent.pointerDown(timeColumn, { button: 0, clientY: 1008, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(timeColumn, { button: 0, clientY: 1080, pointerId: 1, pointerType: "mouse" });

    expect(onSelectTimeRange).toHaveBeenCalledWith({
      date: "2026-07-06",
      durationMinutes: 60,
      endsAt: "15:00",
      specialistId: "specialist-natali",
      startsAt: "14:00",
    });
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

    await confirmCalendarChange();

    await waitFor(() =>
      expect(onSaveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ id: "appointment-anna", time: "23:00" }),
        "appointment.drag",
        expect.objectContaining({ id: "appointment-anna", time: "10:00" }),
        { notifyClient: true },
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

    await confirmCalendarChange({ notifyClient: false });

    await waitFor(() =>
      expect(onSaveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ id: sourceAppointment.id, time: "09:30" }),
        "appointment.drag",
        expect.objectContaining({ id: sourceAppointment.id, time: "09:00" }),
        { notifyClient: false },
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

  it.each<AdminRoleId>(["owner", "administrator"])(
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

  it("keeps capacity totals based on all appointments while search filters the display", async () => {
    const user = userEvent.setup();
    renderCalendar({ query: "Анна" });

    expect(screen.getByText("Анна Петрова")).toBeInTheDocument();
    expect(screen.queryByText("Мария Иванова")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByRole("button", { name: /^6 июля, 1 запись, 2 свободных слота$/ })).toBeInTheDocument();
  });

  it("finds an appointment by the linked client's phone", () => {
    renderCalendar({ query: "+359881112233" });

    expect(screen.getByText(clients[0].name)).toBeInTheDocument();
    expect(screen.queryByText(clients[1].name)).not.toBeInTheDocument();
  });

  it("counts only specialists who work on the selected day in month capacity", async () => {
    const user = userEvent.setup();
    renderCalendar({
      calendarAppointments: [],
      specialistRecords: [
        specialists[0],
        {
          ...specialists[1],
          weeklySchedule: weeklySchedule.map((day) => (
            day.weekday === 1 ? { ...day, isWorking: false } : day
          )),
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByRole("button", { name: /^6 июля, 0 записей, 4 свободных слота$/ })).toBeInTheDocument();
  });

  it("keeps another working specialist available when one calendar is blocked all day", async () => {
    const user = userEvent.setup();
    renderCalendar({
      calendarAppointments: [],
      calendarBlocks: [fullDayCalendarBlock],
      specialistRecords: specialists,
    });

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByRole("button", {
      name: /^6 июля, 0 записей, Ограничено: 1 блокировка, 4 по дневному лимиту, блокировок: 1$/,
    })).toBeInTheDocument();
  });

  it("does not let public-disabled appointments consume or close another specialist capacity", async () => {
    const user = userEvent.setup();
    renderCalendar({
      calendarAppointments: Array.from({ length: 5 }, (_, index) => ({
          ...appointments[0],
          client: `Клиент Яны ${index + 1}`,
          id: `appointment-yana-disabled-${index + 1}`,
          specialistId: specialists[1].id,
          specialistName: specialists[1].displayName,
          time: `${String(10 + index).padStart(2, "0")}:00`,
        })),
      specialistRecords: [
        specialists[0],
        { ...specialists[1], publicBookingEnabled: false },
      ],
    });

    expect(screen.queryByText(/Онлайн-запись на этот день закрыта/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByRole("button", { name: /6 июля, 5 записей, 4 свободных слота/ })).toBeInTheDocument();
  });

  it("uses the compatibility schedule only when no specialist records exist", async () => {
    const user = userEvent.setup();
    renderCalendar({ calendarAppointments: [], specialistRecords: [] });

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByRole("button", { name: /^6 июля, 0 записей, 4 свободных слота$/ })).toBeInTheDocument();
  });

  it("applies daily limits per specialist before aggregating all-specialist availability", async () => {
    const user = userEvent.setup();
    renderCalendar({
      calendarAppointments: Array.from({ length: 5 }, (_, index) => ({
        ...appointments[0],
        client: `Ручная запись ${index + 1}`,
        id: `appointment-natali-overflow-${index + 1}`,
        time: `${String(10 + index).padStart(2, "0")}:00`,
      })),
      specialistRecords: specialists,
    });

    expect(screen.getByRole("status")).toHaveTextContent("1 запись добавлена вручную");
    expect(screen.getByRole("status")).toHaveTextContent("Онлайн доступно: 4 свободных слота");

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByRole("button", {
      name: /6 июля, 5 записей, 4 свободных слота; \+1 вручную/,
    })).toBeInTheDocument();
  });

  it("marks appointments outside the assigned specialist working hours", () => {
    renderCalendar({
      calendarAppointments: [appointments[0]],
      specialistRecords: [{
        ...specialists[0],
        weeklySchedule: weeklySchedule.map((day) => ({
          ...day,
          startsAt: "12:00",
        })),
      }],
    });

    const appointmentBlock = screen.getByText(appointments[0].client).closest(".admin-timed-appointment");
    expect(appointmentBlock).toHaveClass("is-outside-hours");
    expect(appointmentBlock).toHaveTextContent("Вне рабочих часов");
  });

  it("marks appointments on a specialist non-working day", () => {
    renderCalendar({
      calendarAppointments: [appointments[0]],
      specialistRecords: [{
        ...specialists[0],
        weeklySchedule: weeklySchedule.map((day) => (
          day.weekday === 1 ? { ...day, isWorking: false } : day
        )),
      }],
    });

    expect(screen.getByText(appointments[0].client).closest(".admin-timed-appointment")).toHaveClass(
      "is-outside-hours",
    );
  });

  it("lets an owner edit the selected specialist schedule from the calendar", async () => {
    const user = userEvent.setup();
    const onSaveSpecialistSchedule = vi.fn().mockResolvedValue({ ok: true });
    renderCalendar({
      onSaveSpecialistSchedule,
      specialistRecords: specialists,
    });

    await user.selectOptions(
      screen.getByLabelText("Показать календарь специалиста"),
      "specialist-natali",
    );
    expect(screen.getByText("На выбранную дату: 10:00 - 19:00")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "График работы" }));
    fireEvent.change(screen.getByLabelText("Начало: Понедельник"), {
      target: { value: "09:30" },
    });
    await user.click(screen.getByRole("button", { name: "Сохранить график" }));

    await waitFor(() => expect(onSaveSpecialistSchedule).toHaveBeenCalledWith(
      "specialist-natali",
      expect.arrayContaining([
        expect.objectContaining({ startsAt: "09:30", weekday: 1 }),
      ]),
    ));
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
        { notifyClient: true },
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

    await confirmCalendarChange();

    expect(onSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 75, id: "appointment-anna" }),
      "appointment.resize",
      expect.objectContaining({ durationMinutes: 60, id: "appointment-anna" }),
      { notifyClient: true },
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

  it("uses the immutable public email snapshot for change notifications", async () => {
    const publicAppointment = {
      ...appointments[0],
      origin: "public" as const,
      publicEmail: "snapshot@example.com",
    };
    const { onSaveAppointment } = renderCalendar({
      calendarAppointments: [publicAppointment],
    });
    const annaBlock = screen.getByText("Анна Петрова").closest(".admin-timed-appointment") as HTMLElement;

    fireEvent.keyDown(within(annaBlock).getByRole("slider"), { key: "ArrowDown" });

    const confirmation = screen.getByRole("region", {
      name: /Подтвердите изменение/,
    });
    expect(
      within(confirmation).getByText(
        "Письмо будет отправлено на snapshot@example.com.",
      ),
    ).toBeVisible();
    expect(within(confirmation).queryByText(/anna@example\.com/i)).toBeNull();

    await confirmCalendarChange();

    expect(onSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: publicAppointment.id,
        publicEmail: "snapshot@example.com",
      }),
      "appointment.resize",
      expect.objectContaining({ id: publicAppointment.id }),
      { notifyClient: true },
    );
  });

  it("keeps an appointment pending until its confirmed save completes", async () => {
    let resolveSave: ((result: CalendarAppointmentSaveResult) => void) | undefined;
    const onSaveAppointment = vi.fn(
      () =>
        new Promise<CalendarAppointmentSaveResult>((resolve) => {
          resolveSave = resolve;
        }),
    );
    renderCalendar({ onSaveAppointment });
    const annaBlock = screen.getByText("Анна Петрова").closest(".admin-timed-appointment") as HTMLElement;

    fireEvent.keyDown(within(annaBlock).getByRole("slider"), { key: "ArrowDown" });
    expect(onSaveAppointment).not.toHaveBeenCalled();
    await confirmCalendarChange();

    expect(onSaveAppointment).toHaveBeenCalledTimes(1);
    expect(annaBlock).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Сохраняем изменение записи");

    resolveSave?.({ ok: true });
    await waitFor(() => expect(annaBlock).not.toHaveAttribute("aria-busy"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
