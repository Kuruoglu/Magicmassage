import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getPublicPagesContent } from "@/content/public-pages";
import { AboutPageView } from "./about-page-view";
import { ContactsPageView } from "./contacts-page-view";
import { ServicesPageView } from "./services-page-view";

describe("localized public page views", () => {
  it("renders the full services catalog", () => {
    const content = getPublicPagesContent("ru");
    render(<ServicesPageView locale="ru" content={content.services} />);

    expect(screen.getByRole("heading", { level: 1, name: content.services.title })).toBeInTheDocument();
    for (const service of content.services.items) {
      expect(screen.getByRole("heading", { level: 2, name: service.title })).toBeInTheDocument();
    }
  });

  it("renders the About story with real photography", () => {
    const content = getPublicPagesContent("ua");
    render(<AboutPageView locale="ua" content={content.about} />);

    expect(screen.getByRole("heading", { level: 1, name: content.about.title })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: content.about.imageAlt })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: content.about.studioImageAlt })).toBeInTheDocument();
  });

  it("renders contact facts and a direct call action", () => {
    const content = getPublicPagesContent("bg");
    render(<ContactsPageView locale="bg" content={content.contacts} />);

    expect(screen.getByRole("heading", { level: 1, name: content.contacts.title })).toBeInTheDocument();
    expect(screen.getByText(content.contacts.address)).toBeInTheDocument();
    expect(screen.getByText(content.contacts.hours)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: content.contacts.callAction })).toHaveAttribute("href", "tel:+359896778309");
  });
});
