import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  getHtmlLanguage,
  isSupportedLocale,
  locales,
} from "./config";

describe("locale configuration", () => {
  it("supports the agreed BG, RU, and UA public locale segments", () => {
    expect(locales).toEqual(["bg", "ru", "ua"]);
    expect(defaultLocale).toBe("bg");
    expect(isSupportedLocale("bg")).toBe(true);
    expect(isSupportedLocale("ru")).toBe(true);
    expect(isSupportedLocale("ua")).toBe(true);
    expect(isSupportedLocale("uk")).toBe(false);
  });

  it("maps public locale segments to standards-compliant HTML language tags", () => {
    expect(getHtmlLanguage("bg")).toBe("bg-BG");
    expect(getHtmlLanguage("ru")).toBe("ru");
    expect(getHtmlLanguage("ua")).toBe("uk-UA");
  });
});
