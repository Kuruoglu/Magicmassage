import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getHomeContent } from "@/content/home";
import { HomePageView } from "./home-page-view";

describe("HomePageView", () => {
  it("renders the main customer journey in Russian", () => {
    render(<HomePageView locale="ru" content={getHomeContent("ru")} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Забота о теле. Спокойствие для души.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Записаться" })).not.toHaveLength(0);
    expect(
      screen.getByRole("heading", { name: "Классический массаж" }),
    ).toBeInTheDocument();
  });

  it("links home previews to dedicated public pages", () => {
    render(<HomePageView locale="bg" content={getHomeContent("bg")} />);

    expect(screen.getByRole("link", { name: "Виж всички масажи" })).toHaveAttribute("href", "/bg/services");
  });

  it("uses the treatment photography as the hero background", () => {
    render(<HomePageView locale="bg" content={getHomeContent("bg")} />);

    expect(screen.getByTestId("home-hero")).toHaveClass("hero-with-background");
  });

  it("omits the hero note and service sequence labels", () => {
    render(<HomePageView locale="ru" content={getHomeContent("ru")} />);

    const hero = screen.getByTestId("home-hero");
    const services = screen
      .getByRole("heading", { name: "Массаж в соответствии с потребностями вашего тела" })
      .closest("section");

    expect(within(hero).queryByText("Индивидуальный подход")).not.toBeInTheDocument();
    expect(services).not.toBeNull();
    expect(within(services as HTMLElement).queryByText("01")).not.toBeInTheDocument();
    expect(within(services as HTMLElement).queryByText("02")).not.toBeInTheDocument();
    expect(within(services as HTMLElement).queryByText("03")).not.toBeInTheDocument();
  });
});
