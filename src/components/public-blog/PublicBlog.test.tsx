import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PublicBlogPost } from "@/lib/public-content";
import { BlogArticleView } from "./BlogArticleView";
import { BlogIndexView } from "./BlogIndexView";
import { getBlogCopy } from "./blog-copy";
import { createBlogIndexMetadata, createBlogPostMetadata } from "./blog-metadata";

const post: PublicBlogPost = {
  author: "Natali",
  category: "Восстановление",
  coverMedia: {
    altText: "Подготовка массажного кабинета",
    byteSize: 1200,
    height: 800,
    id: "cover-1",
    localizedAltText: { ru: "Подготовка массажного кабинета" },
    mimeType: "image/webp",
    updatedAt: "2026-07-11T08:00:00.000Z",
    url: "/media/blog/recovery.webp",
    width: 1200,
  },
  html: "<h2>До сеанса</h2><p>Спокойно спланируйте время.</p>",
  id: "post-1",
  locale: "ru",
  publishedAt: "2026-07-10T09:00:00.000Z",
  seo: {
    canonicalUrl: "/ru/blog/recovery-guide",
    description: "Как подготовиться к массажу и отдыху после сеанса.",
    hreflang: {
      bg: "/bg/blog/recovery-guide",
      ru: "/ru/blog/recovery-guide",
    },
    ogDescription: "Практическая подготовка к массажу.",
    ogImage: null,
    ogTitle: "Подготовка к массажу",
    robots: "index,follow",
  },
  slug: "recovery-guide",
  tags: ["массаж", "восстановление"],
  title: "Как подготовиться к массажу",
  updatedAt: "2026-07-11T09:00:00.000Z",
  usedLocaleFallback: false,
};

describe("public blog", () => {
  it("renders a semantic localized article list", () => {
    render(<BlogIndexView locale="ru" posts={[post]} />);

    expect(screen.getByRole("heading", { level: 1, name: "Блог" })).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: post.title })).toHaveAttribute(
      "href",
      "/ru/blog/recovery-guide",
    );
    expect(screen.getByRole("img", { name: post.coverMedia?.altText })).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("10 июля 2026 г.")).toBeInTheDocument();
  });

  it("renders a localized empty state without placeholder articles", () => {
    render(<BlogIndexView locale="bg" posts={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Все още няма публикации");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("renders the article body, author, topics and return navigation", () => {
    render(<BlogArticleView locale="ru" post={post} />);

    expect(screen.getByRole("heading", { level: 1, name: post.title })).toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')?.textContent).toContain('"@type":"Article"');
    expect(screen.getByRole("heading", { level: 2, name: "До сеанса" })).toBeInTheDocument();
    expect(screen.getByText("Автор: Natali")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Темы" })).toHaveTextContent("восстановление");
    expect(screen.getAllByRole("link", { name: "Ко всем статьям" })[0]).toHaveAttribute(
      "href",
      "/ru/blog",
    );
  });

  it("keeps German empty and not-found copy ready without changing the project locale contract", () => {
    expect(getBlogCopy("de")).toMatchObject({
      blogTitle: "Blog",
      emptyTitle: "Noch keine Artikel",
      notFoundTitle: "Artikel nicht gefunden",
    });
  });

  it("builds localized index and article metadata from published SEO fields", () => {
    const indexMetadata = createBlogIndexMetadata("ua");
    const articleMetadata = createBlogPostMetadata("ru", post);

    expect(indexMetadata.alternates).toMatchObject({
      canonical: "/ua/blog",
      languages: {
        "bg-BG": "/bg/blog",
        "uk-UA": "/ua/blog",
        "x-default": "/bg/blog",
      },
    });
    expect(articleMetadata).toMatchObject({
      title: post.title,
      description: post.seo.description,
      alternates: {
        canonical: "/ru/blog/recovery-guide",
        languages: {
          "bg-BG": "/bg/blog/recovery-guide",
          ru: "/ru/blog/recovery-guide",
        },
      },
      openGraph: {
        title: post.seo.ogTitle,
        publishedTime: post.publishedAt,
        modifiedTime: post.updatedAt,
        type: "article",
      },
      robots: "index,follow",
    });
  });
});
