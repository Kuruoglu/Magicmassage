import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("links dashboard operational rows to the connected workspaces", () => {
    render(<AdminShell activeSection="dashboard" role="owner" />);

    expect(screen.getByRole("heading", { name: "Операционная очередь" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Создать запись/ })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&action=create",
    );
    expect(screen.getByRole("link", { name: /Открыть клиентов/ })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner",
    );
    expect(screen.getByRole("link", { name: /Сертификаты к отправке/ })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
    expect(screen.getByRole("link", { name: /Выгрузить Stripe/ })).toHaveAttribute(
      "href",
      "/admin?section=finances&role=owner",
    );
    expect(screen.getByRole("link", { name: /Пользователи и роли/ })).toHaveAttribute(
      "href",
      "/admin?section=users&role=owner",
    );
    expect(screen.getByRole("link", { name: "Анна Петрова" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=%D0%90%D0%BD%D0%BD%D0%B0%20%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D0%B0",
    );
    expect(within(screen.getByRole("row", { name: /10:00 Анна Петрова/ })).getByRole("link", { name: "Календарь" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-06&client=%D0%90%D0%BD%D0%BD%D0%B0%20%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D0%B0&appointment=demo-1",
    );
    expect(screen.getByRole("link", { name: "MMN-2407-1023" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
  });

  it("hides restricted dashboard operation links for a specialist", () => {
    render(<AdminShell activeSection="dashboard" role="specialist" />);

    expect(screen.getByRole("link", { name: /Создать запись/ })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=specialist&action=create",
    );
    expect(screen.getByRole("link", { name: /Открыть клиентов/ })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=specialist",
    );
    expect(screen.queryByRole("link", { name: /Выгрузить Stripe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Пользователи и роли/ })).not.toBeInTheDocument();
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

    expect(within(screen.getByRole("table")).getByRole("link", { name: "Olena K." })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=Olena%20K.",
    );
    expect(screen.queryByText("Maria Georgieva")).not.toBeInTheDocument();
  });

  it("filters clients with segmented controls", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" />);

    const filters = screen.getByLabelText("Фильтры клиентов");
    const table = screen.getByRole("table");
    await user.click(within(filters).getByRole("button", { name: "BG" }));

    expect(within(filters).getByRole("button", { name: "BG" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("link", { name: "Maria Georgieva" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=Maria%20Georgieva",
    );
    expect(within(table).queryByRole("link", { name: "Анна Петрова" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Olena K." })).not.toBeInTheDocument();

    const mariaLink = within(table).getByRole("link", { name: "Maria Georgieva" });
    mariaLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(mariaLink);
    expect(within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("heading", { name: "Maria Georgieva" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("button", { name: "Закрыть" }));

    await user.click(within(filters).getByRole("button", { name: "Активные" }));

    expect(within(filters).getByRole("button", { name: "Активные" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("columnheader", { name: "Статус" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Активность" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Анна Петрова/ })).toHaveTextContent("Активный клиент");
    expect(within(table).getByRole("row", { name: /Анна Петрова/ })).toHaveTextContent("В активных: 7 визитов");
    expect(within(table).getByRole("row", { name: /Olena K./ })).toHaveTextContent("Активный клиент");
    expect(within(table).getByRole("row", { name: /Olena K./ })).toHaveTextContent("В активных: 5 визитов");
    expect(within(table).queryByRole("link", { name: "Maria Georgieva" })).not.toBeInTheDocument();
  });

  it("explains how the active client filter is calculated", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    const help = screen.getByLabelText("Смысл фильтра активных клиентов");
    expect(help).toHaveTextContent("Активные — это клиенты со статусом \"Активный клиент\" и минимум 5 визитами.");
    expect(help).toHaveTextContent("Причина активности показывается в таблице, мобильной карточке и карточке клиента.");
  });

  it("renders mobile client summaries with natural visit labels", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    const mobileList = screen.getByRole("list", { name: "Мобильный список клиентов" });
    expect(within(mobileList).getByText("3 визита")).toBeInTheDocument();
    expect(within(mobileList).getByText("5 визитов")).toBeInTheDocument();
    expect(within(mobileList).getByText("7 визитов")).toBeInTheDocument();
    expect(within(mobileList).getByRole("link", { name: /Olena K./ })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=Olena%20K.",
    );
  });

  it("shows the selected client detail card from the client query", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(card).toHaveClass("admin-drawer-panel");
    expect(within(card).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(card).getByText("+359 87 333 4411")).toBeInTheDocument();
    expect(within(card).getByText("olena.k@example.com")).toBeInTheDocument();
    expect(within(card).getByText("UA")).toBeInTheDocument();
    expect(within(card).getByLabelText("Активность клиента")).toHaveTextContent("В активных: 5 визитов");
    expect(within(card).getByLabelText("Активность клиента")).toHaveTextContent("Следующий визит: 15 Jul 11:30");
    const historySection = within(card)
      .getByRole("heading", { name: "История визитов" })
      .closest("section");
    expect(historySection).not.toBeNull();
    expect(within(card).getAllByText("Deep tissue massage").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("8 июля, 15:00").length).toBeGreaterThan(0);
    expect(
      within(historySection as HTMLElement).getByRole("link", { name: "Открыть запись 8 июля, 15:00" }),
    ).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=Olena%20K.&appointment=demo-3",
    );
    expect(within(card).getAllByText(/Предпочитает вечерние слоты/).length).toBeGreaterThan(0);
  });

  it("shows certificates linked to the selected client", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Сертификаты" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "MMN-2407-1023" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
    expect(within(card).getByText("Oksana → Self")).toBeInTheDocument();
    expect(within(card).getByText("250 €")).toBeInTheDocument();
    expect(within(card).getAllByText("Ожидает PDF").length).toBeGreaterThan(0);
  });

  it("opens certificate details from the certificate query", () => {
    render(<AdminShell activeSection="certificates" role="owner" selectedCertificateCode="MMN-2407-1023" />);

    const details = screen.getByRole("dialog", { name: "Детали сертификата" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "MMN-2407-1023" })).toBeInTheDocument();
    expect(within(details).getByText("Oksana → Self")).toBeInTheDocument();
    expect(within(details).getByText("Ожидает PDF")).toBeInTheDocument();
    const linkedActions = within(details).getByLabelText("Связанные действия клиента");
    expect(within(linkedActions).getByRole("link", { name: "Карточка клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=Olena%20K.",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все записи клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=Olena%20K.",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все сертификаты клиента" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&client=Olena%20K.",
    );
    expect(within(linkedActions).getByRole("link", { name: "Записать клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=Olena%20K.&action=create",
    );
  });

  it("opens service details from the service query", () => {
    render(<AdminShell activeSection="services" role="owner" selectedServiceSlug="classic-massage" />);

    const details = screen.getByRole("dialog", { name: "Детали услуги" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Классический массаж" })).toBeInTheDocument();
    expect(within(details).getByText("classic-massage")).toBeInTheDocument();
  });

  it("opens price details from the price query", () => {
    render(<AdminShell activeSection="price" role="owner" selectedPriceId="price-classic-60" />);

    const details = screen.getByRole("dialog", { name: "Детали цены" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Классический массаж · 60 мин" })).toBeInTheDocument();
    expect(within(details).getByText("70 €")).toBeInTheDocument();
    expect(within(details).getByText("EUR")).toBeInTheDocument();
  });

  it("opens media details from the media query", () => {
    render(<AdminShell activeSection="media" role="owner" selectedMediaId="media-classic-cover" />);

    const details = screen.getByRole("dialog", { name: "Детали медиа" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Классический массаж" })).toBeInTheDocument();
    expect(within(details).getByText("/media/services/classic-massage.jpg")).toBeInTheDocument();
    expect(within(details).getByText("Услуга: Классический массаж")).toBeInTheDocument();
  });

  it("opens contact details from the contact query", () => {
    render(<AdminShell activeSection="contacts" role="owner" selectedContactId="contact-phone" />);

    const details = screen.getByRole("dialog", { name: "Детали контакта" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Телефон салона" })).toBeInTheDocument();
    expect(within(details).getByText("+359 87 333 4411")).toBeInTheDocument();
    expect(within(details).getByText("LocalBusiness SEO")).toBeInTheDocument();
  });

  it("opens blog details from the blog query", () => {
    render(<AdminShell activeSection="blog" role="owner" selectedBlogPostId="blog-first-massage-preparation" />);

    const details = screen.getByRole("dialog", { name: "Детали статьи" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Подготовка к первому массажу" })).toBeInTheDocument();
    expect(within(details).getByText("first-massage-preparation")).toBeInTheDocument();
    expect(within(details).getByText("Подготовка к первому массажу в Бургасе")).toBeInTheDocument();
  });

  it("opens settings details from the settings query", () => {
    render(<AdminShell activeSection="settings" role="owner" selectedSettingsGroupId="booking" />);

    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Запись и календарь" })).toBeInTheDocument();
    expect(within(details).getByText("30 минут")).toBeInTheDocument();
    expect(within(details).getByText("Внутренний календарь главный")).toBeInTheDocument();
  });

  it("opens user details from the user query", () => {
    render(<AdminShell activeSection="users" role="owner" selectedAdminUserId="admin-user-owner" />);

    const details = screen.getByRole("dialog", { name: "Детали пользователя" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Natali Ivanova" })).toBeInTheDocument();
    expect(within(details).getByText("natali@magicmassage.bg")).toBeInTheDocument();
    expect(within(details).getByText("Владелец")).toBeInTheDocument();
  });

  it.each([
    {
      activeSection: "certificates" as const,
      drawerLabel: "Детали сертификата",
      heading: "MMN-2407-1023",
      rowHref: "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
      rowButton: "MMN-2407-1023",
    },
    {
      activeSection: "services" as const,
      drawerLabel: "Детали услуги",
      heading: "Классический массаж",
      rowHref: "/admin?section=services&role=owner&service=classic-massage",
      rowButton: "Классический массаж",
    },
    {
      activeSection: "price" as const,
      drawerLabel: "Детали цены",
      heading: "Классический массаж · 60 мин",
      rowHref: "/admin?section=price&role=owner&price=price-classic-60",
      rowButton: "Классический массаж · 60 мин",
    },
    {
      activeSection: "media" as const,
      drawerLabel: "Детали медиа",
      heading: "Классический массаж",
      rowHref: "/admin?section=media&role=owner&media=media-classic-cover",
      rowButton: "Классический массаж",
    },
    {
      activeSection: "contacts" as const,
      drawerLabel: "Детали контакта",
      heading: "Телефон салона",
      rowHref: "/admin?section=contacts&role=owner&contact=contact-phone",
      rowButton: "Телефон салона",
    },
    {
      activeSection: "blog" as const,
      drawerLabel: "Детали статьи",
      heading: "Подготовка к первому массажу",
      rowHref: "/admin?section=blog&role=owner&blog=blog-first-massage-preparation",
      rowButton: "Подготовка к первому массажу",
    },
    {
      activeSection: "settings" as const,
      drawerLabel: "Детали настроек",
      heading: "Запись и календарь",
      rowHref: "/admin?section=settings&role=owner&settings=booking",
      rowButton: "Запись и календарь",
    },
    {
      activeSection: "users" as const,
      drawerLabel: "Детали пользователя",
      heading: "Natali Ivanova",
      rowHref: "/admin?section=users&role=owner&user=admin-user-owner",
      rowButton: "Natali Ivanova",
    },
  ])("opens $drawerLabel as a full-height drawer after selecting a row", ({ activeSection, drawerLabel, heading, rowButton, rowHref }) => {
    render(<AdminShell activeSection={activeSection} role="owner" />);

    expect(screen.queryByLabelText(drawerLabel)).not.toBeInTheDocument();

    const rowControl = rowHref
      ? within(screen.getByRole("table")).getByRole("link", { name: rowButton })
      : within(screen.getByRole("table")).getByRole("button", { name: rowButton });
    if (rowHref) {
      expect(rowControl).toHaveAttribute("href", rowHref);
      rowControl.addEventListener("click", (event) => event.preventDefault(), { once: true });
    }

    fireEvent.click(rowControl);

    const details = screen.getByRole("dialog", { name: drawerLabel });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(details.parentElement).toHaveClass("admin-drawer-backdrop");
    expect(within(details).getByRole("heading", { name: heading })).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Закрыть" }));

    expect(screen.queryByRole("dialog", { name: drawerLabel })).not.toBeInTheDocument();
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
    expect(within(screen.getByRole("table")).getByRole("link", { name: "MMN-2407-1999" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1999",
    );

    const details = screen.getByLabelText("Детали сертификата");
    expect(within(details).getByRole("heading", { name: "MMN-2407-1999" })).toBeInTheDocument();
    expect(within(details).getByText("Ирина Тестова → Self")).toBeInTheDocument();
    expect(within(details).getByText("90 €")).toBeInTheDocument();
    expect(within(details).getByText("manual")).toBeInTheDocument();
    expect(within(details).getByText("Ручная выдача после оплаты в салоне.")).toBeInTheDocument();
  });

  it("updates certificate delivery, redemption, and editable details", () => {
    render(<AdminShell activeSection="certificates" role="owner" />);

    const certificateLink = within(screen.getByRole("table")).getByRole("link", { name: "MMN-2407-1023" });
    expect(certificateLink).toHaveAttribute("href", "/admin?section=certificates&role=owner&certificate=MMN-2407-1023");
    certificateLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(certificateLink);

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
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "MMN-2407-1023" })).toHaveLength(1);
    expect(within(details).getByText("Oksana → Olena K.")).toBeInTheDocument();
    expect(within(details).getByText("260 €")).toBeInTheDocument();
    expect(within(details).getByText("Погашен после записи клиента.")).toBeInTheDocument();
  });

  it("creates and edits a massage service from the services workspace", () => {
    render(<AdminShell activeSection="services" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить услугу" }));

    const createDialog = screen.getByRole("dialog", { name: "Новая услуга" });
    fireEvent.change(within(createDialog).getByLabelText("Название"), { target: { value: "Арома массаж" } });
    fireEvent.change(within(createDialog).getByLabelText("Slug"), { target: { value: "aroma-massage" } });
    fireEvent.change(within(createDialog).getByLabelText("Категория"), { target: { value: "SPA" } });
    fireEvent.change(within(createDialog).getByLabelText("Статус"), { target: { value: "Черновик" } });
    fireEvent.change(within(createDialog).getByLabelText("Длительность"), { target: { value: "75 мин" } });
    fireEvent.change(within(createDialog).getByLabelText("Порядок"), { target: { value: "9" } });
    fireEvent.change(within(createDialog).getByLabelText("Локали"), { target: { value: "ru, bg" } });
    fireEvent.change(within(createDialog).getByLabelText("SEO title"), { target: { value: "Арома массаж в Бургасе" } });
    fireEvent.change(within(createDialog).getByLabelText("Обложка"), { target: { value: "/media/services/aroma-massage.jpg" } });
    fireEvent.change(within(createDialog).getByLabelText("Описание"), { target: { value: "Расслабляющая SPA-услуга с ароматическими маслами." } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Сохранить услугу" }));

    expect(screen.queryByRole("dialog", { name: "Новая услуга" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Арома массаж" })).toHaveAttribute(
      "href",
      "/admin?section=services&role=owner&service=aroma-massage",
    );

    const details = screen.getByLabelText("Детали услуги");
    expect(within(details).getByRole("heading", { name: "Арома массаж" })).toBeInTheDocument();
    expect(within(details).getByText("aroma-massage")).toBeInTheDocument();
    expect(within(details).getByText("Расслабляющая SPA-услуга с ароматическими маслами.")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать услугу" });
    fireEvent.change(within(editDialog).getByLabelText("Статус"), { target: { value: "Опубликована" } });
    fireEvent.change(within(editDialog).getByLabelText("Описание"), { target: { value: "Опубликованное описание услуги для сайта." } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать услугу" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "Арома массаж" })).toHaveLength(1);
    expect(within(details).getByText("Опубликована")).toBeInTheDocument();
    expect(within(details).getByText("Опубликованное описание услуги для сайта.")).toBeInTheDocument();
  });

  it("keeps price variants attached when a service slug changes", () => {
    render(<AdminShell activeSection="services" role="owner" />);

    const serviceLink = within(screen.getByRole("table")).getByRole("link", { name: "Классический массаж" });
    serviceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(serviceLink);

    const details = screen.getByLabelText("Детали услуги");
    expect(within(details).getByText("70 €")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать услугу" });
    fireEvent.change(within(editDialog).getByLabelText("Slug"), { target: { value: "classic-massage-updated" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(within(details).getByText("classic-massage-updated")).toBeInTheDocument();
    expect(within(details).getByText("70 €")).toBeInTheDocument();
  });

  it("filters service rows by publication status", () => {
    render(<AdminShell activeSection="services" role="owner" />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Классический массаж" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Черновики" }));

    expect(screen.getByRole("button", { name: "Черновики" })).toHaveAttribute("aria-pressed", "true");
    const draftServiceLink = within(table).getByRole("link", { name: "Deep tissue massage" });
    expect(draftServiceLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Классический массаж" })).not.toBeInTheDocument();
    draftServiceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(draftServiceLink);
    expect(within(screen.getByRole("dialog", { name: "Детали услуги" })).getByRole("heading", { name: "Deep tissue massage" })).toBeInTheDocument();
  });

  it("creates and edits a price variant from the price workspace", () => {
    render(<AdminShell activeSection="price" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить цену" }));

    const createDialog = screen.getByRole("dialog", { name: "Новая цена" });
    fireEvent.change(within(createDialog).getByLabelText("Услуга"), { target: { value: "classic-massage" } });
    fireEvent.change(within(createDialog).getByLabelText("Длительность"), { target: { value: "90" } });
    fireEvent.change(within(createDialog).getByLabelText("Цена"), { target: { value: "110" } });
    fireEvent.change(within(createDialog).getByLabelText("Статус"), { target: { value: "Активна" } });
    fireEvent.change(within(createDialog).getByLabelText("Порядок"), { target: { value: "4" } });
    fireEvent.change(within(createDialog).getByLabelText("Заметка"), { target: { value: "Новый длинный вариант для постоянных клиентов." } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Сохранить цену" }));

    expect(screen.queryByRole("dialog", { name: "Новая цена" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Классический массаж · 90 мин" })).toHaveAttribute(
      "href",
      "/admin?section=price&role=owner&price=price-classic-massage-90",
    );

    const details = screen.getByLabelText("Детали цены");
    expect(within(details).getByRole("heading", { name: "Классический массаж · 90 мин" })).toBeInTheDocument();
    expect(within(details).getByText("110 €")).toBeInTheDocument();
    expect(within(details).getByText("Новый длинный вариант для постоянных клиентов.")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать цену" });
    fireEvent.change(within(editDialog).getByLabelText("Цена"), { target: { value: "115" } });
    fireEvent.change(within(editDialog).getByLabelText("Статус"), { target: { value: "Скрыта" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать цену" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "Классический массаж · 90 мин" })).toHaveLength(1);
    expect(within(details).getByText("115 €")).toBeInTheDocument();
    expect(within(details).getByText("Скрыта")).toBeInTheDocument();
  });

  it("filters price rows by active and hidden status", () => {
    render(<AdminShell activeSection="price" role="owner" />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Классический массаж · 60 мин" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Скрытые" }));

    expect(screen.getByRole("button", { name: "Скрытые" })).toHaveAttribute("aria-pressed", "true");
    const hiddenPriceLink = within(table).getByRole("link", { name: "Deep tissue massage · 60 мин" });
    expect(hiddenPriceLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Классический массаж · 60 мин" })).not.toBeInTheDocument();
    hiddenPriceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(hiddenPriceLink);
    expect(within(screen.getByRole("dialog", { name: "Детали цены" })).getByRole("heading", { name: "Deep tissue massage · 60 мин" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Активные" }));

    const activePriceLink = within(table).getByRole("link", { name: "Классический массаж · 60 мин" });
    expect(activePriceLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Deep tissue massage · 60 мин" })).not.toBeInTheDocument();
    activePriceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(activePriceLink);
    expect(within(screen.getByRole("dialog", { name: "Детали цены" })).getByRole("heading", { name: "Классический массаж · 60 мин" })).toBeInTheDocument();
  });

  it("uploads and edits a media asset from the media workspace", () => {
    render(<AdminShell activeSection="media" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Загрузить медиа" }));

    const createDialog = screen.getByRole("dialog", { name: "Новое медиа" });
    fireEvent.change(within(createDialog).getByLabelText("Название"), { target: { value: "Арома обложка" } });
    fireEvent.change(within(createDialog).getByLabelText("URL"), { target: { value: "/media/services/relaxing-massage.jpg" } });
    fireEvent.change(within(createDialog).getByLabelText("Папка"), { target: { value: "services" } });
    fireEvent.change(within(createDialog).getByLabelText("Тип"), { target: { value: "Фото" } });
    fireEvent.change(within(createDialog).getByLabelText("Статус"), { target: { value: "Готово" } });
    fireEvent.change(within(createDialog).getByLabelText("Alt-текст"), { target: { value: "Арома массаж в кабинете Magic Massage Natali" } });
    fireEvent.change(within(createDialog).getByLabelText("Использование"), { target: { value: "Услуга: Арома массаж, Hero сайта" } });
    fireEvent.change(within(createDialog).getByLabelText("Размер файла"), { target: { value: "410 KB" } });
    fireEvent.change(within(createDialog).getByLabelText("Разрешение"), { target: { value: "1600x1100" } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Сохранить медиа" }));

    expect(screen.queryByRole("dialog", { name: "Новое медиа" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Арома обложка" })).toHaveAttribute(
      "href",
      `/admin?section=media&role=owner&media=${encodeURIComponent("media-арома-обложка")}`,
    );

    const details = screen.getByLabelText("Детали медиа");
    expect(within(details).getByRole("heading", { name: "Арома обложка" })).toBeInTheDocument();
    expect(within(details).getByText("/media/services/relaxing-massage.jpg")).toBeInTheDocument();
    expect(within(details).getByText("Услуга: Арома массаж")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать медиа" });
    fireEvent.change(within(editDialog).getByLabelText("Статус"), { target: { value: "Требует alt" } });
    fireEvent.change(within(editDialog).getByLabelText("Alt-текст"), { target: { value: "Нужно уточнить alt перед публикацией" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать медиа" })).not.toBeInTheDocument();
    expect(within(details).getByText("Требует alt")).toBeInTheDocument();
    expect(within(details).getByText("Нужно уточнить alt перед публикацией")).toBeInTheDocument();
  });

  it("filters media rows by type and missing alt state", () => {
    render(<AdminShell activeSection="media" role="owner" />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Классический массаж" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Документы" }));

    expect(screen.getByRole("button", { name: "Документы" })).toHaveAttribute("aria-pressed", "true");
    const certificateMediaLink = within(table).getByRole("link", { name: "Сертификат Natali" });
    expect(certificateMediaLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Классический массаж" })).not.toBeInTheDocument();
    certificateMediaLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(certificateMediaLink);
    expect(within(screen.getByRole("dialog", { name: "Детали медиа" })).getByRole("heading", { name: "Сертификат Natali" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Требует alt" }));

    const needsAltMediaLink = within(table).getByRole("link", { name: "Фото кабинета" });
    expect(needsAltMediaLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Сертификат Natali" })).not.toBeInTheDocument();
    needsAltMediaLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(needsAltMediaLink);
    expect(within(screen.getByRole("dialog", { name: "Детали медиа" })).getByRole("heading", { name: "Фото кабинета" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "Детали медиа" })).getByRole("img", { name: "Фото кабинета" })).toBeInTheDocument();
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

  it("shows the next calendar appointment in the selected client card", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const nextAppointment = within(card).getByLabelText("Ближайшая запись клиента");

    expect(within(nextAppointment).getByRole("heading", { name: "Ближайшая запись" })).toBeInTheDocument();
    expect(within(nextAppointment).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(nextAppointment).getByText("Deep tissue massage")).toBeInTheDocument();
    expect(within(nextAppointment).getByText("Уточнить шею и плечи перед началом сеанса.")).toBeInTheDocument();
    expect(within(nextAppointment).getByRole("link", { name: "Открыть запись" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=Olena%20K.&appointment=demo-3",
    );
  });

  it("summarizes the selected client working profile with related records", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const profile = within(card).getByLabelText("Рабочий профиль клиента");

    expect(within(profile).getByRole("heading", { name: "Рабочий профиль" })).toBeInTheDocument();
    expect(within(profile).getByText("Последний завершенный визит")).toBeInTheDocument();
    expect(within(profile).getByText("24 июня, 18:30")).toBeInTheDocument();
    expect(within(profile).getByText("Ближайшая запись")).toBeInTheDocument();
    expect(within(profile).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(profile).getByText("Активный сертификат")).toBeInTheDocument();
    expect(within(profile).getByText("MMN-2407-1023 · 250 €")).toBeInTheDocument();
    expect(within(profile).getByText(/вечерние слоты и сильное давление/)).toBeInTheDocument();
    expect(within(profile).getByRole("link", { name: "Открыть ближайшую запись" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=Olena%20K.&appointment=demo-3",
    );
    expect(within(profile).getByRole("link", { name: "Открыть активный сертификат" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
    expect(within(profile).getByRole("link", { name: "Все записи клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=Olena%20K.",
    );
    expect(within(profile).getByRole("link", { name: "Все сертификаты клиента" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&client=Olena%20K.",
    );
  });

  it("highlights the next operational client action", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const nextAction = within(card).getByLabelText("Следующее действие клиента");

    expect(within(nextAction).getByRole("heading", { name: "Подготовить PDF сертификата" })).toBeInTheDocument();
    expect(within(nextAction).getByText("MMN-2407-1023 · 250 €")).toBeInTheDocument();
    expect(within(nextAction).getByText("Ожидает PDF")).toBeInTheDocument();
    expect(within(nextAction).getByRole("link", { name: "Открыть сертификат" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
  });

  it("offers appointment creation when the selected client has no upcoming appointment", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Maria Georgieva" />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const nextAction = within(card).getByLabelText("Следующее действие клиента");

    expect(within(nextAction).getByRole("heading", { name: "Записать клиента" })).toBeInTheDocument();
    expect(within(nextAction).getByText("В календаре нет будущей записи для этого клиента.")).toBeInTheDocument();
    expect(within(nextAction).getByRole("link", { name: "Создать запись" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=Maria%20Georgieva&action=create",
    );
  });

  it("filters the selected client working activity feed", async () => {
    const user = userEvent.setup();

    const { rerender } = render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const feed = within(card).getByLabelText("Рабочая лента клиента");

    expect(within(feed).getByRole("heading", { name: "Рабочая лента" })).toBeInTheDocument();
    expect(within(feed).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(feed).getByText("MMN-2407-1023")).toBeInTheDocument();
    expect(within(feed).getByText(/Предпочитает вечерние слоты/)).toBeInTheDocument();
    expect(within(feed).getByRole("link", { name: "Открыть запись 8 июля, 15:00" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=Olena%20K.&appointment=demo-3",
    );
    expect(within(feed).getByRole("link", { name: "Открыть сертификат MMN-2407-1023" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );

    await user.click(within(feed).getByRole("button", { name: "Сертификаты" }));

    expect(within(feed).getByText("MMN-2407-1023")).toBeInTheDocument();
    expect(within(feed).queryByText("8 июля, 15:00")).not.toBeInTheDocument();
    expect(within(feed).queryByText(/Предпочитает вечерние слоты/)).not.toBeInTheDocument();

    await user.click(within(feed).getByRole("button", { name: "Заметки" }));

    expect(within(feed).getByText(/Предпочитает вечерние слоты/)).toBeInTheDocument();
    expect(within(feed).queryByText("MMN-2407-1023")).not.toBeInTheDocument();

    rerender(<AdminShell activeSection="clients" role="owner" selectedClientName="Maria Georgieva" />);

    const updatedFeed = within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByLabelText("Рабочая лента клиента");
    await waitFor(() => expect(within(updatedFeed).getByRole("button", { name: "Все" })).toHaveAttribute("aria-pressed", "true"));
    expect(within(updatedFeed).getByText("2 июля, 14:00")).toBeInTheDocument();
    expect(within(updatedFeed).getByText("MMN-2407-1022")).toBeInTheDocument();
  });

  it("opens the calendar scoped to the selected client", () => {
    render(<AdminShell activeSection="calendar" role="owner" selectedClientName="Olena K." />);

    const context = screen.getByLabelText("Фильтр календаря по клиенту");
    expect(within(context).getByText("Показаны записи клиента Olena K.")).toBeInTheDocument();
    expect(within(context).getByRole("link", { name: "Сбросить фильтр" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner",
    );
    expect(within(context).getByRole("link", { name: "Открыть карточку клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=Olena%20K.",
    );
    expect(screen.getByRole("heading", { name: "8 июля" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Olena K.*Deep tissue massage/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Анна Петрова/ })).not.toBeInTheDocument();
  });

  it("opens the certificate workspace scoped to the selected client", () => {
    render(<AdminShell activeSection="certificates" role="owner" selectedClientName="Olena K." />);

    const context = screen.getByLabelText("Фильтр сертификатов по клиенту");
    const table = screen.getByRole("table");
    expect(within(context).getByText("Показаны сертификаты клиента Olena K.")).toBeInTheDocument();
    expect(within(context).getByRole("link", { name: "Сбросить фильтр" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner",
    );
    expect(within(context).getByRole("link", { name: "Открыть карточку клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=Olena%20K.",
    );
    expect(within(table).getByRole("row", { name: /MMN-2407-1023/ })).toBeInTheDocument();
    expect(within(table).queryByRole("row", { name: /MMN-2407-1021/ })).not.toBeInTheDocument();
  });

  it("issues a prefilled certificate from the selected client card", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.click(within(card).getByRole("button", { name: "Выдать сертификат" }));

    const dialog = screen.getByRole("dialog", { name: "Новый сертификат" });
    expect(within(dialog).getByLabelText("Код")).toHaveValue("MMN-2407-1024");
    expect(within(dialog).getByLabelText("Покупатель")).toHaveValue("Olena K.");
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
    expect(within(dialog).getByLabelText("Получатель")).toHaveValue("Olena K.");
    expect(within(dialog).getByLabelText("Заметка")).toHaveValue("Выдано из карточки клиента Olena K.");

    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "95 €" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить сертификат" }));

    expect(screen.queryByRole("dialog", { name: "Новый сертификат" })).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "MMN-2407-1024" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1024",
    );
    expect(within(card).getByText("95 €")).toBeInTheDocument();
    expect(within(card).getAllByText("Оплачено").length).toBeGreaterThan(0);
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
    expect(within(card).getAllByText(/напоминать за 2 часа/).length).toBeGreaterThan(0);
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
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Ирина Тестова" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=%D0%98%D1%80%D0%B8%D0%BD%D0%B0%20%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0",
    );

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(card).getByText("+359 88 777 1122")).toBeInTheDocument();
    expect(within(card).getByText("irina@example.com")).toBeInTheDocument();
    expect(within(card).getByText("BG · Новый клиент")).toBeInTheDocument();
    expect(within(card).getAllByText(/предпочитает дневные слоты/).length).toBeGreaterThan(0);
    expect(within(card).getByText("new")).toBeInTheDocument();
  });

  it("validates required client fields before saving", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));
    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });

    expect(within(dialog).getByRole("group", { name: "Контакты клиента" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Профиль и активность" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Заметки и теги" })).toBeInTheDocument();
    expect(within(dialog).getByText("Имя и телефон нужны для записи и связи с клиентом.")).toBeInTheDocument();
    expect(within(dialog).getByText("Активный клиент: 5+ визитов или ближайшая подтвержденная запись.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Укажите имя и телефон клиента.");
    expect(within(dialog).getByText("Укажите имя клиента.")).toBeInTheDocument();
    expect(within(dialog).getByText("Укажите телефон клиента.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Имя")).toHaveFocus();
    expect(within(dialog).getByLabelText("Имя")).toHaveAttribute("aria-describedby", expect.stringContaining("client-name-error"));
    expect(within(dialog).getByLabelText("Телефон")).toHaveAttribute("aria-describedby", expect.stringContaining("client-phone-error"));
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
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "Olena K." })).toHaveLength(1);
    expect(within(card).getByText("+359 87 333 4499")).toBeInTheDocument();
    expect(within(card).getByText("olena.updated@example.com")).toBeInTheDocument();
    expect(within(card).getAllByText("Email").length).toBeGreaterThan(0);
    expect(within(card).getAllByText(/Обновленная заметка/).length).toBeGreaterThan(0);
    expect(within(card).getByText("email")).toBeInTheDocument();
  });

  it("opens selected appointment details in a right drawer", async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminShell activeSection="calendar" role="owner" />);

    expect(container.querySelector(".admin-calendar-workspace")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Детали выбранной записи" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    const details = screen.getByRole("dialog", { name: "Детали выбранной записи" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(details).getByText("Deep tissue massage")).toBeInTheDocument();
    expect(within(details).getByText(/Уточнить шею и плечи/)).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Закрыть" }));

    expect(screen.queryByRole("dialog", { name: "Детали выбранной записи" })).not.toBeInTheDocument();
  });

  it("opens route-focused appointment details from the appointment query", () => {
    render(
      <AdminShell
        activeSection="calendar"
        role="owner"
        selectedAppointmentKey="demo-3"
        selectedCalendarDate="2026-07-08"
        selectedClientName="Olena K."
      />,
    );

    expect(screen.getByRole("heading", { name: "8 июля" })).toBeInTheDocument();
    expect(screen.getByLabelText("Фильтр календаря по клиенту")).toHaveTextContent("Показаны записи клиента Olena K.");
    const details = screen.getByRole("dialog", { name: "Детали выбранной записи" });
    expect(within(details).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(details).getByText("Deep tissue massage")).toBeInTheDocument();
    expect(within(details).getByText("15:00")).toBeInTheDocument();
  });

  it("links from a calendar appointment to the matching client card", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    expect(
      within(screen.getByLabelText("Детали выбранной записи")).getByRole("link", { name: "Открыть клиента" }),
    ).toHaveAttribute("href", "/admin?section=clients&role=owner&client=Olena%20K.");
    const linkedActions = within(screen.getByLabelText("Детали выбранной записи")).getByLabelText("Связанные действия клиента");
    expect(within(linkedActions).getByRole("link", { name: "Карточка клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=Olena%20K.",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все записи клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=Olena%20K.",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все сертификаты клиента" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&client=Olena%20K.",
    );
    expect(within(linkedActions).getByRole("link", { name: "Записать снова" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=Olena%20K.&action=create",
    );
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
    expect(within(monthGrid).getAllByText("2 зап.").length).toBeGreaterThan(0);
    expect(within(monthGrid).getAllByText("2 св.").length).toBeGreaterThan(0);

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
    expect(within(weekGrid).getByText("2 зап.").closest(".admin-week-day-stats")).toBeInTheDocument();
    expect(within(weekGrid).getByText("Анна Петрова").closest(".admin-week-appointment-main")).toBeInTheDocument();
  });

  it("shows an empty state when a month day has no appointments", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    await user.click(screen.getByRole("button", { name: /^7 июля.*0 записей/ }));

    expect(screen.getByRole("heading", { name: "7 июля" })).toBeInTheDocument();
    expect(screen.getByText("Записи не найдены.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Детали выбранной записи" })).not.toBeInTheDocument();
    expect(screen.queryByText("Анна Петрова")).not.toBeInTheDocument();
  });

  it("keeps day mode focused on one day and list mode on all appointments", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    expect(screen.getByRole("heading", { name: "6 июля" })).toBeInTheDocument();
    expect(screen.getByLabelText("Таймлайн дня")).toHaveClass("admin-day-timeline");
    expect(screen.getAllByText("Буфер после сеанса: 30 минут")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Olena K./ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Список" }));

    expect(screen.getByRole("heading", { name: "Список записей" })).toBeInTheDocument();
    expect(screen.getByLabelText("Лента всех записей")).toHaveClass("admin-appointment-feed");
    expect(screen.getByText("Всего записей")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Olena K./ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Таймлайн дня")).not.toBeInTheDocument();
  });

  it("opens the calendar on the selected date from the date query", () => {
    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-10" />);

    expect(screen.getByRole("heading", { name: "10 июля" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "День" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Светлана/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Анна Петрова/ })).not.toBeInTheDocument();
  });

  it("prefills appointment creation with the calendar date query", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-10" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Дата")).toHaveValue("2026-07-10");
  });

  it("prefills appointment creation with the day selected in month view", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    await user.click(screen.getByRole("button", { name: /^7 июля.*0 записей/ }));
    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Дата")).toHaveValue("2026-07-07");
  });

  it("opens a quick action panel from the primary action", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="dashboard" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Быстрое действие" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Создать запись")).toBeInTheDocument();
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
    const createdDetails = screen.getByRole("dialog", { name: "Детали выбранной записи" });
    expect(within(createdDetails).getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    await user.click(within(createdDetails).getByRole("button", { name: "Закрыть" }));

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Ирина Тестова/ }));

    expect(screen.getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText("SPA процедура")).toBeInTheDocument();
  });

  it("selects a newly created appointment immediately after saving", async () => {
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

    const details = screen.getByLabelText("Детали выбранной записи");
    expect(screen.queryByRole("dialog", { name: "Новая запись" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "12 июля" })).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(details).getByText("SPA процедура")).toBeInTheDocument();
    expect(within(details).getByText("11:15")).toBeInTheDocument();
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

  it("edits public contact settings from the contacts workspace", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="contacts" role="owner" />);

    expect(screen.getByRole("heading", { name: "Контактные настройки сайта" })).toBeInTheDocument();
    const phoneLink = within(screen.getByRole("table")).getByRole("link", { name: "Телефон салона" });
    phoneLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(phoneLink);
    const details = screen.getByRole("dialog", { name: "Детали контакта" });
    expect(details).toHaveTextContent("Телефон салона");

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Контактные настройки" });
    await user.clear(within(dialog).getByLabelText("Телефон"));
    await user.type(within(dialog).getByLabelText("Телефон"), "+359 87 555 0000");
    await user.clear(within(dialog).getByLabelText("Адрес"));
    await user.type(within(dialog).getByLabelText("Адрес"), "ул. Места 49, Бургас");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить контакты" }));

    expect(screen.queryByRole("dialog", { name: "Контактные настройки" })).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Контактные настройки")).getByText("+359 87 555 0000")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Контактные настройки")).getByText("ул. Места 49, Бургас")).toBeInTheDocument();
    expect(within(details).getByText("+359 87 555 0000")).toBeInTheDocument();
  });

  it("filters contact channels and edits the selected channel", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="contacts" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Мессенджеры" }));

    const table = screen.getByRole("table");
    expect(screen.getByRole("button", { name: "Мессенджеры" })).toHaveAttribute("aria-pressed", "true");
    const telegramLink = within(table).getByRole("link", { name: "Telegram" });
    expect(telegramLink).toHaveAttribute("href", "/admin?section=contacts&role=owner&contact=contact-telegram");
    expect(within(table).queryByRole("link", { name: "Google Maps" })).not.toBeInTheDocument();

    telegramLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(telegramLink);
    const details = screen.getByLabelText("Детали контакта");
    expect(within(details).getByRole("heading", { name: "Telegram" })).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Редактировать" }));

    const dialog = screen.getByRole("dialog", { name: "Редактировать контакт" });
    await user.clear(within(dialog).getByLabelText("Значение"));
    await user.type(within(dialog).getByLabelText("Значение"), "https://t.me/magicmassage_burgas");
    await user.selectOptions(within(dialog).getByLabelText("Статус"), "Активен");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать контакт" })).not.toBeInTheDocument();
    expect(within(details).getByText("https://t.me/magicmassage_burgas")).toBeInTheDocument();
    expect(within(details).getByText("Активен")).toBeInTheDocument();
  });

  it("creates and edits a blog article from the blog workspace", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="blog" role="owner" />);

    expect(screen.getByRole("heading", { name: "Контент-план блога" })).toBeInTheDocument();
    const firstPostLink = within(screen.getByRole("table")).getByRole("link", { name: "Подготовка к первому массажу" });
    expect(firstPostLink).toHaveAttribute("href", "/admin?section=blog&role=owner&blog=blog-first-massage-preparation");
    firstPostLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(firstPostLink);
    expect(screen.getByRole("dialog", { name: "Детали статьи" })).toHaveTextContent("Подготовка к первому массажу");

    await user.click(screen.getByRole("button", { name: "Новая статья" }));

    const createDialog = screen.getByRole("dialog", { name: "Новая статья" });
    fireEvent.change(within(createDialog).getByLabelText("Заголовок"), { target: { value: "Как подготовиться к массажу" } });
    fireEvent.change(within(createDialog).getByLabelText("Slug"), { target: { value: "prepare-for-massage" } });
    fireEvent.change(within(createDialog).getByLabelText("Категория"), { target: { value: "Советы" } });
    fireEvent.change(within(createDialog).getByLabelText("Статус"), { target: { value: "Черновик" } });
    fireEvent.change(within(createDialog).getByLabelText("Автор"), { target: { value: "Natali" } });
    fireEvent.change(within(createDialog).getByLabelText("Дата публикации"), { target: { value: "2026-07-20" } });
    fireEvent.change(within(createDialog).getByLabelText("Локали"), { target: { value: "ru, bg" } });
    fireEvent.change(within(createDialog).getByLabelText("SEO title"), {
      target: { value: "Как подготовиться к массажу в Бургасе" },
    });
    fireEvent.change(within(createDialog).getByLabelText("Обложка"), { target: { value: "/media/blog/prepare-for-massage.jpg" } });
    fireEvent.change(within(createDialog).getByLabelText("Краткое описание"), {
      target: { value: "Короткая памятка перед первым визитом." },
    });
    fireEvent.change(within(createDialog).getByLabelText("Текст статьи"), {
      target: { value: "Памятка помогает клиенту прийти вовремя и выбрать комфортную одежду." },
    });
    fireEvent.change(within(createDialog).getByLabelText("Теги"), { target: { value: "подготовка, массаж" } });
    await user.click(within(createDialog).getByRole("button", { name: "Сохранить статью" }));

    expect(screen.queryByRole("dialog", { name: "Новая статья" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Как подготовиться к массажу" })).toHaveAttribute(
      "href",
      "/admin?section=blog&role=owner&blog=blog-prepare-for-massage",
    );

    const details = screen.getByLabelText("Детали статьи");
    expect(within(details).getByRole("heading", { name: "Как подготовиться к массажу" })).toBeInTheDocument();
    expect(within(details).getByText("prepare-for-massage")).toBeInTheDocument();
    expect(within(details).getByText("Короткая памятка перед первым визитом.")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать статью" });
    fireEvent.change(within(editDialog).getByLabelText("Статус"), { target: { value: "Опубликована" } });
    fireEvent.change(within(editDialog).getByLabelText("Краткое описание"), {
      target: { value: "Обновленная памятка перед визитом." },
    });
    await user.click(within(editDialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать статью" })).not.toBeInTheDocument();
    expect(within(details).getByText("Опубликована")).toBeInTheDocument();
    expect(within(details).getByText("Обновленная памятка перед визитом.")).toBeInTheDocument();
  });

  it("filters blog posts by status and global search", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="blog" role="owner" />);

    const filters = screen.getByLabelText("Фильтры блога");
    const table = screen.getByRole("table");

    await user.click(within(filters).getByRole("button", { name: "Черновики" }));

    expect(within(filters).getByRole("button", { name: "Черновики" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("link", { name: "Лимфодренаж: когда он уместен" })).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Подготовка к первому массажу" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск" }), { target: { value: "сертификат" } });

    expect(within(table).queryByRole("link", { name: "Лимфодренаж: когда он уместен" })).not.toBeInTheDocument();

    await user.click(within(filters).getByRole("button", { name: "Запланированные" }));
    expect(within(table).getByRole("link", { name: "Подарочный сертификат без стресса" })).toHaveAttribute(
      "href",
      "/admin?section=blog&role=owner&blog=blog-gift-certificate",
    );
  });

  it("edits booking and Google Calendar settings from the settings workspace", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    expect(screen.getByRole("heading", { name: "Настройки админки" })).toBeInTheDocument();
    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    expect(bookingLink).toHaveAttribute("href", "/admin?section=settings&role=owner&settings=booking");
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(within(details).getByRole("heading", { name: "Запись и календарь" })).toBeInTheDocument();
    expect(within(details).getByText("30 минут")).toBeInTheDocument();
    expect(within(details).getByText("Внутренний календарь главный")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    fireEvent.change(within(dialog).getByLabelText("Перерыв между сеансами"), { target: { value: "45" } });
    fireEvent.change(within(dialog).getByLabelText("Слотов в день"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Google Calendar"), { target: { value: "Односторонняя" } });
    fireEvent.change(within(dialog).getByLabelText("Google Calendar ID"), { target: { value: "natali@example.com" } });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    expect(screen.queryByRole("dialog", { name: "Настройки админки" })).not.toBeInTheDocument();
    expect(within(details).getByText("45 минут")).toBeInTheDocument();
    expect(within(details).getByText("5 слотов")).toBeInTheDocument();
    expect(within(details).getByText("Односторонняя")).toBeInTheDocument();
    expect(within(details).getByText("natali@example.com")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Настройки сохранены.");
  });

  it("uses saved booking settings for calendar slot availability", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AdminShell activeSection="settings" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    fireEvent.change(within(dialog).getByLabelText("Перерыв между сеансами"), { target: { value: "45" } });
    fireEvent.change(within(dialog).getByLabelText("Слотов в день"), { target: { value: "5" } });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    rerender(<AdminShell activeSection="calendar" role="owner" />);
    await user.click(screen.getByRole("button", { name: "Месяц" }));

    const monthGrid = screen.getByRole("grid", { name: "Месяц Июль 2026" });
    expect(within(monthGrid).getByRole("button", { name: /6 июля.*2 записи.*3 свободных слота/ })).toBeInTheDocument();

    const monthPlan = screen.getByLabelText("План месяца");
    expect(within(monthPlan).getByText("5 слотов в день")).toBeInTheDocument();
    expect(within(monthPlan).getByText(/45 минут/)).toBeInTheDocument();
  });

  it("keeps settings details synchronized with search results", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "Stripe");

    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(within(details).getByRole("heading", { name: "Платежи" })).toBeInTheDocument();
    expect(within(details).getByText("EUR")).toBeInTheDocument();
    expect(within(details).getByText("Тестовый")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Поиск" }));
    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "нет такого раздела");

    expect(screen.getByText("Настройки не найдены.")).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Ничего не найдено" })).toBeInTheDocument();
  });

  it("moves keyboard focus into the settings dialog", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    await waitFor(() => expect(within(dialog).getByRole("heading", { name: "Настройки админки" })).toHaveFocus());
  });

  it("rejects invalid numeric settings", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    fireEvent.change(within(dialog).getByLabelText("Перерыв между сеансами"), { target: { value: "-5" } });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    expect(screen.getByRole("dialog", { name: "Настройки админки" })).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Укажите название, буфер записи, слоты и срок хранения audit log.");
    expect(within(dialog).getByLabelText("Перерыв между сеансами")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("dialog", { name: "Детали настроек" })).toHaveTextContent("30 минут");
  });

  it("switches settings groups and confirms dangerous settings actions", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const rolesAuditLink = within(screen.getByRole("table")).getByRole("link", { name: "Роли и аудит" });
    expect(rolesAuditLink).toHaveAttribute("href", "/admin?section=settings&role=owner&settings=rolesAudit");
    rolesAuditLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(rolesAuditLink);

    const details = screen.getByLabelText("Детали настроек");
    expect(within(details).getByRole("heading", { name: "Роли и аудит" })).toBeInTheDocument();
    expect(within(details).getByText("Бухгалтер: только Stripe-отчеты")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Сбросить демо-данные" }));

    const confirmDialog = screen.getByRole("dialog", { name: "Подтвердить действие" });
    expect(within(confirmDialog).getByText("Опасное действие не выполняется без подтверждения владельца.")).toBeInTheDocument();
    await user.click(within(confirmDialog).getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("dialog", { name: "Подтвердить действие" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Действие записано в audit log.");
  });

  it("invites and edits an admin user with the accountant role", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="users" role="owner" />);

    expect(screen.getByRole("heading", { name: "Пользователи админки" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Детали пользователя")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Пригласить" }));

    const createDialog = screen.getByRole("dialog", { name: "Пригласить пользователя" });
    await user.type(within(createDialog).getByLabelText("Имя"), "Елена Бухгалтер");
    await user.type(within(createDialog).getByLabelText("Email"), "accountant@example.com");
    await user.selectOptions(within(createDialog).getByLabelText("Роль"), "accountant");
    await user.type(within(createDialog).getByLabelText("Комментарий доступа"), "Доступ только для налоговой выгрузки Stripe.");
    await user.click(within(createDialog).getByRole("button", { name: "Отправить приглашение" }));

    expect(screen.queryByRole("dialog", { name: "Пригласить пользователя" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Елена Бухгалтер" })).toHaveAttribute(
      "href",
      "/admin?section=users&role=owner&user=admin-user-accountant-example-com",
    );

    const details = screen.getByLabelText("Детали пользователя");
    expect(within(details).getByRole("heading", { name: "Елена Бухгалтер" })).toBeInTheDocument();
    expect(within(details).getByText("Бухгалтер")).toBeInTheDocument();
    expect(within(details).getByText("Stripe-продажи за период")).toBeInTheDocument();
    expect(within(details).getByText("Экспорт CSV/XLSX/PDF")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать пользователя" });
    await user.selectOptions(within(editDialog).getByLabelText("Статус"), "Активен");
    await user.clear(within(editDialog).getByLabelText("Комментарий доступа"));
    await user.type(within(editDialog).getByLabelText("Комментарий доступа"), "Доступ подтвержден владельцем для налоговой отчетности.");
    await user.click(within(editDialog).getByRole("button", { name: "Сохранить пользователя" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать пользователя" })).not.toBeInTheDocument();
    expect(within(details).getByText("Активен")).toBeInTheDocument();
    expect(within(details).getByText("Доступ подтвержден владельцем для налоговой отчетности.")).toBeInTheDocument();
  });

  it("rejects an invalid admin user email", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="users" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Пригласить" }));

    const dialog = screen.getByRole("dialog", { name: "Пригласить пользователя" });
    await user.type(within(dialog).getByLabelText("Имя"), "Bad Email");
    await user.type(within(dialog).getByLabelText("Email"), "not-an-email");
    await user.click(within(dialog).getByRole("button", { name: "Отправить приглашение" }));

    expect(screen.getByRole("dialog", { name: "Пригласить пользователя" })).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Укажите имя и корректный email пользователя.");
    expect(within(dialog).getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("filters admin users by accountant access and global search", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="users" role="owner" />);

    const filters = screen.getByLabelText("Фильтры пользователей");
    const table = screen.getByRole("table");

    await user.click(within(filters).getByRole("button", { name: "Бухгалтеры" }));

    expect(within(filters).getByRole("button", { name: "Бухгалтеры" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("link", { name: "Ирина Finance" })).toHaveAttribute(
      "href",
      "/admin?section=users&role=owner&user=admin-user-accountant",
    );
    expect(within(table).queryByRole("link", { name: "Natali Ivanova" })).not.toBeInTheDocument();
    const accountantLink = within(table).getByRole("link", { name: "Ирина Finance" });
    accountantLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(accountantLink);
    expect(screen.getByRole("dialog", { name: "Детали пользователя" })).toHaveTextContent("Stripe-продажи за период");

    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "stripe");

    expect(within(table).getByRole("link", { name: "Ирина Finance" })).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Мария Контент" })).not.toBeInTheDocument();
  });
});
