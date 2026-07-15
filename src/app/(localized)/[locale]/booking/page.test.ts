import { describe, expect, it } from "vitest";

import { generateMetadata } from "./page";

describe("booking page metadata", () => {
  it("publishes canonical and localized alternate booking URLs", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "ru" }),
      searchParams: Promise.resolve({ service: "classic-massage" }),
    });

    expect(metadata.alternates?.canonical).toBe("/ru/booking");
    expect(metadata.alternates?.languages).toEqual({
      "bg-BG": "/bg/booking",
      en: "/en/booking",
      ru: "/ru/booking",
      "uk-UA": "/ua/booking",
      "x-default": "/bg/booking",
    });
  });
});
