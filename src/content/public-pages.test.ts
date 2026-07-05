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
      expect(content.about.certificates.title.length).toBeGreaterThan(10);
      expect(content.about.certificates.description.length).toBeGreaterThan(30);
      expect(content.about.certificates.viewerLabel.length).toBeGreaterThan(5);
      expect(content.about.certificates.openLabel.length).toBeGreaterThan(4);
      expect(content.about.certificates.closeLabel.length).toBeGreaterThan(4);
      expect(content.about.certificates.previousLabel.length).toBeGreaterThan(5);
      expect(content.about.certificates.nextLabel.length).toBeGreaterThan(5);
      expect(content.about.certificates.items).toHaveLength(8);
      expect(
        content.about.certificates.items.every(
          (item) =>
            item.caption.length > 5 &&
            item.alt.length > 15 &&
            item.image.src.startsWith("/media/about/certificates/") &&
            item.image.width > 0 &&
            item.image.height > 0,
        ),
      ).toBe(true);
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
    const certificateTitles = new Set(
      (["bg", "ru", "ua", "en"] as const).map(
        (locale) => getPublicPagesContent(locale).about.certificates.title,
      ),
    );

    expect(serviceTitles.size).toBe(4);
    expect(certificateTitles.size).toBe(4);
  });

  it("finds individual service content by slug", () => {
    expect(getServiceSlugs("ru")).toHaveLength(19);
    expect(getServiceContent("ru", "classic-massage")?.slug).toBe("classic-massage");
    expect(getServiceContent("ru", "hot-stone-therapy")?.slug).toBe("hot-stone-therapy");
    expect(getServiceContent("ru", "missing-service")).toBeUndefined();
  });
});
