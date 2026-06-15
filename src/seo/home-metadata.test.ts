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
});
