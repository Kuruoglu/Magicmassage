import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { getHomeContent } from "@/content/home";
import { PublicPageShell } from "./public-page-shell";

describe("PublicPageShell", () => {
  it("uses dedicated routes and marks the current page", () => {
    render(
      <PublicPageShell
        locale="ru"
        currentPage="services"
        content={getHomeContent("ru")}
      >
        <main>Catalog</main>
      </PublicPageShell>,
    );

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Главная" })).toHaveAttribute("href", "/ru");
    expect(screen.getByRole("link", { name: "Массажи" })).toHaveAttribute("href", "/ru/services");
    expect(screen.getByRole("link", { name: "Массажи" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Обо мне" })).toHaveAttribute("href", "/ru/about");
    expect(screen.getByRole("link", { name: "Контакты" })).toHaveAttribute("href", "/ru/contacts");
  });

  it("preserves the selected public page when switching locale", () => {
    render(
      <PublicPageShell
        locale="ru"
        currentPage="contacts"
        content={getHomeContent("ru")}
      >
        <main>Contacts</main>
      </PublicPageShell>,
    );

    expect(screen.getByRole("link", { name: "BG" })).toHaveAttribute("href", "/bg/contacts");
    expect(screen.getByRole("link", { name: "UA" })).toHaveAttribute("href", "/ua/contacts");
    expect(screen.getByRole("link", { name: "Записаться" })).toHaveAttribute("href", "/ru#booking");
  });

  it("opens a left mobile menu with page, locale, and booking links", async () => {
    const user = userEvent.setup();

    render(
      <PublicPageShell
        locale="ru"
        currentPage="contacts"
        content={getHomeContent("ru")}
      >
        <main>Contacts</main>
      </PublicPageShell>,
    );

    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Контакты" })[1]).toHaveAttribute(
      "href",
      "/ru/contacts",
    );
    expect(screen.getAllByRole("link", { name: "Контакты" })[1]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: "BG" })[1]).toHaveAttribute("href", "/bg/contacts");
    expect(screen.getAllByRole("link", { name: "Записаться" })[1]).toHaveAttribute(
      "href",
      "/ru#booking",
    );
  });
});
