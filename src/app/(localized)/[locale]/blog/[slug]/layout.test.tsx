import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicShellRuntimeMock, getRuntimeBlogPostMock } = vi.hoisted(() => ({
  getPublicShellRuntimeMock: vi.fn(),
  getRuntimeBlogPostMock: vi.fn(),
}));

vi.mock("@/content/public-content-runtime", () => ({
  getPublicShellRuntime: getPublicShellRuntimeMock,
  getRuntimeBlogPost: getRuntimeBlogPostMock,
}));

import BlogPostLayout from "./layout";

describe("BlogPostLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    getPublicShellRuntimeMock.mockResolvedValue({
      giftCertificatesEnabled: true,
      mediaPlacements: [],
      services: [],
    });
    getRuntimeBlogPostMock.mockResolvedValue({
      seo: {
        hreflang: {
          bg: "/bg/blog/massage-preparation",
          ru: "/ru/blog/massage-preparation",
        },
      },
    });
  });

  it("keeps article detail content inside the shared public navigation, footer, and cookie consent shell", async () => {
    const layout = await BlogPostLayout({
      children: <main>Article detail</main>,
      params: Promise.resolve({ locale: "ru", slug: "massage-preparation" }),
    });

    render(layout);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByText("Article detail")).toBeInTheDocument();
    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer-inner")).toBeInTheDocument();
  });
});
