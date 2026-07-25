import { describe, expect, it } from "vitest";

import type { BlogPostRecord } from "@/admin/domain";

import { groupLocalizedBlogArticles } from "./localized-articles";

function post(overrides: Partial<BlogPostRecord> & Pick<BlogPostRecord, "id" | "locales" | "title">): BlogPostRecord {
  return {
    author: "Natali",
    body: "Body",
    category: "Советы",
    coverImage: "/media/blog/article.jpg",
    excerpt: "Excerpt",
    publishedAt: "2026-07-18",
    seoTitle: "SEO",
    slug: overrides.id,
    status: "Опубликована",
    tags: [],
    translationKey: overrides.translationKey ?? overrides.id,
    updatedAt: "2026-07-18",
    ...overrides,
  };
}

describe("localized blog article grouping", () => {
  it("combines locale rows by translation key and prefers Russian for the admin title", () => {
    const grouped = groupLocalizedBlogArticles([
      post({ id: "guide-bg", locales: ["bg"], title: "Насоки", translationKey: "massage-guide" }),
      post({ id: "guide-ru", locales: ["ru"], title: "Руководство", translationKey: "massage-guide" }),
      post({ id: "guide-en", locales: ["en"], title: "Guide", translationKey: "massage-guide" }),
      post({ id: "second-ru", locales: ["ru"], title: "Вторая статья", translationKey: "second-article" }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].primaryPost.title).toBe("Руководство");
    expect(grouped[0].translations.bg?.id).toBe("guide-bg");
    expect(grouped[0].translations.en?.id).toBe("guide-en");
    expect(grouped[0].declaredLocales).toEqual(["bg", "ru", "en"]);
  });

  it("keeps legacy rows without a translation key independent", () => {
    const grouped = groupLocalizedBlogArticles([
      post({ id: "legacy-one", locales: ["ru"], title: "Один" }),
      post({ id: "legacy-two", locales: ["en"], title: "Two" }),
    ]);

    expect(grouped.map((group) => group.key)).toEqual(["legacy-one", "legacy-two"]);
  });

  it("marks a group with different locale publication states as mixed", () => {
    const [group] = groupLocalizedBlogArticles([
      post({ id: "mixed-bg", locales: ["bg"], status: "Опубликована", title: "BG", translationKey: "mixed" }),
      post({ id: "mixed-ru", locales: ["ru"], status: "Черновик", title: "RU", translationKey: "mixed" }),
    ]);

    expect(group.status).toBe("Смешанный");
  });
});
