import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("ул. «Места» 49, Бургас")).toBeInTheDocument();
  });

  it("exposes locale links for BG, RU, and UA", () => {
    render(<HomePageView locale="bg" content={getHomeContent("bg")} />);

    expect(screen.getByRole("link", { name: "BG" })).toHaveAttribute("href", "/bg");
    expect(screen.getByRole("link", { name: "RU" })).toHaveAttribute("href", "/ru");
    expect(screen.getByRole("link", { name: "UA" })).toHaveAttribute("href", "/ua");
  });
});
