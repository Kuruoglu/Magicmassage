import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { studio24BookingUrl } from "@/config/booking";
import { messengerLinks } from "@/config/messengers";
import { getHomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import { PublicPageShell } from "./public-page-shell";

describe("PublicPageShell", () => {
  it("uses dedicated routes and exposes the services dropdown", async () => {
    const user = userEvent.setup();
    const content = getHomeContent("ru");

    render(
      <PublicPageShell locale="ru" currentPage="services" content={content}>
        <main>Catalog</main>
      </PublicPageShell>,
    );

    const primaryNav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(primaryNav).toBeInTheDocument();
    expect(within(primaryNav).getByRole("link", { name: "Главная" })).toHaveAttribute("href", "/ru");
    expect(within(primaryNav).getByRole("link", { name: "Обо мне" })).toHaveAttribute("href", "/ru/about");
    expect(within(primaryNav).getByRole("link", { name: "Контакты" })).toHaveAttribute("href", "/ru/contacts");

    await user.click(within(primaryNav).getByText("Массажи"));

    expect(screen.getByRole("link", { name: content.services.action })).toHaveAttribute(
      "href",
      "/ru/services",
    );
    expect(screen.getByRole("link", { name: "Классический массаж" })).toHaveAttribute(
      "href",
      "/ru/services/classic-massage",
    );
  });

  it("uses a language selector that preserves the selected public page", async () => {
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

    await user.click(screen.getByLabelText("Language selector"));

    expect(screen.getByRole("link", { name: "BG" })).toHaveAttribute("href", "/bg/contacts");
    expect(screen.getByRole("link", { name: "UA" })).toHaveAttribute("href", "/ua/contacts");
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("href", "/en/contacts");
    expect(screen.getByRole("link", { name: "Записаться" })).toHaveAttribute(
      "href",
      studio24BookingUrl,
    );
  });

  it("opens a left mobile menu with services and language links", async () => {
    const user = userEvent.setup();
    const service = getPublicPagesContent("ru").services.items[0];

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
    const mobileMenu = screen.getByRole("complementary");
    const mobileNav = within(mobileMenu).getByRole("navigation", { name: "Mobile navigation" });
    expect(within(mobileNav).getByRole("link", { name: "Контакты" })).toHaveAttribute(
      "href",
      "/ru/contacts",
    );
    expect(within(mobileMenu).getByRole("link", { name: "BG" })).toHaveAttribute(
      "href",
      "/bg/contacts",
    );
    expect(within(mobileMenu).getByRole("link", { name: "RU" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(mobileMenu).getByRole("link", { name: "UA" })).toHaveAttribute(
      "href",
      "/ua/contacts",
    );
    expect(within(mobileMenu).getByRole("link", { name: "EN" })).toHaveAttribute(
      "href",
      "/en/contacts",
    );

    await user.click(within(mobileNav).getByText("Массажи"));

    expect(within(mobileNav).getByRole("link", { name: service.title })).toHaveAttribute(
      "href",
      "/ru/services/classic-massage",
    );
    expect(within(mobileMenu).getByRole("link", { name: "Записаться" })).toHaveAttribute(
      "href",
      studio24BookingUrl,
    );
    expect(within(mobileMenu).getByRole("link", { name: "Telegram" })).toHaveAttribute(
      "href",
      messengerLinks.telegram.href,
    );
    expect(within(mobileMenu).getByRole("link", { name: "Viber" })).toHaveAttribute(
      "href",
      messengerLinks.viber.href,
    );
  });
});
