import { describe, expect, it } from "vitest";

import { locales } from "@/i18n/config";
import { findBlogPostByLocaleAndSlug, listBlogPostsByLocale, staticBlogPosts } from "./blog";

describe("localized static blog content", () => {
  it("provides three complete articles in every locale without fallback", () => {
    expect(staticBlogPosts).toHaveLength(12);

    for (const locale of locales) {
      const posts = listBlogPostsByLocale(locale);
      expect(posts).toHaveLength(3);
      expect(posts.every((post) => post.locale === locale && !post.usedLocaleFallback)).toBe(true);
      expect(posts.every((post) => post.html.includes("<h2>") && post.seo.description.length >= 120)).toBe(true);
    }
  });

  it("gives every translation a localized slug, canonical, and complete hreflang map", () => {
    for (const post of staticBlogPosts) {
      expect(findBlogPostByLocaleAndSlug(post.locale, post.slug)).toEqual(post);
      expect(post.seo.canonicalUrl).toBe(`/${post.locale}/blog/${post.slug}`);
      expect(Object.keys(post.seo.hreflang).sort()).toEqual([...locales].sort());
      expect(Object.values(post.seo.hreflang).every((href) => href?.includes("/blog/"))).toBe(true);
    }
  });
});
