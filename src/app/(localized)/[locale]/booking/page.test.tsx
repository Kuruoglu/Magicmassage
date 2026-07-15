import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  shellRuntime: {
    giftCertificatesEnabled: true,
    mediaPlacements: [],
    publicBookingEnabled: true,
    services: [],
  },
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/content/public-content-runtime", () => ({
  getPublicShellRuntime: vi.fn(async () => mocks.shellRuntime),
}));
vi.mock("@/components/public-page-shell", () => ({
  PublicPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/public-booking/PublicBookingFlow", () => ({
  PublicBookingFlow: ({ initialServiceSlug, locale }: { initialServiceSlug?: string; locale: string }) => (
    <div data-testid="booking-flow" data-locale={locale} data-service={initialServiceSlug} />
  ),
}));

import BookingPage, { generateMetadata, generateStaticParams } from "./page";

describe("localized booking page", () => {
  beforeEach(() => {
    mocks.notFound.mockClear();
    mocks.shellRuntime.publicBookingEnabled = true;
  });

  it("renders the internal flow only when the public booking flag is enabled", async () => {
    render(await BookingPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ service: "classic-massage" }),
    }));

    expect(screen.getByTestId("booking-flow")).toHaveAttribute("data-locale", "en");
    expect(screen.getByTestId("booking-flow")).toHaveAttribute("data-service", "classic-massage");
  });

  it("fails closed when public booking is disabled", async () => {
    mocks.shellRuntime.publicBookingEnabled = false;

    await expect(BookingPage({
      params: Promise.resolve({ locale: "ru" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("provides all locales and localized metadata", async () => {
    expect(generateStaticParams()).toEqual([{ locale: "bg" }, { locale: "ru" }, { locale: "ua" }, { locale: "en" }]);
    await expect(generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    })).resolves.toMatchObject({ title: "Book an appointment" });
  });
});
