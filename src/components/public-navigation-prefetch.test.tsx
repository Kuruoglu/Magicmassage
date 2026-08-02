import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getHomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import { HomePageView } from "./home-page-view";
import { ServicesPageView } from "./services-page-view";
import { SiteHeader } from "./site-header";

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | "auto" | null;
  }) => (
    <a
      {...props}
      data-prefetch={prefetch === undefined ? undefined : String(prefetch)}
      href={href}
    />
  ),
}));

function expectPrefetchDisabled(links: NodeListOf<HTMLAnchorElement>) {
  expect(links.length).toBeGreaterThan(0);
  links.forEach((link) => expect(link).toHaveAttribute("data-prefetch", "false"));
}

describe("public navigation prefetch limits", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  it("does not prefetch every service from the catalog", () => {
    const { container } = render(
      <ServicesPageView locale="bg" content={getPublicPagesContent("bg").services} />,
    );

    expectPrefetchDisabled(container.querySelectorAll('a[href^="/bg/services/"]'));
  });

  it("does not prefetch a booking route for every home-page service", () => {
    const { container } = render(
      <HomePageView locale="bg" content={getHomeContent("bg")} publicBookingEnabled />,
    );

    expectPrefetchDisabled(container.querySelectorAll('a[href^="/bg/booking?service="]'));
  });

  it("does not prefetch the duplicated service and locale menus", () => {
    const { container } = render(
      <SiteHeader locale="bg" content={getHomeContent("bg")} currentPage="home" />,
    );

    expectPrefetchDisabled(container.querySelectorAll('a[href^="/bg/services/"]'));
    expectPrefetchDisabled(container.querySelectorAll('a[href="/ru"]'));
  });
});
