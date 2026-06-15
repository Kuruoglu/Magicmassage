import { describe, expect, it } from "vitest";

import { getHomeContent } from "./home";

describe("home content", () => {
  it("provides localized hero and navigation content for every locale", () => {
    for (const locale of ["bg", "ru", "ua"] as const) {
      const content = getHomeContent(locale);

      expect(content.brand).toBe("Magic Massage Natali");
      expect(content.hero.title.length).toBeGreaterThan(10);
      expect(content.hero.primaryAction.length).toBeGreaterThan(3);
      expect(content.navigation.services.length).toBeGreaterThan(3);
    }
  });

  it("returns different localized hero titles", () => {
    const titles = new Set(
      (["bg", "ru", "ua"] as const).map(
        (locale) => getHomeContent(locale).hero.title,
      ),
    );

    expect(titles.size).toBe(3);
  });
});
