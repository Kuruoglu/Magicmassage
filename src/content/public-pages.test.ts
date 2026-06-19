import { describe, expect, it } from "vitest";

import { getPublicPagesContent, getServiceContent, getServiceSlugs } from "./public-pages";

describe("public pages content", () => {
  it("provides a complete nineteen-service catalog for every locale", () => {
    for (const locale of ["bg", "ru", "ua", "en"] as const) {
      const content = getPublicPagesContent(locale);

      expect(content.services.items).toHaveLength(19);
      expect(new Set(content.services.items.map((item) => item.slug)).size).toBe(19);
      expect(content.services.items.some((item) => item.category === "partial")).toBe(true);
      expect(content.services.items.some((item) => item.category === "spa")).toBe(true);
      expect(content.services.items.every((item) => item.title.length > 3)).toBe(true);
      expect(content.services.items.every((item) => item.description.length > 20)).toBe(true);
    }
  });

  it("provides complete About and Contacts pages in every locale", () => {
    for (const locale of ["bg", "ru", "ua", "en"] as const) {
      const content = getPublicPagesContent(locale);

      expect(content.about.title.length).toBeGreaterThan(10);
      expect(content.about.paragraphs).toHaveLength(2);
      expect(content.about.imageAlt.length).toBeGreaterThan(5);
      expect(content.contacts.title.length).toBeGreaterThan(10);
      expect(content.contacts.phone).toBe("+359 89 677 8309");
      expect(content.contacts.address.length).toBeGreaterThan(10);
    }
  });

  it("localizes page headings instead of reusing one language", () => {
    const serviceTitles = new Set(
      (["bg", "ru", "ua", "en"] as const).map(
        (locale) => getPublicPagesContent(locale).services.title,
      ),
    );

    expect(serviceTitles.size).toBe(4);
  });

  it("finds individual service content by slug", () => {
    expect(getServiceSlugs("ru")).toHaveLength(19);
    expect(getServiceContent("ru", "classic-massage")?.slug).toBe("classic-massage");
    expect(getServiceContent("ru", "hot-stone-therapy")?.slug).toBe("hot-stone-therapy");
    expect(getServiceContent("ru", "missing-service")).toBeUndefined();
  });
});
