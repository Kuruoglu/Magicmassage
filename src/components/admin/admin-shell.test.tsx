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

  it("updates the calendar detail panel when an appointment is selected", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    expect(screen.getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText("Deep tissue massage")).toBeInTheDocument();
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
