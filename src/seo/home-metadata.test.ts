import { describe, expect, it } from "vitest";

import { createHomeMetadata } from "./home-metadata";

describe("createHomeMetadata", () => {
  it("creates canonical and alternate home URLs for a locale", () => {
    const metadata = createHomeMetadata("ua");

    expect(metadata.alternates?.canonical).toBe("/ua");
    expect(metadata.alternates?.languages).toEqual({
      "bg-BG": "/bg",
      ru: "/ru",
      "uk-UA": "/ua",
      "x-default": "/bg",
    });
  });

  it("uses localized titles", () => {
    expect(createHomeMetadata("bg").title).not.toBe(createHomeMetadata("ru").title);
  });

  it("targets local massage salon searches in Burgas", () => {
    const metadata = createHomeMetadata("ru");

    expect(metadata.title).toBe("Массажный салон в Бургасе");
    expect(metadata.description).toContain("массажный салон в Бургасе");
    expect(metadata.description).toContain("классический");
  });
});
