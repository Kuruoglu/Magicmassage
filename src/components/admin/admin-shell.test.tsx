import { render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText("audit log")).toBeInTheDocument();
  });
});
