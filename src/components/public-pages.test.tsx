import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { studio24BookingUrl } from "@/config/booking";
import { messengerLinks } from "@/config/messengers";
import { getPublicPagesContent } from "@/content/public-pages";
import { cloneBusinessHoursSchedule } from "@/lib/business-hours";
import { AboutPageView } from "./about-page-view";
import { ContactsPageView } from "./contacts-page-view";
import { CookieConsentBanner } from "./cookie-consent";
import { ServiceDetailPageView } from "./service-detail-page-view";
import { ServicesPageView } from "./services-page-view";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("localized public page views", () => {
  it("renders the full services catalog", () => {
    const content = getPublicPagesContent("ru");
    render(<ServicesPageView locale="ru" content={content.services} />);

    expect(screen.getByRole("heading", { level: 1, name: content.services.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: content.services.categoryLabels.massage })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: content.services.categoryLabels.partial })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: content.services.categoryLabels.spa })).toBeInTheDocument();
    for (const service of content.services.items) {
      expect(screen.getByRole("heading", { level: 3, name: service.title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link", { name: /Подробнее/ })[0]).toHaveAttribute(
      "href",
      "/ru/services/classic-massage",
    );
  });

  it("renders an individual service page with a booking action", () => {
    const content = getPublicPagesContent("bg");
    const service = content.services.items[0];

    render(
      <ServiceDetailPageView
        locale="bg"
        service={service}
        bookingAction={content.services.bookingAction}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: service.title })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: content.services.bookingAction })[0]).toHaveAttribute(
      "href",
      studio24BookingUrl,
    );
    expect(screen.getByRole("link", { name: /Всички масажи/ })).toHaveAttribute(
      "href",
      "/bg/services",
    );
  });

  it("renders the About story with real photography", () => {
    const content = getPublicPagesContent("ua");
    render(<AboutPageView locale="ua" content={content.about} />);

    expect(screen.getByRole("heading", { level: 1, name: content.about.title })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: content.about.imageAlt })).toBeInTheDocument();
    expect(screen.getByText(content.about.values[0])).toBeInTheDocument();
    expect(screen.getByText(content.about.values[2])).toBeInTheDocument();
  });

  it("links service detail booking actions to the selected service when enabled", () => {
    const content = getPublicPagesContent("en");
    const service = content.services.items[0];

    render(
      <ServiceDetailPageView
        locale="en"
        service={service}
        bookingAction={content.services.bookingAction}
        publicBookingEnabled
      />,
    );

    for (const action of screen.getAllByRole("link", { name: content.services.bookingAction })) {
      expect(action).toHaveAttribute("href", `/en/booking?service=${service.slug}`);
    }
  });

  it("renders About certificates as accessible lazy-loaded images", () => {
    const content = getPublicPagesContent("en");
    render(<AboutPageView locale="en" content={content.about} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: content.about.certificates.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(content.about.certificates.description)).toBeInTheDocument();

    for (const certificate of content.about.certificates.items) {
      const image = screen.getByRole("img", { name: certificate.alt });
      expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain(
        certificate.image.src,
      );
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("width", String(certificate.image.width));
      expect(image).toHaveAttribute("height", String(certificate.image.height));
      expect(screen.getByText(certificate.caption)).toBeInTheDocument();
    }
  });

  it("opens About certificates in a larger viewer", async () => {
    const user = userEvent.setup();
    const content = getPublicPagesContent("en");
    const [firstCertificate, secondCertificate] = content.about.certificates.items;

    render(<AboutPageView locale="en" content={content.about} />);

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(firstCertificate.caption, "i"),
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: content.about.certificates.viewerLabel,
    });

    expect(within(dialog).getByRole("img", { name: firstCertificate.alt })).toBeInTheDocument();
    expect(within(dialog).getByText(firstCertificate.caption)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: content.about.certificates.nextLabel }));

    expect(within(dialog).getByRole("img", { name: secondCertificate.alt })).toBeInTheDocument();
    expect(within(dialog).getByText(secondCertificate.caption)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: content.about.certificates.viewerLabel })).not.toBeInTheDocument();
  });

  it("renders contact facts and a direct call action", () => {
    const content = getPublicPagesContent("bg");
    render(<ContactsPageView locale="bg" content={content.contacts} />);

    expect(screen.getByRole("heading", { level: 1, name: content.contacts.title })).toBeInTheDocument();
    expect(screen.getByTestId("contacts-hero-logo-coin")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(content.contacts.address)).toBeInTheDocument();
    expect(screen.getByText(content.contacts.hours)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: content.contacts.callAction })).toHaveAttribute("href", "tel:+359896778308");
    expect(screen.getByRole("link", { name: /Telegram/ })).toHaveAttribute(
      "href",
      messengerLinks.telegram.href,
    );
    expect(screen.getByRole("link", { name: /Viber/ })).toHaveAttribute(
      "href",
      messengerLinks.viber.href,
    );
    expect(screen.queryByTitle(content.contacts.mapTitle)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: content.contacts.mapTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: content.contacts.directionsAction })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps/dir"),
    );
  });

  it("uses admin-managed contact facts for calls, Viber, and map directions", () => {
    const content = getPublicPagesContent("bg");
    const workingSchedule = cloneBusinessHoursSchedule();
    workingSchedule[0] = { ...workingSchedule[0], closesAt: "17:30", opensAt: "09:30" };
    render(
      <ContactsPageView
        businessDetails={{
          address: "ул. Места 50, Бургас",
          businessName: "Magic Massage Natali",
          phone: "+359 89 677 8308",
          seoArea: "Burgas, Bulgaria",
          updatedAt: "2026-07-18T10:00:00.000Z",
          workingSchedule,
        }}
        locale="bg"
        content={content.contacts}
      />,
    );

    expect(screen.getByText("ул. Места 50, Бургас")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: content.contacts.hoursLabel })).getByText("09:30 - 17:30")).toBeVisible();
    expect(screen.queryByText(content.contacts.hours)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: content.contacts.callAction })).toHaveAttribute(
      "href",
      "tel:+359896778308",
    );
    expect(screen.getByRole("link", { name: /Viber/ })).toHaveAttribute(
      "href",
      "viber://chat?number=%2B359896778308",
    );
    expect(screen.getByRole("link", { name: content.contacts.directionsAction })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("ул. Места 50, Бургас")),
    );
  });

  it("does not load the Google Maps iframe until cookie consent is accepted", async () => {
    const user = userEvent.setup();
    const content = getPublicPagesContent("bg");

    render(<ContactsPageView locale="bg" content={content.contacts} />);

    expect(screen.queryByTitle(content.contacts.mapTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /всички/i }));

    expect(screen.getByTitle(content.contacts.mapTitle)).toHaveAttribute(
      "src",
      expect.stringContaining("google.com/maps"),
    );
    expect(screen.getByTitle(content.contacts.mapTitle)).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
  });

  it("unlocks the map for mounted UI when cookie storage is unavailable", async () => {
    const user = userEvent.setup();
    const content = getPublicPagesContent("en");

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    render(<ContactsPageView locale="en" content={content.contacts} />);

    expect(screen.queryByTitle(content.contacts.mapTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept all" }));

    expect(screen.getByTitle(content.contacts.mapTitle)).toHaveAttribute(
      "src",
      expect.stringContaining("google.com/maps"),
    );
  });

  it("keeps Google Maps gated when non-essential cookies are rejected", async () => {
    const user = userEvent.setup();
    const content = getPublicPagesContent("en");

    render(
      <>
        <ContactsPageView locale="en" content={content.contacts} />
        <CookieConsentBanner locale="en" />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Reject non-essential" }));

    expect(screen.queryByTitle(content.contacts.mapTitle)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: content.contacts.mapTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change cookie preferences" })).toBeInTheDocument();
  });
});
