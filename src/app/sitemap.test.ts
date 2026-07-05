import { describe, expect, it } from "vitest";

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("contains every localized public page URL", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toHaveLength(96);
    expect(urls).toContain("https://magicmassagenatali.bg/bg");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/services");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/about");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/contacts");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/en");
    expect(urls).toContain("https://magicmassagenatali.bg/en/services");
    expect(urls).toContain("https://magicmassagenatali.bg/en/gift-certificates");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/services/classic-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/services/deep-tissue-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/services/hot-stone-therapy");
    expect(urls).toContain("https://magicmassagenatali.bg/en/services/classic-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/services/lymphatic-drainage-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/services/bms-apparatus-massage");
  });

  it("uses a stable content update date instead of generation time", () => {
    const entries = sitemap();

    expect(entries.every((entry) => entry.lastModified === "2026-07-04")).toBe(true);
  });
});
