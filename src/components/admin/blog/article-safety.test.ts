import { describe, expect, it } from "vitest";

import {
  getArticleText,
  isSafeArticleLink,
  isSafeCoverUrl,
  sanitizeArticleDraft,
  sanitizeArticleHtml,
  validateArticleDraft,
} from "./article-safety";
import type { BlogArticleDraft } from "./types";

const validDraft: BlogArticleDraft = {
  author: "Natali",
  category: "Советы",
  content: "<h2>Подготовка</h2><p>Полезный текст.</p>",
  coverAlt: "Массажный кабинет",
  coverUrl: "/media/blog/room.jpg",
  excerpt: "Краткое описание",
  locale: "ru",
  scheduledAt: "",
  seoDescription: "Полезная статья о подготовке к массажу.",
  seoTitle: "Как подготовиться к массажу",
  slug: "massage-preparation",
  status: "draft",
  tags: ["массаж", "советы"],
  title: "Как подготовиться к массажу",
};

describe("article safety helpers", () => {
  it("keeps TipTap article markup while removing unsafe tags, attributes, and URLs", () => {
    const result = sanitizeArticleHtml(`
      <h2 style="text-align:center;color:red" onclick="alert(1)">Heading</h2>
      <script>alert(1)</script>
      <p><a href="javascript:alert(1)" target="_blank">Bad</a></p>
      <p><a href="https://example.com" target="_blank">Safe</a></p>
      <img src="x" onerror="alert(1)">
    `);

    expect(result).toContain('<h2 style="text-align:center">Heading</h2>');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).not.toContain("script");
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("<img");
  });

  it("normalizes saved drafts and validates publication requirements", () => {
    const normalized = sanitizeArticleDraft({
      ...validDraft,
      author: "  Natali  ",
      slug: "  MASSAGE-PREPARATION ",
      status: "published",
      tags: [" советы ", "", "советы", "массаж"],
    });

    expect(normalized.author).toBe("Natali");
    expect(normalized.slug).toBe("massage-preparation");
    expect(normalized.tags).toEqual(["советы", "массаж"]);
    expect(normalized.scheduledAt).toBe("");
    expect(validateArticleDraft(normalized)).toEqual({});

    expect(
      validateArticleDraft({
        ...validDraft,
        content: "<p></p>",
        coverAlt: "",
        coverUrl: "data:image/png;base64,abc",
        scheduledAt: "",
        slug: "Bad slug",
        status: "scheduled",
      }),
    ).toMatchObject({
      content: expect.any(String),
      coverUrl: expect.any(String),
      scheduledAt: expect.any(String),
      slug: expect.any(String),
    });
  });

  it("applies publication metadata, local time, and media-library checks to scheduled articles", () => {
    const scheduledDraft: BlogArticleDraft = {
      ...validDraft,
      scheduledAt: "2026-07-20T10:30",
      status: "scheduled",
    };
    const approvedMedia = [{ alt: validDraft.coverAlt, label: "Approved cover", url: validDraft.coverUrl }];

    expect(validateArticleDraft(scheduledDraft, approvedMedia)).toEqual({});
    expect(
      validateArticleDraft(
        {
          ...scheduledDraft,
          scheduledAt: "2026-02-30T10:30",
          seoDescription: "",
          seoTitle: "",
        },
        [],
      ),
    ).toMatchObject({
      coverUrl: expect.stringContaining("медиатеки"),
      scheduledAt: expect.any(String),
      seoDescription: expect.any(String),
      seoTitle: expect.any(String),
    });
    expect(
      validateArticleDraft({ ...scheduledDraft, scheduledAt: "2026-03-29T03:30" }, approvedMedia),
    ).toMatchObject({ scheduledAt: expect.any(String) });
  });

  it("accepts only preview-safe article and cover URLs", () => {
    expect(isSafeArticleLink("/ru/services")).toBe(true);
    expect(isSafeArticleLink("mailto:hello@example.com")).toBe(true);
    expect(isSafeArticleLink("javascript:alert(1)")).toBe(false);
    expect(isSafeArticleLink("//unsafe.example.com")).toBe(false);

    expect(isSafeCoverUrl("/media/blog/cover.jpg")).toBe(true);
    expect(isSafeCoverUrl("https://cdn.example.com/cover.jpg")).toBe(true);
    expect(isSafeCoverUrl("http://cdn.example.com/cover.jpg")).toBe(false);
    expect(getArticleText("<p>Hello&nbsp;world</p>")).toBe("Hello world");
  });
});
