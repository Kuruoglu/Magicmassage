import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminShell } from "./admin-shell";

describe("AdminShell", () => {
  it("renders the operational owner dashboard without a marketing hero", () => {
    render(<AdminShell activeSection="dashboard" role="owner" />);

    expect(screen.getByRole("heading", { level: 1, name: "Дашборд" })).toBeInTheDocument();
    expect(screen.getByText("Magic Massage Natali")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Клиенты" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner",
    );
    expect(screen.queryByText(/hero/i)).not.toBeInTheDocument();
  });

  it("keeps dashboard shortcut links inside the current role view", () => {
    render(<AdminShell activeSection="dashboard" role="specialist" />);

    expect(screen.getByRole("link", { name: "Открыть календарь" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=specialist",
    );
    expect(screen.queryByRole("link", { name: "Финансы" })).not.toBeInTheDocument();
  });

  it("shows the strict finance workspace for the accountant role only", () => {
    render(<AdminShell activeSection="finances" role="accountant" />);

    const navigation = screen.getByRole("navigation", { name: "Admin sections" });
    expect(within(navigation).getByRole("link", { name: "Финансы" })).toHaveAttribute(
      "href",
      "/admin?section=finances&role=accountant",
    );
    expect(within(navigation).queryByRole("link", { name: "Клиенты" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Календарь" })).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 1, name: "Финансы" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выгрузить отчет" })).toBeInTheDocument();
    expect(screen.getByText("Stripe fees")).toBeInTheDocument();
    expect(screen.getByText("550,00 €")).toBeInTheDocument();
    expect(screen.getByText("audit log")).toBeInTheDocument();
  });

  it("filters clients from the global admin search", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" />);

    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "Olena");

    expect(screen.getByText("Olena K.")).toBeInTheDocument();
    expect(screen.queryByText("Maria Georgieva")).not.toBeInTheDocument();
  });

  it("shows the selected client detail card from the client query", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByLabelText("Карточка клиента");
    expect(within(card).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(card).getByText("+359 87 333 4411")).toBeInTheDocument();
    expect(within(card).getByText("olena.k@example.com")).toBeInTheDocument();
    expect(within(card).getByText("UA")).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "История визитов" })).toBeInTheDocument();
    expect(within(card).getAllByText("Deep tissue massage").length).toBeGreaterThan(0);
    expect(within(card).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(card).getByText(/Предпочитает вечерние слоты/)).toBeInTheDocument();
  });

  it("shows quick contact actions in the selected client card", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByLabelText("Карточка клиента");
    expect(within(card).getByRole("link", { name: "Позвонить" })).toHaveAttribute("href", "tel:+359873334411");
    expect(within(card).getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:olena.k@example.com");
    expect(within(card).getByRole("link", { name: "Telegram" })).toHaveAttribute(
      "href",
      "https://t.me/olena_k_demo",
    );
  });

  it("edits and saves the selected client note", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByLabelText("Карточка клиента");
    await user.click(within(card).getByRole("button", { name: "Редактировать заметку" }));

    const noteEditor = within(card).getByLabelText("Заметка клиента");
    await user.clear(noteEditor);
    await user.type(noteEditor, "Клиентка просит напоминать за 2 часа и готовит плечи к deep tissue.");
    await user.click(within(card).getByRole("button", { name: "Сохранить заметку" }));

    expect(within(card).getByRole("status")).toHaveTextContent("Заметка сохранена.");
    expect(within(card).getByText(/напоминать за 2 часа/)).toBeInTheDocument();
    expect(within(card).queryByLabelText("Заметка клиента")).not.toBeInTheDocument();
  });

  it("updates the calendar detail panel when an appointment is selected", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    expect(screen.getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText("Deep tissue massage")).toBeInTheDocument();
  });

  it("links from a calendar appointment to the matching client card", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    expect(
      within(screen.getByLabelText("Детали выбранной записи")).getByRole("link", { name: "Открыть клиента" }),
    ).toHaveAttribute("href", "/admin?section=clients&role=owner&client=Olena%20K.");
  });

  it("switches the calendar to a month view with selectable days", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));

    expect(screen.getByRole("heading", { name: "Июль 2026" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Месяц Июль 2026" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /6 июля.*2 записи/ }));

    expect(screen.getByRole("heading", { name: "6 июля" })).toBeInTheDocument();
    expect(screen.getByText("Анна Петрова")).toBeInTheDocument();
    expect(screen.getByText("Мария Иванова")).toBeInTheDocument();
  });

  it("opens a quick action panel from the primary action", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="dashboard" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    expect(screen.getByRole("dialog", { name: "Быстрое действие" })).toBeInTheDocument();
    expect(screen.getByText("Создать запись")).toBeInTheDocument();
  });

  it("creates a calendar appointment from the primary action", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    await user.type(within(dialog).getByLabelText("Клиент"), "Ирина Тестова");
    await user.selectOptions(within(dialog).getByLabelText("Услуга"), "SPA процедура");
    await user.clear(within(dialog).getByLabelText("Дата"));
    await user.type(within(dialog).getByLabelText("Дата"), "2026-07-12");
    await user.clear(within(dialog).getByLabelText("Время"));
    await user.type(within(dialog).getByLabelText("Время"), "11:15");
    await user.selectOptions(within(dialog).getByLabelText("Статус"), "Подтверждена");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(screen.queryByRole("dialog", { name: "Новая запись" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Ирина Тестова/ }));

    expect(screen.getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText("SPA процедура")).toBeInTheDocument();
  });

  it("keeps the calendar appointment dialog open when required fields are missing", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    await user.type(within(dialog).getByLabelText("Клиент"), "Ирина Тестова");
    await user.clear(within(dialog).getByLabelText("Дата"));
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Укажите клиента, дату и время.");
    expect(screen.getByRole("dialog", { name: "Новая запись" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ирина Тестова/ })).not.toBeInTheDocument();
  });

  it("edits and reschedules the selected calendar appointment", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: /Olena K./ }));
    await user.click(within(screen.getByLabelText("Детали выбранной записи")).getByRole("button", { name: "Редактировать" }));

    const dialog = screen.getByRole("dialog", { name: "Редактировать запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");

    await user.clear(within(dialog).getByLabelText("Дата"));
    await user.type(within(dialog).getByLabelText("Дата"), "2026-07-13");
    await user.clear(within(dialog).getByLabelText("Время"));
    await user.type(within(dialog).getByLabelText("Время"), "16:45");
    await user.selectOptions(within(dialog).getByLabelText("Статус"), "Ожидает");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    const details = screen.getByLabelText("Детали выбранной записи");
    expect(screen.queryByRole("dialog", { name: "Редактировать запись" })).not.toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(details).getByText("13 июля")).toBeInTheDocument();
    expect(within(details).getByText("16:45")).toBeInTheDocument();
    expect(within(details).getByText("Ожидает")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /15:00Olena K./ })).not.toBeInTheDocument();
  });

  it("cancels the selected calendar appointment after confirmation", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    const details = screen.getByLabelText("Детали выбранной записи");
    await user.click(within(details).getByRole("button", { name: "Отменить" }));

    const firstDialog = screen.getByRole("dialog", { name: "Отменить запись" });
    expect(within(firstDialog).getByText("Olena K.")).toBeInTheDocument();
    await user.click(within(firstDialog).getByRole("button", { name: "Оставить запись" }));

    expect(screen.queryByRole("dialog", { name: "Отменить запись" })).not.toBeInTheDocument();
    expect(within(details).getByText("Подтверждена")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Отменить" }));
    const confirmationDialog = screen.getByRole("dialog", { name: "Отменить запись" });
    await user.click(within(confirmationDialog).getByRole("button", { name: "Подтвердить отмену" }));

    const updatedDetails = screen.getByLabelText("Детали выбранной записи");
    const cancelledAppointment = screen.getByRole("button", { name: /Olena K./ });
    expect(screen.queryByRole("dialog", { name: "Отменить запись" })).not.toBeInTheDocument();
    expect(within(updatedDetails).getByText("Отменена")).toBeInTheDocument();
    expect(within(cancelledAppointment).getByText("Отменена")).toBeInTheDocument();
  });

  it("acknowledges CSV exports in the accountant finance workspace", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="finances" role="accountant" />);

    await user.click(screen.getByRole("button", { name: "CSV" }));

    expect(screen.getByText("CSV отчет за 2026-07-01 - 2026-07-03 готов к скачиванию.")).toBeInTheDocument();
  });

  it("filters accountant Stripe rows by selected period", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="finances" role="accountant" />);

    await user.clear(screen.getByLabelText("Начало периода"));
    await user.type(screen.getByLabelText("Начало периода"), "2026-07-02");
    await user.clear(screen.getByLabelText("Конец периода"));
    await user.type(screen.getByLabelText("Конец периода"), "2026-07-02");

    const summary = screen.getByLabelText("Finance summary");
    expect(within(summary).getByText("180,00 €")).toBeInTheDocument();
    expect(within(summary).getByText("1")).toBeInTheDocument();

    expect(screen.getByText("pi_3QMMN1022")).toBeInTheDocument();
    expect(screen.queryByText("pi_3QMMN1021")).not.toBeInTheDocument();
    expect(screen.queryByText("pi_3QMMN1023")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "CSV" }));

    expect(screen.getByRole("status")).toHaveTextContent("CSV отчет за 2026-07-02 - 2026-07-02 готов к скачиванию.");
  });
});
