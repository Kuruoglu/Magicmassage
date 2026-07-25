import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Appointment, ClientRecord } from "@/admin/domain";

import {
  getPendingPostVisitComments,
  PostVisitCommentQueue,
} from "./PostVisitCommentQueue";

const appointments: Appointment[] = [
  {
    client: "Новый клиент",
    clientId: "client-new",
    date: "2026-07-12",
    id: "appointment-new",
    note: "",
    service: "Классический массаж",
    status: "Завершена",
    time: "15:00",
  },
  {
    client: "Старый клиент",
    clientId: "client-old",
    date: "2026-07-10",
    id: "appointment-old",
    note: "",
    service: "Deep tissue massage",
    specialistName: "Натали",
    status: "Завершена",
    time: "10:00",
  },
  {
    client: "Уже заполнен",
    date: "2026-07-09",
    id: "appointment-filled",
    note: "",
    postVisitComment: "Результат записан.",
    service: "SPA",
    status: "Завершена",
    time: "09:00",
  },
  {
    client: "Ещё не завершён",
    date: "2099-07-20",
    id: "appointment-confirmed",
    note: "",
    service: "SPA",
    status: "Подтверждена",
    time: "09:00",
  },
];

const clients: ClientRecord[] = [
  {
    email: "",
    history: [],
    id: "client-old",
    language: "ru",
    name: "Старый клиент",
    next: "—",
    note: "",
    phone: "",
    preferredContact: "Телефон",
    status: "Активный клиент",
    tags: [],
    telegram: "",
    totalSpend: "0 €",
    visits: 1,
  },
  {
    email: "",
    history: [],
    id: "client-new",
    language: "ru",
    name: "Новый клиент",
    next: "—",
    note: "",
    phone: "",
    preferredContact: "Телефон",
    status: "Активный клиент",
    tags: [],
    telegram: "",
    totalSpend: "0 €",
    visits: 1,
  },
];

describe("PostVisitCommentQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps past visits with blank comments and orders the oldest first", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");

    expect(getPendingPostVisitComments(appointments, now).map((appointment) => appointment.id)).toEqual([
      "appointment-old",
      "appointment-new",
    ]);

    expect(
      getPendingPostVisitComments([
        { ...appointments[0], id: "whitespace", postVisitComment: "   " },
        { ...appointments[0], id: "no-show", status: "Не пришёл" },
        {
          ...appointments[0],
          date: "2026-07-08",
          id: "past-confirmed",
          status: "Подтверждена",
        },
      ], now).map((appointment) => appointment.id),
    ).toEqual(["past-confirmed", "whitespace"]);
  });

  it("lets the owner save the first comment and advances the queue", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (appointment: Appointment, originalAppointment: Appointment) => {
      void appointment;
      void originalAppointment;
      return { ok: true as const };
    });

    function QueueHarness() {
      const [records, setRecords] = useState(appointments);

      return (
        <PostVisitCommentQueue
          appointments={records}
          clients={clients}
          onSaveComment={async (appointment, originalAppointment) => {
            const result = await onSave(appointment, originalAppointment);
            if (result.ok) {
              setRecords((current) =>
                current.map((record) =>
                  record.id === appointment.id ? appointment : record,
                ),
              );
            }
            return result;
          }}
          query=""
          role="owner"
        />
      );
    }

    render(<QueueHarness />);

    const queue = screen.getByRole("list");
    const initialItems = within(queue).getAllByRole("listitem");
    expect(initialItems).toHaveLength(2);
    expect(initialItems[0]).toHaveTextContent("Старый клиент");
    expect(initialItems[0]).toHaveTextContent("Следующий");
    expect(initialItems[1]).toHaveTextContent("Новый клиент");

    await user.click(
      within(initialItems[0]).getByRole("button", {
        name: /Заполнить комментарий: Старый клиент/,
      }),
    );
    const field = within(initialItems[0]).getByLabelText("Комментарий после визита");
    await user.type(field, "После массажа самочувствие хорошее.");
    await user.click(
      within(initialItems[0]).getByRole("button", {
        name: "Сохранить комментарий",
      }),
    );

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "appointment-old",
        postVisitComment: "После массажа самочувствие хорошее.",
        postVisitCommentedAt: expect.any(String),
      }),
      expect.objectContaining({ id: "appointment-old" }),
    );

    await waitFor(() => {
      const remainingItems = within(screen.getByRole("list")).getAllByRole("listitem");
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0]).toHaveTextContent("Новый клиент");
      expect(screen.getByText("1 визит без комментария")).toBeInTheDocument();
      expect(
        within(remainingItems[0]).getByRole("button", {
          name: /Заполнить комментарий: Новый клиент/,
        }),
      ).toHaveFocus();
    });
  });

  it("keeps an unsaved draft open when the owner rejects switching rows", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <PostVisitCommentQueue
        appointments={appointments}
        clients={clients}
        onSaveComment={vi.fn()}
        query=""
        role="owner"
      />,
    );

    const items = screen.getAllByRole("listitem");
    await user.click(
      within(items[0]).getByRole("button", {
        name: /Заполнить комментарий: Старый клиент/,
      }),
    );
    const field = within(items[0]).getByLabelText("Комментарий после визита");
    await user.type(field, "Несохранённый результат");
    await user.click(
      within(items[1]).getByRole("button", {
        name: /Заполнить комментарий: Новый клиент/,
      }),
    );

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue("Несохранённый результат");
    expect(
      within(items[0]).getByRole("button", { name: /Скрыть поле: Старый клиент/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(items[1]).getByRole("button", { name: /Заполнить комментарий: Новый клиент/ }),
    ).toHaveAttribute("aria-expanded", "false");

    confirmSpy.mockRestore();
  });

  it("protects a draft when the owner follows another dashboard link", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <>
        <Link href="/admin?section=calendar&role=owner">Открыть календарь</Link>
        <PostVisitCommentQueue
          appointments={appointments}
          clients={clients}
          onSaveComment={vi.fn()}
          query=""
          role="owner"
        />
      </>,
    );

    const firstItem = screen.getAllByRole("listitem")[0];
    await user.click(
      within(firstItem).getByRole("button", {
        name: /Заполнить комментарий: Старый клиент/,
      }),
    );
    const field = within(firstItem).getByLabelText("Комментарий после визита");
    await user.type(field, "Черновик");
    await user.click(screen.getByRole("link", { name: "Открыть календарь" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue("Черновик");
    expect(field).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it("returns focus to the row action after cancelling the editor", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <PostVisitCommentQueue
        appointments={appointments}
        clients={clients}
        onSaveComment={vi.fn()}
        query=""
        role="owner"
      />,
    );

    const firstItem = screen.getAllByRole("listitem")[0];
    const action = within(firstItem).getByRole("button", {
      name: /Заполнить комментарий: Старый клиент/,
    });
    await user.click(action);
    await user.type(
      within(firstItem).getByLabelText("Комментарий после визита"),
      "Черновик",
    );
    await user.click(within(firstItem).getByRole("button", { name: "Отмена" }));

    await waitFor(() => expect(action).toHaveFocus());
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it("adds a visit to an open queue after the session ends", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T09:59:30.000Z"));

    render(
      <PostVisitCommentQueue
        appointments={[
          {
            ...appointments[0],
            date: "2026-07-14",
            durationMinutes: 60,
            status: "Подтверждена",
            time: "12:00",
          },
        ]}
        clients={clients}
        onSaveComment={vi.fn()}
        query=""
        role="owner"
      />,
    );

    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByRole("listitem")).toHaveTextContent("Новый клиент");
  });

  it("preserves global queue order while search filters the visible rows", () => {
    render(
      <PostVisitCommentQueue
        appointments={appointments}
        clients={clients}
        onSaveComment={vi.fn()}
        query="Новый"
        role="owner"
      />,
    );

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Новый клиент");
    expect(within(item).getByText("2")).toBeInTheDocument();
    expect(within(item).queryByText("Следующий")).not.toBeInTheDocument();
  });

  it("shows a completed state when the queue is empty", () => {
    render(
      <PostVisitCommentQueue
        appointments={appointments.filter((appointment) => appointment.postVisitComment)}
        clients={clients}
        onSaveComment={vi.fn()}
        query=""
        role="owner"
      />,
    );

    expect(
      screen.getByText("Все комментарии после прошедших визитов заполнены."),
    ).toBeInTheDocument();
  });
});
