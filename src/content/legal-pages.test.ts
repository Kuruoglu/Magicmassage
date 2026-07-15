import { describe, expect, it } from "vitest";

import { locales } from "@/i18n/config";

import { getLegalPageContent } from "./legal-pages";

describe("legal page booking disclosures", () => {
  it("describes internal booking data processing in every locale", () => {
    const requiredTerms = {
      bg: ["CRM", "телефон"],
      ru: ["CRM", "телефон"],
      ua: ["CRM", "телефон"],
      en: ["CRM", "phone"],
    } as const;

    for (const locale of locales) {
      const privacy = getLegalPageContent(locale, "privacy").sections
        .flatMap((section) => section.paragraphs)
        .join(" ");
      for (const term of requiredTerms[locale]) expect(privacy).toContain(term);
    }
  });

  it("states that final confirmation creates the appointment immediately", () => {
    const immediateTerms = { bg: "веднага", ru: "сразу", ua: "одразу", en: "immediately" } as const;

    for (const locale of locales) {
      const terms = getLegalPageContent(locale, "terms").sections
        .flatMap((section) => section.paragraphs)
        .join(" ");
      expect(terms).toContain(immediateTerms[locale]);
    }
  });
});
