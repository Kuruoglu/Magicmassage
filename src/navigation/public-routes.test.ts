import { describe, expect, it } from "vitest";

import {
  getLocaleSwitchPath,
  getPublicBookingPath,
  getPublicPagePath,
  publicPageKeys,
} from "./public-routes";

describe("public route helpers", () => {
  it("builds localized paths for every public page", () => {
    expect(publicPageKeys).toEqual([
      "home",
      "services",
      "giftCertificates",
      "about",
      "contacts",
      "privacy",
      "cookies",
      "terms",
    ]);
    expect(getPublicPagePath("bg", "home")).toBe("/bg");
    expect(getPublicPagePath("ru", "services")).toBe("/ru/services");
    expect(getPublicPagePath("ru", "giftCertificates")).toBe("/ru/gift-certificates");
    expect(getPublicPagePath("ua", "about")).toBe("/ua/about");
    expect(getPublicPagePath("en", "about")).toBe("/en/about");
    expect(getPublicPagePath("bg", "contacts")).toBe("/bg/contacts");
    expect(getPublicPagePath("en", "privacy")).toBe("/en/privacy");
    expect(getPublicPagePath("ru", "cookies")).toBe("/ru/cookies");
    expect(getPublicPagePath("ua", "terms")).toBe("/ua/terms");
  });

  it("preserves the current page when switching locale", () => {
    expect(getLocaleSwitchPath("bg", "services")).toBe("/bg/services");
    expect(getLocaleSwitchPath("ru", "giftCertificates")).toBe("/ru/gift-certificates");
    expect(getLocaleSwitchPath("ua", "contacts")).toBe("/ua/contacts");
    expect(getLocaleSwitchPath("en", "contacts")).toBe("/en/contacts");
    expect(getLocaleSwitchPath("bg", "privacy")).toBe("/bg/privacy");
  });

  it("builds the feature-gated booking path with an optional service", () => {
    expect(getPublicBookingPath("ru")).toBe("/ru/booking");
    expect(getPublicBookingPath("en", "classic-massage")).toBe(
      "/en/booking?service=classic-massage",
    );
  });
});
