import { describe, expect, it } from "vitest";

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("contains every localized public page URL", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toHaveLength(45);
    expect(urls).toContain("https://magicmassagenatali.bg/bg");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/services");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/about");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/contacts");
    expect(urls).toContain("https://magicmassagenatali.bg/bg/services/classic-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/ru/services/deep-tissue-massage");
    expect(urls).toContain("https://magicmassagenatali.bg/ua/services/chiropractic-massage");
  });
});
