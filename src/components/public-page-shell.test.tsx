import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { studio24BookingUrl } from "@/config/booking";
import { messengerLinks } from "@/config/messengers";
import { getHomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import { cloneBusinessHoursSchedule } from "@/lib/business-hours";
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
    expect(within(primaryNav).getByRole("link", { name: "Сертификаты" })).toHaveAttribute("href", "/ru/gift-certificates");
    expect(within(primaryNav).getByRole("link", { name: "Блог" })).toHaveAttribute("href", "/ru/blog");
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
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/ru/privacy");
    expect(screen.getByRole("link", { name: "Cookies" })).toHaveAttribute("href", "/ru/cookies");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/ru/terms");
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
    expect(within(mobileNav).getByRole("link", { name: "Сертификаты" })).toHaveAttribute(
      "href",
      "/ru/gift-certificates",
    );
    expect(within(mobileNav).getByRole("link", { name: "Блог" })).toHaveAttribute(
      "href",
      "/ru/blog",
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

  it("keeps Studio24 as the default and switches header CTAs only when public booking is enabled", () => {
    const content = getHomeContent("en");
    const { rerender } = render(
      <PublicPageShell locale="en" currentPage="home" content={content}>
        <main>Home</main>
      </PublicPageShell>,
    );

    expect(screen.getByRole("link", { name: content.navigation.booking })).toHaveAttribute(
      "href",
      studio24BookingUrl,
    );

    rerender(
      <PublicPageShell locale="en" currentPage="home" content={content} publicBookingEnabled>
        <main>Home</main>
      </PublicPageShell>,
    );

    expect(screen.getByRole("link", { name: content.navigation.booking })).toHaveAttribute(
      "href",
      "/en/booking",
    );
  });

  it("renders the current admin-managed address, phone, Viber link, and footer schedule", async () => {
    const user = userEvent.setup();
    const schedule = cloneBusinessHoursSchedule();
    schedule[5].closesAt = "17:00";

    render(
      <PublicPageShell
        businessDetails={{
          address: "ул. Места 50, Бургас",
          businessName: "Magic Massage Natali",
          phone: "+359 89 677 8308",
          seoArea: "Burgas, Bulgaria",
          updatedAt: "2026-07-18T10:00:00.000Z",
          workingSchedule: schedule,
        }}
        locale="ru"
        currentPage="home"
        content={getHomeContent("ru")}
      >
        <main>Home</main>
      </PublicPageShell>,
    );

    expect(screen.getByText("ул. Места 50, Бургас")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+359 89 677 8308" })).toHaveAttribute(
      "href",
      "tel:+359896778308",
    );
    expect(screen.getByText("Суббота").closest("li")).toHaveTextContent("10:00 - 17:00");

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(screen.getByRole("complementary")).getByRole("link", { name: "Viber" })).toHaveAttribute(
      "href",
      "viber://chat?number=%2B359896778308",
    );
  });

  it("removes gift certificates from desktop and mobile navigation when disabled", async () => {
    const user = userEvent.setup();
    render(
      <PublicPageShell
        locale="ru"
        currentPage="home"
        content={getHomeContent("ru")}
        giftCertificatesEnabled={false}
      >
        <main>Home</main>
      </PublicPageShell>,
    );

    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).queryByRole("link", {
        name: "Сертификаты",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(
      within(screen.getByRole("navigation", { name: "Mobile navigation" })).queryByRole("link", {
        name: "Сертификаты",
      }),
    ).not.toBeInTheDocument();
  });

  it("removes the blog from desktop and mobile navigation when disabled", async () => {
    const user = userEvent.setup();
    render(
      <PublicPageShell
        blogEnabled={false}
        locale="ru"
        currentPage="home"
        content={getHomeContent("ru")}
      >
        <main>Home</main>
      </PublicPageShell>,
    );

    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).queryByRole("link", {
        name: "Блог",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(
      within(screen.getByRole("navigation", { name: "Mobile navigation" })).queryByRole("link", {
        name: "Блог",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps the closed mobile menu inert and focuses the close button when opened", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <PublicPageShell
        locale="ru"
        currentPage="contacts"
        content={getHomeContent("ru")}
      >
        <main>Contacts</main>
      </PublicPageShell>,
    );

    const mobileMenu = screen.getByTestId("mobile-menu");
    expect(mobileMenu).toHaveAttribute("inert");

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    expect(mobileMenu).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(mobileMenu).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(container.querySelector(".mobile-menu-backdrop")!);

    expect(mobileMenu).toHaveAttribute("inert");
    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus());
  });
});
