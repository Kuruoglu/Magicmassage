import { fireEvent, render, screen, within } from "@testing-library/react";
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

    expect(within(screen.getByRole("table")).getByRole("button", { name: "Olena K." })).toBeInTheDocument();
    expect(screen.queryByText("Maria Georgieva")).not.toBeInTheDocument();
  });

  it("filters clients with segmented controls", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" />);

    const filters = screen.getByLabelText("Фильтры клиентов");
    const table = screen.getByRole("table");
    await user.click(within(filters).getByRole("button", { name: "BG" }));

    expect(within(filters).getByRole("button", { name: "BG" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("button", { name: "Maria Georgieva" })).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Анна Петрова" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Olena K." })).not.toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Maria Georgieva" }));
    expect(within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("heading", { name: "Maria Georgieva" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("button", { name: "Закрыть" }));

    await user.click(within(filters).getByRole("button", { name: "Активные" }));

    expect(within(filters).getByRole("button", { name: "Активные" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("button", { name: "Анна Петрова" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Olena K." })).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Maria Georgieva" })).not.toBeInTheDocument();
  });

  it("explains how the active client filter is calculated", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    expect(screen.getByText("Активные = 5+ визитов и статус \"Активный клиент\".")).toBeInTheDocument();
  });

  it("shows the selected client detail card from the client query", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(card).getByText("+359 87 333 4411")).toBeInTheDocument();
    expect(within(card).getByText("olena.k@example.com")).toBeInTheDocument();
    expect(within(card).getByText("UA")).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "История визитов" })).toBeInTheDocument();
    expect(within(card).getAllByText("Deep tissue massage").length).toBeGreaterThan(0);
    expect(within(card).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(card).getByText(/Предпочитает вечерние слоты/)).toBeInTheDocument();
  });

  it("shows certificates linked to the selected client", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Сертификаты" })).toBeInTheDocument();
    expect(within(card).getByText("MMN-2407-1023")).toBeInTheDocument();
    expect(within(card).getByText("Oksana → Self")).toBeInTheDocument();
    expect(within(card).getByText("250 €")).toBeInTheDocument();
    expect(within(card).getByText("Ожидает PDF")).toBeInTheDocument();
  });

  it("creates a manual certificate and opens its details", () => {
    render(<AdminShell activeSection="certificates" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Выдать вручную" }));

    const dialog = screen.getByRole("dialog", { name: "Новый сертификат" });
    fireEvent.change(within(dialog).getByLabelText("Код"), { target: { value: "MMN-2407-1999" } });
    fireEvent.change(within(dialog).getByLabelText("Покупатель"), { target: { value: "Ирина Тестова" } });
    fireEvent.change(within(dialog).getByLabelText("Клиент"), { target: { value: "Ирина Тестова" } });
    fireEvent.change(within(dialog).getByLabelText("Получатель"), { target: { value: "Self" } });
    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "90 €" } });
    fireEvent.change(within(dialog).getByLabelText("Статус"), { target: { value: "Оплачено" } });
    fireEvent.change(within(dialog).getByLabelText("Stripe ID"), { target: { value: "manual" } });
    fireEvent.change(within(dialog).getByLabelText("Дата оплаты"), { target: { value: "2026-07-07" } });
    fireEvent.change(within(dialog).getByLabelText("Действителен до"), { target: { value: "2027-01-07" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка"), { target: { value: "Ручная выдача после оплаты в салоне." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить сертификат" }));

    expect(screen.queryByRole("dialog", { name: "Новый сертификат" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("button", { name: "MMN-2407-1999" })).toBeInTheDocument();

    const details = screen.getByLabelText("Детали сертификата");
    expect(within(details).getByRole("heading", { name: "MMN-2407-1999" })).toBeInTheDocument();
    expect(within(details).getByText("Ирина Тестова → Self")).toBeInTheDocument();
    expect(within(details).getByText("90 €")).toBeInTheDocument();
    expect(within(details).getByText("manual")).toBeInTheDocument();
    expect(within(details).getByText("Ручная выдача после оплаты в салоне.")).toBeInTheDocument();
  });

  it("updates certificate delivery, redemption, and editable details", () => {
    render(<AdminShell activeSection="certificates" role="owner" />);

    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "MMN-2407-1023" }));

    const details = screen.getByLabelText("Детали сертификата");
    expect(within(details).getByRole("heading", { name: "MMN-2407-1023" })).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Отправить PDF" }));
    expect(within(details).getByText("Отправлен")).toBeInTheDocument();
    expect(within(details).getByRole("status")).toHaveTextContent("PDF отмечен как отправленный.");

    fireEvent.click(within(details).getByRole("button", { name: "Погасить" }));
    expect(within(details).getByText("Погашен")).toBeInTheDocument();
    expect(within(details).getByRole("status")).toHaveTextContent("Сертификат погашен.");

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));
    const dialog = screen.getByRole("dialog", { name: "Редактировать сертификат" });
    fireEvent.change(within(dialog).getByLabelText("Получатель"), { target: { value: "Olena K." } });
    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "260 €" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка"), { target: { value: "Погашен после записи клиента." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать сертификат" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("button", { name: "MMN-2407-1023" })).toHaveLength(1);
    expect(within(details).getByText("Oksana → Olena K.")).toBeInTheDocument();
    expect(within(details).getByText("260 €")).toBeInTheDocument();
    expect(within(details).getByText("Погашен после записи клиента.")).toBeInTheDocument();
  });

  it("shows quick contact actions in the selected client card", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("link", { name: "Позвонить" })).toHaveAttribute("href", "tel:+359873334411");
    expect(within(card).getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:olena.k@example.com");
    expect(within(card).getByRole("link", { name: "Telegram" })).toHaveAttribute(
      "href",
      "https://t.me/olena_k_demo",
    );
  });

  it("links from the selected client card to prefilled appointment creation", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("link", { name: "Записать клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=Olena%20K.&action=create",
    );
  });

  it("edits and saves the selected client note", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    await user.click(within(card).getByRole("button", { name: "Редактировать заметку" }));

    const noteEditor = within(card).getByLabelText("Заметка клиента");
    await user.clear(noteEditor);
    await user.type(noteEditor, "Клиентка просит напоминать за 2 часа и готовит плечи к deep tissue.");
    await user.click(within(card).getByRole("button", { name: "Сохранить заметку" }));

    expect(within(card).getByRole("status")).toHaveTextContent("Заметка сохранена.");
    expect(within(card).getByText(/напоминать за 2 часа/)).toBeInTheDocument();
    expect(within(card).queryByLabelText("Заметка клиента")).not.toBeInTheDocument();
  });

  it("creates a client from the client primary action and opens its card", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));

    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });
    fireEvent.change(within(dialog).getByLabelText("Имя"), { target: { value: "Ирина Тестова" } });
    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359 88 777 1122" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "irina@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Язык"), { target: { value: "bg" } });
    fireEvent.change(within(dialog).getByLabelText("Канал связи"), { target: { value: "Telegram" } });
    fireEvent.change(within(dialog).getByLabelText("Статус"), { target: { value: "Новый клиент" } });
    fireEvent.change(within(dialog).getByLabelText("Telegram"), { target: { value: "https://t.me/irina_demo" } });
    fireEvent.change(within(dialog).getByLabelText("Следующий визит"), { target: { value: "Не назначен" } });
    fireEvent.change(within(dialog).getByLabelText("Визиты"), { target: { value: "0" } });
    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "0 €" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка клиента"), { target: { value: "Новая клиентка, предпочитает дневные слоты." } });
    fireEvent.change(within(dialog).getByLabelText("Теги"), { target: { value: "BG, new" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    expect(screen.queryByRole("dialog", { name: "Новый клиент" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Ирина Тестова" })).toBeInTheDocument();

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(card).getByText("+359 88 777 1122")).toBeInTheDocument();
    expect(within(card).getByText("irina@example.com")).toBeInTheDocument();
    expect(within(card).getByText("BG · Новый клиент")).toBeInTheDocument();
    expect(within(card).getByText(/предпочитает дневные слоты/)).toBeInTheDocument();
    expect(within(card).getByText("new")).toBeInTheDocument();
  });

  it("validates required client fields before saving", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Новый клиент" })).getByRole("button", { name: "Сохранить клиента" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Укажите имя и телефон клиента.");
    expect(within(screen.getByRole("table")).queryByRole("button", { name: "" })).not.toBeInTheDocument();
  });

  it("edits an existing client from the right drawer without creating a duplicate", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.click(within(card).getByRole("button", { name: "Редактировать клиента" }));

    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });
    expect(within(dialog).getByLabelText("Имя")).toHaveValue("Olena K.");

    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359 87 333 4499" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "olena.updated@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Канал связи"), { target: { value: "Email" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка клиента"), { target: { value: "Обновленная заметка из формы клиента." } });
    fireEvent.change(within(dialog).getByLabelText("Теги"), { target: { value: "UA, вечер, email" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать клиента" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("button", { name: "Olena K." })).toHaveLength(1);
    expect(within(card).getByText("+359 87 333 4499")).toBeInTheDocument();
    expect(within(card).getByText("olena.updated@example.com")).toBeInTheDocument();
    expect(within(card).getAllByText("Email").length).toBeGreaterThan(0);
    expect(within(card).getByText(/Обновленная заметка/)).toBeInTheDocument();
    expect(within(card).getByText("email")).toBeInTheDocument();
  });

  it("updates the calendar detail panel when an appointment is selected", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    expect(screen.getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText("Deep tissue massage")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText(/Уточнить шею и плечи/)).toBeInTheDocument();
  });

  it("links from a calendar appointment to the matching client card", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Список" }));
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
    const monthGrid = screen.getByRole("grid", { name: "Месяц Июль 2026" });
    expect(monthGrid).toBeInTheDocument();
    expect(within(monthGrid).queryByText("Классический массаж")).not.toBeInTheDocument();
    expect(within(monthGrid).getByText("2 записи")).toBeInTheDocument();
    expect(within(monthGrid).getAllByText("2 свободных слота").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /6 июля.*2 записи/ }));

    expect(screen.getByRole("heading", { name: "6 июля" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "День" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Анна Петрова/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Мария Иванова/ })).toBeInTheDocument();
  });

  it("shows a real weekly calendar view", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Неделя" }));

    const weekGrid = screen.getByRole("grid", { name: "Неделя 6-12 июля" });
    expect(screen.getByRole("heading", { name: "Неделя 6-12 июля" })).toBeInTheDocument();
    expect(within(weekGrid).getByText("6 июл")).toBeInTheDocument();
    expect(within(weekGrid).getByText("10 июл")).toBeInTheDocument();
    expect(within(weekGrid).getByText("Анна Петрова")).toBeInTheDocument();
    expect(within(weekGrid).getByText("SPA процедура")).toBeInTheDocument();
  });

  it("shows an empty state when a month day has no appointments", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    await user.click(screen.getByRole("button", { name: /^7 июля.*0 записей/ }));

    const details = screen.getByLabelText("Детали выбранной записи");
    expect(screen.getByRole("heading", { name: "7 июля" })).toBeInTheDocument();
    expect(screen.getByText("Записи не найдены.")).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Записей нет" })).toBeInTheDocument();
    expect(within(details).getByText("На выбранный день записей нет.")).toBeInTheDocument();
    expect(within(details).queryByText("Анна Петрова")).not.toBeInTheDocument();
  });

  it("keeps day mode focused on one day and list mode on all appointments", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    expect(screen.getByRole("heading", { name: "6 июля" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Olena K./ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Список" }));

    expect(screen.getByRole("heading", { name: "Список записей" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Olena K./ })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Ирина Тестова/ }));

    expect(screen.getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText("SPA процедура")).toBeInTheDocument();
  });

  it("opens primary appointment creation with an empty client after a prefilled dialog was closed", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />);

    await user.click(within(screen.getByRole("dialog", { name: "Новая запись" })).getByRole("button", { name: "Закрыть" }));
    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("");
  });

  it("filters existing clients while creating an appointment", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    await user.type(within(dialog).getByLabelText("Клиент"), "ole");

    const suggestions = within(dialog).getByRole("listbox", { name: "Найденные клиенты" });
    expect(within(suggestions).getByRole("option", { name: /Olena K./ })).toBeInTheDocument();
    expect(within(suggestions).queryByRole("option", { name: /Анна Петрова/ })).not.toBeInTheDocument();

    await user.click(within(suggestions).getByRole("option", { name: /Olena K./ }));

    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
  });

  it("opens a prefilled calendar appointment dialog from the action query", () => {
    render(<AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />);

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
  });

  it("reopens the prefilled appointment dialog after leaving and returning to the action link", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />,
    );

    await user.click(within(screen.getByRole("dialog", { name: "Новая запись" })).getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByRole("dialog", { name: "Новая запись" })).not.toBeInTheDocument();

    rerender(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);
    const calendarCreateLink = within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("link", {
      name: "Записать клиента",
    });
    calendarCreateLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(calendarCreateLink);
    rerender(<AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />);

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
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

    await user.click(screen.getByRole("button", { name: "Список" }));
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

    await user.click(screen.getByRole("button", { name: "Список" }));
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
