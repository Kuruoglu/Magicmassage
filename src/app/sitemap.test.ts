import { describe, expect, it } from "vitest";

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("contains every localized public page URL", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toHaveLength(12);
    expect(urls).toContain("http://localhost:3000/bg");
    expect(urls).toContain("http://localhost:3000/bg/services");
    expect(urls).toContain("http://localhost:3000/ru/about");
    expect(urls).toContain("http://localhost:3000/ua/contacts");
  });
});
