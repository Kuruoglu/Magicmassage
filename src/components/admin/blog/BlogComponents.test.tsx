import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  BlogPreview,
  BlogPublishPanel,
  BlogSeoPanel,
  createEmptyBlogArticle,
  type BlogArticleDraft,
} from ".";

const article: BlogArticleDraft = {
  ...createEmptyBlogArticle("ru"),
  author: "Натали",
  category: "Советы",
  content: '<p>Безопасный текст</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>',
  excerpt: "Краткое описание",
  seoDescription: "SEO-описание",
  seoTitle: "SEO-заголовок",
  slug: "safe-article",
  title: "Безопасная статья",
};

describe("blog subcomponents", () => {
  it("renders a sanitized reusable preview", () => {
    render(<BlogPreview content={article.content} excerpt={article.excerpt} title={article.title} />);

    const preview = screen.getByRole("article");
    expect(preview).toHaveTextContent("Безопасная статья");
    expect(preview.innerHTML).not.toContain("<script");
    expect(preview.innerHTML).not.toContain("javascript:");
  });

  it("exposes publication controls through typed patches", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BlogPublishPanel
        errors={{ scheduledAt: "Укажите дату публикации." }}
        idPrefix="article"
        onChange={onChange}
        value={{ ...article, status: "scheduled" }}
      />,
    );

    expect(screen.getByLabelText("Дата публикации")).toHaveAttribute("aria-invalid", "true");
    await user.selectOptions(screen.getByLabelText("Статус"), "published");
    expect(onChange).toHaveBeenCalledWith({ status: "published" });
  });

  it("updates cover metadata as one patch from the media library", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BlogSeoPanel
        idPrefix="article"
        mediaOptions={[{ alt: "Кабинет массажа", label: "Обложка", url: "/media/blog/cover.jpg" }]}
        onChange={onChange}
        value={article}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Из медиатеки"), "/media/blog/cover.jpg");
    expect(onChange).toHaveBeenCalledWith({
      coverAlt: "Кабинет массажа",
      coverUrl: "/media/blog/cover.jpg",
    });
  });
});
