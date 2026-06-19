import { describe, expect, it } from "vitest";

import {
  getLocaleSwitchPath,
  getPublicPagePath,
  publicPageKeys,
} from "./public-routes";

describe("public route helpers", () => {
  it("builds localized paths for every public page", () => {
    expect(publicPageKeys).toEqual(["home", "services", "about", "contacts"]);
    expect(getPublicPagePath("bg", "home")).toBe("/bg");
    expect(getPublicPagePath("ru", "services")).toBe("/ru/services");
    expect(getPublicPagePath("ua", "about")).toBe("/ua/about");
    expect(getPublicPagePath("en", "about")).toBe("/en/about");
    expect(getPublicPagePath("bg", "contacts")).toBe("/bg/contacts");
  });

  it("preserves the current page when switching locale", () => {
    expect(getLocaleSwitchPath("bg", "services")).toBe("/bg/services");
    expect(getLocaleSwitchPath("ua", "contacts")).toBe("/ua/contacts");
    expect(getLocaleSwitchPath("en", "contacts")).toBe("/en/contacts");
  });
});
