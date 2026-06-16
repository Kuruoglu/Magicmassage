import { render, screen } from "@testing-library/react";
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
});
