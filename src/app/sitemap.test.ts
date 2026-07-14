import { describe, expect, it, vi } from "vitest";

vi.mock("@/content/public-content-runtime", () => ({
  getPublicShellRuntime: vi.fn(async (locale: string) => ({
    giftCertificatesEnabled: locale !== "en",
    mediaPlacements: [],
    services: [
      { slug: "classic-massage" },
      { slug: "deep-tissue-massage" },
    ],
  })),
  getRuntimeBlogPosts: vi.fn(async (locale: string) => [
    {
      id: `post-${locale}`,
      locale,
      slug: "recovery-guide",
      updatedAt: "2026-07-12T09:00:00.000Z",
    },
  ]),
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("contains every localized public page and published blog URL", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toHaveLength(47);
    expect(urls).toContain("https://magicmassagenatali.bg/bg");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/services");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/about");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/contacts");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/en");
    expect(urls).toContain("https://magicmassagenatali.bg/en/services");
    expect(urls).not.toContain("https://magicmassagenatali.bg/en/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/privacy");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/cookies");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/terms");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/services/classic-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/services/deep-tissue-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/en/services/classic-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/blog");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/blog/recovery-guide");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/blog/recovery-guide");
    expect(urls).toContain("https://magicmassagenatali.bg/en/blog/recovery-guide");
  });

  it("uses stable static dates and published timestamps instead of generation time", async () => {
    const entries = await sitemap();
    const staticEntries = entries.filter((entry) => !entry.url.includes("/blog"));
    const blogEntries = entries.filter((entry) => entry.url.includes("/blog"));

    expect(staticEntries.every((entry) => entry.lastModified === "2026-07-04")).toBe(true);
    expect(blogEntries.every((entry) => entry.lastModified === "2026-07-12T09:00:00.000Z")).toBe(true);
  });
});
